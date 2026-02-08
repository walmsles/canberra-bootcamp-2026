import { describe, it, expect } from 'vitest';
import { buildCreateTaskItem } from '../tools/create-task';

describe('buildCreateTaskItem', () => {
  it('builds a valid item with required fields', () => {
    const { item, error } = buildCreateTaskItem(
      { title: 'Test task', listId: 'list-1' },
      'user-123',
    );
    expect(error).toBeNull();
    expect(item).toBeDefined();
    expect(item!.title).toBe('Test task');
    expect(item!.listId).toBe('list-1');
    expect(item!.owner).toBe('user-123');
    expect(item!.id).toBeDefined();
  });

  it('rejects missing title', () => {
    const { item, error } = buildCreateTaskItem({ listId: 'list-1' }, 'user-123');
    expect(item).toBeNull();
    expect(error).toContain('title');
  });

  it('rejects missing listId', () => {
    const { item, error } = buildCreateTaskItem({ title: 'Test' }, 'user-123');
    expect(item).toBeNull();
    expect(error).toContain('listId');
  });

  it('strips unknown fields and reports them', () => {
    const { item, unknownFields } = buildCreateTaskItem(
      { title: 'Test', listId: 'list-1', fakeField: 'nope' } as Record<string, unknown>,
      'user-123',
    );
    expect(item).toBeDefined();
    expect(unknownFields).toContain('fakeField');
    expect(item!.fakeField).toBeUndefined();
  });

  it('includes optional fields when provided', () => {
    const { item } = buildCreateTaskItem(
      { title: 'Test', listId: 'list-1', priority: 'HIGH', effortHours: 2.5, status: 'PENDING' },
      'user-123',
    );
    expect(item!.priority).toBe('HIGH');
    expect(item!.effortHours).toBe(2.5);
    expect(item!.status).toBe('PENDING');
  });

  it('rejects invalid status', () => {
    const { error } = buildCreateTaskItem(
      { title: 'Test', listId: 'list-1', status: 'INVALID' },
      'user-123',
    );
    expect(error).toContain('Invalid status');
  });

  it('rejects invalid priority', () => {
    const { error } = buildCreateTaskItem(
      { title: 'Test', listId: 'list-1', priority: 'CRITICAL' },
      'user-123',
    );
    expect(error).toContain('Invalid priority');
  });
});
