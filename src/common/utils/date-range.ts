export function buildDateRange(from?: string, to?: string) {
  if (!from && !to) return undefined;
  return {
    ...(from ? { gte: startOfBusinessDay(from) } : {}),
    ...(to ? { lte: endOfBusinessDay(to) } : {}),
  };
}

function startOfBusinessDay(value: string) {
  const dateOnly = parseDateOnly(value);
  if (!dateOnly) return new Date(value);
  return new Date(Date.UTC(dateOnly.year, dateOnly.month - 1, dateOnly.day, 3, 0, 0, 0));
}

function endOfBusinessDay(value: string) {
  const dateOnly = parseDateOnly(value);
  if (!dateOnly) {
    const date = new Date(value);
    date.setHours(23, 59, 59, 999);
    return date;
  }
  return new Date(Date.UTC(dateOnly.year, dateOnly.month - 1, dateOnly.day + 1, 2, 59, 59, 999));
}

function parseDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}
