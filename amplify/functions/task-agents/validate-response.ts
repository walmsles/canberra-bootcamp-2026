export interface AgentResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  rawResponse?: string;
}

export function validateAgentResponse(raw: string): AgentResponse {
  try {
    // Strip markdown code blocks if present
    let cleaned = raw.trim();
    
    // Remove ```json ... ``` or ``` ... ``` wrappers
    const codeBlockMatch = cleaned.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
    if (codeBlockMatch) {
      cleaned = codeBlockMatch[1].trim();
    }
    
    const data = JSON.parse(cleaned);
    return { success: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid JSON response';
    return { success: false, error: message, rawResponse: raw };
  }
}
