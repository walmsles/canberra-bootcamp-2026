import { fetchAuthSession } from 'aws-amplify/auth';
import outputs from '../../amplify_outputs.json';

// Type for amplify outputs with custom fields
type AmplifyOutputs = typeof outputs & {
  custom?: {
    taskAgentsApiUrl?: string;
    taskAgentsApiId?: string;
  };
};

// Get the API endpoint from amplify_outputs.json
// After deployment, this will be populated with the actual API Gateway URL
const typedOutputs = outputs as AmplifyOutputs;
const API_ENDPOINT = typedOutputs.custom?.taskAgentsApiUrl || '';

if (!API_ENDPOINT && import.meta.env.DEV) {
  console.warn('Task Agents API URL not found in amplify_outputs.json. Please deploy the backend first.');
}

export interface TaskAgentRequest {
  queryType: 'breakdownProject' | 'analyzeTask' | 'planDay' | 'recommendTask';
  listId?: string;
  projectBrief?: string;
  deadline?: string;
  taskDescription?: string;
  date?: string;
}

export interface TaskAgentResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Call the task agents REST API with streaming support
 */
export async function callTaskAgentsApi(request: TaskAgentRequest): Promise<TaskAgentResponse> {
  if (!API_ENDPOINT) {
    throw new Error('Task Agents API is not configured. Please deploy the backend first.');
  }

  try {
    // Get the current auth session
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();

    if (!token) {
      throw new Error('Not authenticated');
    }

    // Make the API call
    const response = await fetch(`${API_ENDPOINT}/agents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    // Read the response body
    const text = await response.text();
    
    // Parse the JSON response
    const data = JSON.parse(text) as TaskAgentResponse;
    
    return data;
  } catch (error) {
    console.error('Task agents API error:', error);
    throw error;
  }
}

/**
 * Call the task agents REST API with streaming support and callback for chunks
 */
export async function callTaskAgentsApiStreaming(
  request: TaskAgentRequest,
  onChunk?: (chunk: string) => void
): Promise<TaskAgentResponse> {
  if (!API_ENDPOINT) {
    throw new Error('Task Agents API is not configured. Please deploy the backend first.');
  }

  try {
    // Get the current auth session
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();

    if (!token) {
      throw new Error('Not authenticated');
    }

    // Make the API call
    const response = await fetch(`${API_ENDPOINT}/agents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    // Read the response body as a stream
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();
    let fullText = '';

    // Read chunks as they arrive
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      fullText += chunk;
      
      // Call the callback with each chunk
      if (onChunk) {
        onChunk(chunk);
      }
    }

    // Parse the final response
    const data = JSON.parse(fullText) as TaskAgentResponse;
    
    return data;
  } catch (error) {
    console.error('Task agents API streaming error:', error);
    throw error;
  }
}
