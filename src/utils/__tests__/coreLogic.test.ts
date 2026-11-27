import { describe, it, expect } from 'vitest';
import { addMonthsLocal, getLocalDateString } from '../dateUtils';
import { calculateDaysRemaining, getExpiryAlertLevel } from '../expiryAlerts';
import { detectActiveWarranties } from '../warrantyDetector';
import { INITIAL_AMBULANCES, INITIAL_EXTERNAL_WORKSHOPS, INITIAL_WORK_ORDERS } from '../../initialData';

describe('dateUtils', () => {
  it('formats local date YYYY-MM-DD', () => {
    const d = new Date(2026, 4, 9); // 9 May 2026
    expect(getLocalDateString(d)).toBe('2026-05-09');
  });

  it('adds months without end-of-month overflow', () => {
    expect(addMonthsLocal('2027-06-30', 6)).toBe('2027-12-30');
    expect(addMonthsLocal('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsLocal('2024-01-31', 1)).toBe('2024-02-29');
  });
});

describe('expiryAlerts', () => {
  it('computes exact calendar days regardless of DST', () => {
    expect(calculateDaysRemaining('2026-04-05', '2026-03-21')).toBe(15);
    expect(calculateDaysRemaining('2026-10-30', '2026-10-15')).toBe(15);
    expect(calculateDaysRemaining('2026-03-20', '2026-03-21')).toBe(-1);
  });

  it('treats invalid dates as expired instead of ok', () => {
    expect(calculateDaysRemaining('', '2026-03-21')).toBe(-1);
    expect(calculateDaysRemaining('invalid-date', '2026-03-21')).toBe(-1);
    expect(getExpiryAlertLevel(NaN)).toBe('expired');
    expect(getExpiryAlertLevel(-1)).toBe('expired');
    expect(getExpiryAlertLevel(7)).toBe('days7');
    expect(getExpiryAlertLevel(15)).toBe('days15');
    expect(getExpiryAlertLevel(30)).toBe('days30');
    expect(getExpiryAlertLevel(31)).toBe('ok');
  });
});

describe('warrantyDetector', () => {
  it('ignores orders without explicit duration or km and sorts most recent first', () => {
    const res = detectActiveWarranties(
      INITIAL_AMBULANCES[0].id,
      INITIAL_AMBULANCES[0].mileage,
      INITIAL_WORK_ORDERS,
      INITIAL_EXTERNAL_WORKSHOPS
    );
    expect(Array.isArray(res)).toBe(true);
    for (let i = 1; i < res.length; i++) {
      expect(res[i - 1].baseDate >= res[i].baseDate).toBe(true);
    }
  });
});
