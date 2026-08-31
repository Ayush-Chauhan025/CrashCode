export interface ExtractedFunction {
    name: string,
    parameters: {
        name: string, 
        type: string
    }[],
    return_type: string,
    source_code: string
}

export interface ExploitPayload {
  vulnerability_type: string;
  hypothesis: string;
  jest_test_code: string;
}

export enum TestExecutionStatus {
  EXPLOIT_CONFIRMED = 'EXPLOIT_CONFIRMED',
  TARGET_PASSED = 'TARGET_PASSED',
  SYNTAX_ERROR = 'SYNTAX_ERROR',
  TIMEOUT = 'TIMEOUT'
}

export interface ExecutionResult {
  status: TestExecutionStatus;
  raw_output: string;
  error_trace?: string;
}

export interface PatchResult {
  patched_code: string;
  explanation: string;
  patch_verified: boolean;
}