import { ExternalWorkshop, WorkOrder } from '../types';

export interface ActiveWarrantyMatch {
  workOrder: WorkOrder;
  workshop?: ExternalWorkshop;
  warrantyText: string;
  baseDate: string;
  expiryDate: string | null;
  daysRemaining: number | null;
  kmRemaining: number | null;
  isActive: boolean;
}

const parseMonthsFromWarranty = (text: string): number | null => {
  const m = text.match(/(\d+)\s*mes(?:es)?/i);
  if (m) return parseInt(m[1], 10);
  const y = text.match(/(\d+)\s*a[ñn]o(?:s)?/i);
  if (y) return parseInt(y[1], 10) * 12;
  return null;
};

const parseKmFromWarranty = (text: string): number | null => {
  const k = text.match(/(\d+(?:[.,]\d+)?)\s*km/i);
  if (!k) return null;
  const normalized = k[1].replace(/\./g, '').replace(',', '');
  const val = parseInt(normalized, 10);
  return isNaN(val) ? null : val;
};

/**
 * Detecta reparaciones recientes con garantía vigente para una ambulancia dada.
 */
export const detectActiveWarranties = (
  ambulanceId: string,
  currentMileage: number,
  workOrders: WorkOrder[],
  workshops: ExternalWorkshop[]
): ActiveWarrantyMatch[] => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const candidates = workOrders.filter(
    (wo) =>
      wo.ambulanceId === ambulanceId &&
      (wo.status === 'Reparada' || wo.status === 'Cerrada') &&
      Boolean(wo.warranty && wo.warranty.trim())
  );

  const matches: ActiveWarrantyMatch[] = [];

  for (const wo of candidates) {
    const baseDateStr = wo.exitDate || wo.completedAt || wo.entryDate || wo.createdAt;
    const baseDate = new Date(`${baseDateStr}T00:00:00`);
    if (isNaN(baseDate.getTime())) continue;

    const months = parseMonthsFromWarranty(wo.warranty) ?? 6;
    const expiryDateObj = new Date(baseDate);
    expiryDateObj.setMonth(expiryDateObj.getMonth() + months);

    const daysRemaining = Math.ceil(
      (expiryDateObj.getTime() - today.getTime()) / (1000 * 3600 * 24)
    );

    const kmLimit = parseKmFromWarranty(wo.warranty);
    const kmSinceRepair = Math.max(0, currentMileage - (wo.mileageAtEntry || 0));
    const kmRemaining = kmLimit !== null ? kmLimit - kmSinceRepair : null;

    const isTimeValid = daysRemaining >= 0;
    const isKmValid = kmRemaining === null || kmRemaining >= 0;

    if (isTimeValid && isKmValid) {
      matches.push({
        workOrder: wo,
        workshop: workshops.find((w) => w.id === wo.workshopId),
        warrantyText: wo.warranty,
        baseDate: baseDateStr,
        expiryDate: expiryDateObj.toISOString().split('T')[0],
        daysRemaining,
        kmRemaining,
        isActive: true,
      });
    }
  }

  return matches.sort((a, b) => (b.daysRemaining ?? 0) - (a.daysRemaining ?? 0));
};
