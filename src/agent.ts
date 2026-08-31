import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ExtractedFunction, ExploitPayload } from "./types";
import * as dotenv from 'dotenv';

dotenv.config();

export class AI_agent{
    private ai: GoogleGenAI;

    constructor(){
        const api_key = process.env.GEMINI_API_KEY;
        if(!api_key){
            throw new Error('API KEY not found is the environment variables');
        }
        this.ai = new GoogleGenAI({ apiKey: api_key});
    }

    public async generate_exploit(target_file_relpath: string, fn_meta: ExtractedFunction, prev_error?: string): Promise<ExploitPayload>{
        const exploit_schema: Schema = {
            type: Type.OBJECT,
            properties: {
                vulnerability_type: {
                    type: Type.STRING,
                    description: 'Category: Boundary Value Error, Boundary Overlap, Off-by-One Error, Empty or Null Input, Type Coercion, Missing Validation, Division by Zero, Incorrect Conditional Logic, State Mutation Bug, Precision Loss, or Race Condition'
                },
                hypothesis: {
                    type: Type.STRING,
                    description: 'Exact explanation of how this input breaks the business logic'
                },
                jest_test_code: {
                    type: Type.STRING,
                    description: 'A complete, self-contained Jest test file. Must import the function from the exact relative path.'
                }
            },
            required: ['vulnerability_type', 'hypothesis', 'jest_test_code']
        }

        let prompt = `
            You are an elite Adversarial QA Engineer specializing in Fintech and Ledger logic.
            Your mission is to identify a non-obvious edge case or potential logic vulnerability in the following TypeScript function and generate a Jest test that exposes it.
            TARGET MODULE PATH: ${target_file_relpath}
            TARGET FUNCTION:
            ${fn_meta.source_code}
            ATTACK GUIDELINES:
            1. Prioritize subtle bugs such as floating-point IEEE-754 precision issues, half-cent rounding errors, zero or negative boundaries, overflow, boundary overlaps, incorrect conditional logic, type coercion, and unexpected input mutation.
            2. The generated test MUST use proper ES6/TypeScript imports and import the target function from '${target_file_relpath.replace(/\.ts$/, '')}'.
            3. The expected result MUST represent the correct business logic, not the current implementation.
            4. Choose an input that is likely to expose a real bug in the implementation.
            5. The generated Jest test should fail against the current implementation if a vulnerability exists.
            6. Do not invent behavior that cannot reasonably be inferred from the function implementation.
            7. Return only the structured response requested by the response schema.
        `;

        if(prev_error){
            prompt += `
                \n⚠️ PREVIOUS ATTEMPT FAILED WITH RUNTIME/SYNTAX ERROR:
                ${prev_error}
                Fix the test imports or syntax so that it compiles and executes properly in ts-jest.
            `;
        }

        const response = await this.ai.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: exploit_schema,
                temperature: 0.2
            }
        });

        if (!response.text) {
            throw new Error('Gemini returned an empty response');
        }
        console.log(response);
        const parsed: ExploitPayload = JSON.parse(response.text.trim());
        console.log(parsed);
        return parsed;
    }
}