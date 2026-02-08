export interface AgentResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  rawResponse?: string;
}

export function validateAgentResponse(raw: string): AgentResponse {
  try {
    const data = JSON.parse(raw);
    return { success: true, data };
  } catch {
    return { success: false, error: 'Invalid JSON response', rawResponse: raw };
  }
}
