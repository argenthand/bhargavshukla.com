/** Format a calendar date (YYYY-MM-DD) like "September 1, 2026". */
export function formatDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-CA', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
