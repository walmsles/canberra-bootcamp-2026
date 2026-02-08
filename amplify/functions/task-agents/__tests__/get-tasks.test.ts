import { describe, it, expect } from 'vitest';
import { buildGetTasksQuery } from '../tools/get-tasks';

const TABLE = 'TodoItem';

describe('buildGetTasksQuery', () => {
  it('uses scan when no filters provided', () => {
    const { command, params } = buildGetTasksQuery({}, TABLE);
    expect(command).toBe('scan');
    expect(params.TableName).toBe(TABLE);
  });

  it('uses byList GSI when listId provided', () => {
    const { command, params } = buildGetTasksQuery({ listId: 'list-1' }, TABLE);
    expect(command).toBe('query');
    expect(params.IndexName).toBe('byList');
  });

  it('uses byStatus GSI when only status provided', () => {
    const { command, params } = buildGetTasksQuery({ status: 'PENDING' }, TABLE);
    expect(command).toBe('query');
    expect(params.IndexName).toBe('byStatus');
  });

  it('prefers byList GSI when both listId and status provided', () => {
    const { command, params } = buildGetTasksQuery(
      { listId: 'list-1', status: 'PENDING' },
      TABLE,
    );
    expect(command).toBe('query');
    expect(params.IndexName).toBe('byList');
    expect(params.FilterExpression).toContain('#status');
  });

  it('ignores unknown filter fields', () => {
    const { unknownFields, command } = buildGetTasksQuery(
      { unknownFilter: 'value' } as Record<string, unknown>,
      TABLE,
    );
    expect(unknownFields).toContain('unknownFilter');
    expect(command).toBe('scan');
  });

  it('adds date range to scan filter', () => {
    const { command, params } = buildGetTasksQuery(
      { dueDateAfter: '2025-01-01', dueDateBefore: '2025-12-31' },
      TABLE,
    );
    expect(command).toBe('scan');
    expect(params.FilterExpression).toContain('dueDate >= :dueDateAfter');
    expect(params.FilterExpression).toContain('dueDate <= :dueDateBefore');
  });
});
