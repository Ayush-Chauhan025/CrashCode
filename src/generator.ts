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

        let response;
        let retries = 3;
        while(retries > 0){
            try {
                response = await this.ai.models.generateContent({
                    model: 'gemini-3.6-flash',
                    contents: prompt,
                    config: {
                        responseMimeType: 'application/json',
                        responseSchema: patch_schema,
                        temperature: 0.1
                    }
                });
                break;
            } catch(error: any){
                const can_retry = error.status === 429 || error.status >= 500 || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT';
                if(can_retry && retries > 1){
                    console.log("Gemini busy, retrying in 5 sec to generate fix");
                    await new Promise(wait => setTimeout(wait, 5000));
                    retries--;
                } else {
                    throw error;
                }
            }
        }

        if(!response || !response.text) {
            throw new Error("No response from gemini during code fix");
        }

        let parsed;
        try {
            parsed = JSON.parse(response.text.trim());
        } catch(error: any){
            console.log("Invalid JSON");
            return {
                fixed_code: original_code,
                explanation: 'Failed due to invalid output format.',
                patch_verified: false
            }
        }

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

            fs.writeFileSync(filepath, backup_code);
            if(verify_result.status === TestExecutionStatus.TARGET_PASSED){
                return {
                    fixed_code,
                    explanation: parsed.explanation,
                    patch_verified: true
                }
            } else {
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