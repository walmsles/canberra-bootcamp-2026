export function enrichQuery(query: string, now: Date): string {
  const timestamp = now.toISOString();
  const dateOnly = timestamp.split('T')[0];
  const timeOnly = now.toTimeString().split(' ')[0];
  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });

  return `Current Date and Time: ${timestamp}\nDate: ${dateOnly} (${dayOfWeek})\nTime: ${timeOnly}\nUser Query: ${query}`;
}
