# CrashCode
> **AI-powered security stress testing and automated vulnerability fixing for CI/CD pipelines.**

CrashCode is a closed-loop security agent that analyzes newly modified code, attempts to break it with intelligent edge-case tests, verifies whether a vulnerability actually exists, and generates a patch that is tested before being suggested to the developer.

## How It Works

CrashCode acts like an automated combination of a security tester and a code reviewer.

When code changes are introduced:

```text
       Code Change
            ↓
Analyze Modified Functions
            ↓
 Generate Edge-Case Tests
            ↓
 Execute Tests in Sandbox
            ↓
   Vulnerability Found?
       ↙          ↘
     No            Yes
     ↓              ↓
   Report      Generate Patch
                    ↓
               Test the Fix
                    ↓
            Post PR Suggestion

```
# 1. AST Extraction
Deterministically parses the Pull Request git diff, extracting only the modified functions and stripping away irrelevant codebase context to eliminate AI hallucination and optimize token usage.

# 2. Test
The AI agent generates edge cases and exploit scenarios designed to uncover unexpected behavior and vulnerabilities in the modified code.

# 3. Security Testing Agent
The AI agent analyzes modified code and generates structured security hypotheses and edge-case test scenarios.

# 4. Fix
Once a vulnerability is reproduced, CrashCode generates a potential patch.

The patch is then tested against the same generated test cases to verify that:

> The vulnerability is fixed.

> The generated code executes successfully.

> The issue can no longer be reproduced.

# GitHub Action Workflow

```text
Pull Request Opened
        ↓
Detect Changed Files
        ↓
Extract Modified Functions
        ↓
Generate Edge-Case Tests
        ↓
Run Tests
        ↓
Generate & Verify Fix
        ↓
Post Results to PR

```

## Local Usage & Testing

To run the agent locally as a security assistant:
```bash
npm install
npx ts-node src/index.ts ./src/targets/vulnerable-payment.ts
