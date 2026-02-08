import { describe, it, expect } from 'vitest';
import { enrichQuery } from '../enrich-query';

describe('enrichQuery', () => {
  it('produces the correct format with all components', () => {
    const date = new Date('2025-06-15T10:30:00.000Z');
    const result = enrichQuery('Show my tasks', date);

    expect(result).toContain('Current Date and Time: 2025-06-15T10:30:00.000Z');
    expect(result).toContain('Date: 2025-06-15');
    expect(result).toContain('User Query: Show my tasks');
    expect(result).toMatch(/Time: \d{2}:\d{2}:\d{2}/);
  });

  it('preserves the original query verbatim', () => {
    const query = 'special chars: <>&"\'';
    const result = enrichQuery(query, new Date());
    expect(result).toContain(`User Query: ${query}`);
  });
});
