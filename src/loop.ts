import * as fs from 'fs';
import * as path from 'path';
import { AST_Parser } from './parser';
import { AI_agent } from "./agent";
import { AI_code_generator } from "./generator";
import { EX_Sandbox } from './sandbox';
import { TestExecutionStatus } from './types';

export class FeedBack{
    private parser: AST_Parser;
    private agent: AI_agent;
    private generator: AI_code_generator;

    constructor() {
        this.parser = new AST_Parser();
        this.agent = new AI_agent();
        this.generator = new AI_code_generator();
    }

    public async audit_file(target_filepath: string, max_exploit_attempts=3): Promise<void> {
        const fullpath = path.resolve(process.cwd(), target_filepath);
        if(!fs.existsSync(fullpath)){
            console.error(`No file found at ${fullpath}`);
            return;
        }

        // extract the functions
        const functions = this.parser.extract_exported_function(fullpath);
        if(functions.length === 0){
            console.log("No exported function found");
            return;
        }

        console.log("Functions found");

        for (const fun of functions){
            console.log(`function: ${fun.name}`);

            const sandbox = new EX_Sandbox(fullpath);
            let attempts = 0;
            let previous_error: string | undefined = undefined;
            let exploit_found = false;

            while(attempts < max_exploit_attempts && !exploit_found){
                attempts++;

                const exploit = await this.agent.generate_exploit(fullpath, fun, previous_error);
                console.log(exploit);

                let result;
                try {
                    sandbox.write_test_file(exploit.jest_test_code);
                    console.log("tests running");
                    result = sandbox.run();
                } finally {
                    sandbox.cleanup();
                }

                if(result.status === TestExecutionStatus.EXPLOIT_CONFIRMED){
                    exploit_found = true;
                    console.log("Exploit Found");
                    
                    // generate fix
                    const original_code = fs.readFileSync(fullpath, 'utf-8');

                    const fix = await this.generator.generate_fix(fullpath, original_code, exploit.jest_test_code, result.error_trace || '');
                    console.log(fix);

                    this.generate_markdown_report(fun.name, exploit, fix, result.error_trace || '');
                    break;
                } else if (result.status === TestExecutionStatus.SYNTAX_ERROR) {
                    console.log("Syntax error");
                    previous_error = result.error_trace;
                } else if (result.status === TestExecutionStatus.TARGET_PASSED) {
                    console.log("Target passed");
                    previous_error = "The target function successfully passed this test. Formulate a much more elusive, non-obvious edge-case input.";
                } else if (result.status === TestExecutionStatus.TIMEOUT) {
                    console.log("Infinite loop");
                    break;
                }
            }
            if (!exploit_found) {
                console.log(`not able to find exploits for ${fun.name}`);
            }
        }
    }

    private generate_markdown_report(function_name: string, exploit: any, fix: any, error_trace: string){
        const report = `## Vulnerability Detected

**Function:** \`${function_name}\`  
**Attack:** \`${exploit.vulnerability_type}\`  
**Reason:** ${exploit.hypothesis}

---

### Failing Exploit Trace
\`\`\`text
${error_trace}
\`\`\`

<details>
<summary><b>View Generated Jest Exploit Test</b></summary>

\`\`\`typescript
${exploit.jest_test_code}
\`\`\`
</details>

\`\`\`typescript
${exploit.jest_test_code}
\`\`\`
</details>

---

### Suggested Fix
> ${fix.explanation}

\`\`\`suggestion
${fix.fixed_code}
\`\`\`

*Review the changes above and click **"Apply suggestion"** to commit this fix.*`;

        const resort_path = path.resolve(process.cwd(), 'crash-report.md');
        fs.writeFileSync(resort_path, report, 'utf-8');
        console.log(`Report generated successfully at ${resort_path}`);
    }
}