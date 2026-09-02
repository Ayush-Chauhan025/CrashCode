import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { ExecutionResult, TestExecutionStatus } from './types';

export class EX_Sandbox{
    private temp_test_path: string;

    constructor(target_file_path: string){
        const dir = path.dirname(target_file_path);
        const base = path.basename(target_file_path, '.ts');
        this.temp_test_path = path.join(dir, `${base}.crash.test.ts`);
    }

    public write_test_file(testcode: string): void{
        fs.writeFileSync(this.temp_test_path, testcode, { encoding: 'utf-8' });
    }

    public run(): ExecutionResult {
        try {
            const stdout = execSync(`npx jest ${this.temp_test_path} --runInBand --no-cache`, {
                stdio: 'pipe',
                timeout: 30000,
                encoding: 'utf-8'
            });

            return {
                status: TestExecutionStatus.TARGET_PASSED,
                raw_output: stdout
            }
        } catch(error: any){
            const stderr = error.stderr?.toString() || error.stdout?.toString() || '';

            // syntax error
            const syntax_error_types = ['SyntaxError', 'Cannot find module', 'TypeScript diagnostics', 'Cannot find name'];
            for (const error_type of syntax_error_types){
                if(stderr.includes(error_type)){
                    return {
                        status: TestExecutionStatus.SYNTAX_ERROR,
                        raw_output: stderr,
                        error_trace: stderr
                    }
                }
            }

            // timeouts
            if (error.killed || error.signal === 'SIGTERM') {
                return {
                    status: TestExecutionStatus.TIMEOUT,
                    raw_output: 'Test timed out after 30000ms',
                    error_trace: 'Possible infinite loop detected.'
                };
            }

            // exploit confirmed
            const isAssertionFailure = stderr.includes('Expected:') || stderr.includes('Received:') || stderr.includes('expect('); 
            
            if (isAssertionFailure) { 
                return { 
                    status: TestExecutionStatus.EXPLOIT_CONFIRMED, 
                    raw_output: stderr, 
                    error_trace: this.extract_assertion_failure(stderr) 
                };
            }
            
            return {
                status: TestExecutionStatus.EXPLOIT_CONFIRMED,
                raw_output: stderr,
                error_trace: this.extract_assertion_failure(stderr)
            };
        }
    }

    public cleanup(): void{
        if(fs.existsSync(this.temp_test_path)){
            fs.unlinkSync(this.temp_test_path)
        }
    }

    private extract_assertion_failure(output: string): string{
        const lines = output.split('\n');
        const failure_lines = lines.filter(l => l.includes('Expected') || l.includes('Received') || l.includes('●'));
        return failure_lines.slice(0, 10).join('\n') || output.slice(0, 500);
    }
}