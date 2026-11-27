/**
 * Helpers de fecha en hora local (evitan desfases de +/- 1 día por UTC en toISOString()).
 */

export const getLocalDateString = (date: Date = new Date()): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const parseLocalDate = (dateStr: string): Date | null => {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return isNaN(dt.getTime()) ? null : dt;
};

export const addMonthsLocal = (dateStr: string, months: number): string => {
  const base = parseLocalDate(dateStr) || new Date();
  const targetDay = base.getDate();
  const next = new Date(base.getFullYear(), base.getMonth() + months, 1);
  const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(targetDay, maxDay));
  return getLocalDateString(next);
};
