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

# Example

## Vulnerability Detected

**Function:** `calculateMerchantPayout`  
**Attack:** `Precision Loss`  
**Reason:** The function applies Math.floor directly to calculated dollar amounts, truncating non-integer cent amounts to whole integer units. For example, on a $10.00 transaction with a 2.5% fee ($0.25) and 97.5% payout ($9.75), Math.floor reduces the fee to $0 and the payout to $9.00, creating an erroneous surplus of $1.00 rather than properly accounting for cents.

---

### Failing Exploit Trace
```text
  ● calculateMerchantPayout precision › should correctly calculate platform fee and merchant payout with cent precision
    - Expected  - 3
    + Received  + 3
```

<details>
<summary><b>View Generated Jest Exploit Test</b></summary>

```typescript
import { calculateMerchantPayout } from '/home/runner/work/CrashCode/CrashCode/src/targets/vulnerable-payment';

describe('calculateMerchantPayout precision', () => {
  it('should correctly calculate platform fee and merchant payout with cent precision', () => {
    const transactionAmount = 10.00;
    const platformFeePercent = 2.5;
    const merchantSharePercent = 97.5;

    const result = calculateMerchantPayout(transactionAmount, platformFeePercent, merchantSharePercent);

    expect(result).toEqual({
      platformFee: 0.25,
      merchantPayout: 9.75,
      remainderSurplus: 0
    });
  });
});
```
</details>

```typescript
import { calculateMerchantPayout } from '/home/runner/work/CrashCode/CrashCode/src/targets/vulnerable-payment';

describe('calculateMerchantPayout precision', () => {
  it('should correctly calculate platform fee and merchant payout with cent precision', () => {
    const transactionAmount = 10.00;
    const platformFeePercent = 2.5;
    const merchantSharePercent = 97.5;

    const result = calculateMerchantPayout(transactionAmount, platformFeePercent, merchantSharePercent);

    expect(result).toEqual({
      platformFee: 0.25,
      merchantPayout: 9.75,
      remainderSurplus: 0
    });
  });
});
```
</details>

---

### Suggested Fix
> The vulnerability was caused by using premature `Math.floor` integer rounding on the individual merchant split and platform fee calculations. This truncated fractional cents down to integers (e.g. converting 0.25 to 0 and 9.75 to 9), leading to inaccurate payouts and an artificial deficit surplus. The fix removes `Math.floor` and replaces it with 2-decimal currency rounding (`toFixed(2)` converted back to `Number`), ensuring cent-level precision for fees, payouts, and surplus.

```suggestion
/**
 * Calculates payment split and processing fees for a multi-merchant cart.
 * Subtle bug: Early Math.floor creates a cumulative fractional cent deficit.
 */
export function calculateMerchantPayout(
  transactionAmount: number,
  platformFeePercent: number,
  merchantSharePercent: number
): { platformFee: number; merchantPayout: number; remainderSurplus: number } {
  if (transactionAmount <= 0) {
    throw new Error('Transaction amount must be positive');
  }

  const platformFee = Number((transactionAmount * (platformFeePercent / 100)).toFixed(2));
  const merchantPayout = Number((transactionAmount * (merchantSharePercent / 100)).toFixed(2));
  
  const remainderSurplus = Number((transactionAmount - (platformFee + merchantPayout)).toFixed(2));

  return {
    platformFee,
    merchantPayout,
    remainderSurplus
  };
}

```

*Review the changes above and click **"Apply suggestion"** to commit this fix.*

## Local Usage & Testing

To run the agent locally as a security assistant:
```bash
npm install
npx ts-node src/index.ts ./src/targets/vulnerable-payment.ts
