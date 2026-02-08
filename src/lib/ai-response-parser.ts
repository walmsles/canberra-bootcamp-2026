// --- Agent response types ---

export interface TaskAnalysis {
  priority: 'high' | 'medium' | 'low';
  estimatedMinutes: number;
  dueDate: string | null;
  tags: string[];
  reasoning: string;
}

export interface ProjectBreakdownTask {
  title: string;
  description?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate?: string;
  tags?: string[];
  effortHours?: number;
}

export interface ProjectBreakdownResult {
  tasks: ProjectBreakdownTask[];
  summary: string;
}

export interface DailyPlanTask {
  taskId: string;
  title: string;
  priority: string;
  reasoning: string;
  estimatedMinutes?: number;
}

export interface DailyPlanResult {
  tasks: DailyPlanTask[];
  summary: string;
}

export interface TaskRecommendation {
  taskId: string;
  title: string;
  reasoning: string;
  priority: string;
}

export type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// --- Priority mapping ---

const PRIORITY_MAP = { high: 'HIGH', medium: 'MEDIUM', low: 'LOW' } as const;

export function mapAnalyzerPriority(
  priority: string,
): 'HIGH' | 'MEDIUM' | 'LOW' {
  const key = priority.toLowerCase();
  if (key in PRIORITY_MAP) {
    return PRIORITY_MAP[key as keyof typeof PRIORITY_MAP];
  }
  return 'MEDIUM';
}

// --- Pretty print ---

export function prettyPrint<T>(data: T): string {
  return JSON.stringify(data, null, 2);
}

// --- Helpers ---

function tryParseJson(raw: string): ParseResult<unknown> {
  try {
    const data: unknown = JSON.parse(raw);
    return { success: true, data };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { success: false, error: `Invalid JSON: ${message}` };
  }
}

function checkRequiredFields(
  obj: Record<string, unknown>,
  fields: string[],
): string[] {
  return fields.filter(
    (f) => obj[f] === undefined || obj[f] === null,
  );
}

// --- Parse functions ---

export function parseTaskAnalysis(raw: string): ParseResult<TaskAnalysis> {
  const json = tryParseJson(raw);
  if (!json.success) return json;

  const data = json.data as Record<string, unknown>;
  const missing = checkRequiredFields(data, [
    'priority',
    'estimatedMinutes',
    'tags',
    'reasoning',
  ]);
  if (missing.length > 0) {
    return {
      success: false,
      error: `Missing required fields: ${missing.join(', ')}`,
    };
  }

  return {
    success: true,
    data: {
      priority: data.priority as TaskAnalysis['priority'],
      estimatedMinutes: data.estimatedMinutes as number,
      dueDate: (data.dueDate as string) ?? null,
      tags: data.tags as string[],
      reasoning: data.reasoning as string,
    },
  };
}

export function parseProjectBreakdown(
  raw: string,
): ParseResult<ProjectBreakdownResult> {
  const json = tryParseJson(raw);
  if (!json.success) return json;

  const data = json.data as Record<string, unknown>;
  const missing = checkRequiredFields(data, ['tasks', 'summary']);
  if (missing.length > 0) {
    return {
      success: false,
      error: `Missing required fields: ${missing.join(', ')}`,
    };
  }

  if (!Array.isArray(data.tasks)) {
    return {
      success: false,
      error: `Missing required fields: tasks`,
    };
  }

  return {
    success: true,
    data: {
      tasks: data.tasks as ProjectBreakdownTask[],
      summary: data.summary as string,
    },
  };
}

export function parseDailyPlan(raw: string): ParseResult<DailyPlanResult> {
  const json = tryParseJson(raw);
  if (!json.success) return json;

  const data = json.data as Record<string, unknown>;
  const missing = checkRequiredFields(data, ['tasks', 'summary']);
  if (missing.length > 0) {
    return {
      success: false,
      error: `Missing required fields: ${missing.join(', ')}`,
    };
  }

  if (!Array.isArray(data.tasks)) {
    return {
      success: false,
      error: `Missing required fields: tasks`,
    };
  }

  return {
    success: true,
    data: {
      tasks: data.tasks as DailyPlanTask[],
      summary: data.summary as string,
    },
  };
}

export function parseTaskRecommendation(
  raw: string,
): ParseResult<TaskRecommendation> {
  const json = tryParseJson(raw);
  if (!json.success) return json;

  const data = json.data as Record<string, unknown>;
  const missing = checkRequiredFields(data, [
    'taskId',
    'title',
    'reasoning',
    'priority',
  ]);
  if (missing.length > 0) {
    return {
      success: false,
      error: `Missing required fields: ${missing.join(', ')}`,
    };
  }

  return {
    success: true,
    data: {
      taskId: data.taskId as string,
      title: data.title as string,
      reasoning: data.reasoning as string,
      priority: data.priority as string,
    },
  };
}
