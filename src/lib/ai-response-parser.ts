// --- Agent response types ---

export interface TaskAnalysis {
  title: string;
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
  listId?: string;
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
    let data: unknown = JSON.parse(raw);
    // Unwrap backend validateAgentResponse wrapper: { success: true, data: { ... } }
    if (
      data !== null &&
      typeof data === 'object' &&
      'success' in (data as Record<string, unknown>) &&
      'data' in (data as Record<string, unknown>)
    ) {
      const wrapper = data as { success: boolean; data?: unknown; error?: string };
      if (!wrapper.success) {
        return { success: false, error: wrapper.error ?? 'Agent returned an error' };
      }
      data = wrapper.data;
    }
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
    'title',
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
      title: data.title as string,
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

  // The SOP returns "schedule" but the frontend expects "tasks"
  const tasksOrSchedule = (data.tasks ?? data.schedule) as unknown[] | undefined;
  const summary = data.summary as string | undefined;

  if (!summary) {
    return { success: false, error: 'Missing required fields: summary' };
  }

  if (!Array.isArray(tasksOrSchedule)) {
    return { success: false, error: 'Missing required fields: tasks/schedule' };
  }

  // Map schedule items to DailyPlanTask shape
  const tasks: DailyPlanTask[] = tasksOrSchedule.map((item) => {
    const entry = item as Record<string, unknown>;
    return {
      taskId: (entry.taskId ?? '') as string,
      title: (entry.title ?? entry.taskName ?? '') as string,
      priority: (entry.priority ?? '') as string,
      reasoning: (entry.reasoning ?? '') as string,
      estimatedMinutes: entry.estimatedMinutes as number | undefined,
    };
  });

  return {
    success: true,
    data: { tasks, summary },
  };
}

export function parseTaskRecommendation(
  raw: string,
): ParseResult<TaskRecommendation> {
  const json = tryParseJson(raw);
  if (!json.success) return json;

  const data = json.data as Record<string, unknown>;

  // Map backend field names to frontend types
  const taskId = (data.taskId ?? data.recommendedTaskId) as string | undefined;
  const title = (data.title ?? data.taskName) as string | undefined;
  const reasoning = data.reasoning as string | undefined;
  const priority = (data.priority ?? 'MEDIUM') as string;
  const listId = data.listId as string | undefined;

  const missing: string[] = [];
  if (!taskId) missing.push('taskId/recommendedTaskId');
  if (!title) missing.push('title/taskName');
  if (!reasoning) missing.push('reasoning');

  if (missing.length > 0) {
    return {
      success: false,
      error: `Missing required fields: ${missing.join(', ')}`,
    };
  }

  return {
    success: true,
    data: {
      taskId: taskId!,
      listId,
      title: title!,
      reasoning: reasoning!,
      priority,
    },
  };
}
