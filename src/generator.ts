import { GoogleGenAI, Schema, Type } from "@google/genai";
import { EX_Sandbox } from './sandbox';
import { PatchResult, TestExecutionStatus } from "./types";
import * as fs from 'fs';

export class AI_code_generator{
    private ai: GoogleGenAI;

    constructor(){
        const api_key = process.env.GEMINI_API_KEY;
        if (!api_key) {
            throw new Error(
                'GEMINI_API_KEY is not defined in environment variables.'
            );
        }
        this.ai = new GoogleGenAI({ apiKey: api_key });
    }

    public async generate_fix(filepath: string, original_code: string, exploit_code: string, failure_trace: string): Promise<PatchResult> {
        const patch_schema: Schema = {
            type: Type.OBJECT,
            properties: {
                full_fixed_code: {
                    type: Type.STRING,
                    description: 'The entire file source code with the bug fixed. Maintain all original exports.'
                },
                explanation: {
                    type: Type.STRING,
                    description: 'Technical explanation of how the patch fixes the vulnerability'
                }
            },
            required: ['full_fixed_code', 'explanation']
        };

        const prompt = `
            You are a Staff Software Engineer. Fix the following code so that it passes the adversarial test harness.

            ORIGINAL SOURCE:
            ${original_code}

            FAILING TEST HARNESS:
            ${exploit_code}

            FAILURE TRACE:
            ${failure_trace}

            Provide the complete remediated source file. Do not break existing contracts.
        `;

        const response = await this.ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: patch_schema,
                temperature: 0.1
            }
        });

        if(!response.text) {
            throw new Error("No response from gemini during code fix");
        }

        const parsed = JSON.parse(response.text.trim());
        const fixed_code: string = parsed.full_fixed_code;

        const backup_code = fs.readFileSync(filepath, 'utf-8');
        try{
            fs.writeFileSync(filepath, fixed_code, 'utf-8');

            const sandbox = new EX_Sandbox(filepath);
            let verify_result;

            try {
                sandbox.write_test_file(exploit_code);
                verify_result = sandbox.run();
            } finally {
                sandbox.cleanup();
            }

            if(verify_result.status === TestExecutionStatus.TARGET_PASSED){
                return {
                    fixed_code,
                    explanation: parsed.explanation,
                    patch_verified: true
                }
            } else {
                fs.writeFileSync(filepath, backup_code);
                return {
                    fixed_code: original_code,
                    explanation: 'Code fix failed verification. Reverted to original source.',
                    patch_verified: false
                }
            }
        } catch(error) {
            fs.writeFileSync(filepath, backup_code, 'utf-8');
            throw error;
        } 
    }
}