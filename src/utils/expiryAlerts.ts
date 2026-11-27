import { Ambulance, DocumentType, VehicleDocument } from '../types';
import { addMonthsLocal, getLocalDateString } from './dateUtils';

export type ExpiryAlertLevel =
  | 'expired' // < 0 días (Vencido)
  | 'days7'   // 0 a 7 días (Crítico <= 7d)
  | 'days15'  // 8 a 15 días (Urgente <= 15d)
  | 'days30'  // 16 a 30 días (Próximo <= 30d)
  | 'ok';     // > 30 días (En regla)

export interface DocumentExpiryAlert {
  ambulanceId: string;
  ambulanceCode: string;
  ambulancePlate: string;
  ambulanceModel: string;
  document: VehicleDocument;
  daysRemaining: number;
  level: ExpiryAlertLevel;
}

export const DOCUMENT_TYPES_ORDER: DocumentType[] = [
  'ITV',
  'Seguro',
  'Certificado Técnico-Sanitario',
  'Ficha Técnica',
];

export const calculateDaysRemaining = (expiryDate: string, todayStr?: string): number => {
  if (!expiryDate) return 9999;
  const baseToday = todayStr || getLocalDateString();
  const exp = new Date(`${expiryDate}T00:00:00`);
  const tod = new Date(`${baseToday}T00:00:00`);
  return Math.ceil((exp.getTime() - tod.getTime()) / (1000 * 3600 * 24));
};

export const getExpiryAlertLevel = (daysRemaining: number): ExpiryAlertLevel => {
  if (daysRemaining < 0) return 'expired';
  if (daysRemaining <= 7) return 'days7';
  if (daysRemaining <= 15) return 'days15';
  if (daysRemaining <= 30) return 'days30';
  return 'ok';
};

export const getExpiryBadgeMeta = (daysRemaining: number) => {
  const level = getExpiryAlertLevel(daysRemaining);
  switch (level) {
    case 'expired':
      return {
        level,
        label: `VENCIDO (${Math.abs(daysRemaining)}d)`,
        shortLabel: 'Vencido',
        badgeClass: 'bg-rose-600 text-white border-rose-700',
        cardClass: 'bg-rose-50 border-rose-300',
        textClass: 'text-rose-700',
      };
    case 'days7':
      return {
        level,
        label: `≤ 7 DÍAS (${daysRemaining}d)`,
        shortLabel: '≤ 7 días',
        badgeClass: 'bg-red-500 text-white border-red-600',
        cardClass: 'bg-red-50/80 border-red-300',
        textClass: 'text-red-700',
      };
    case 'days15':
      return {
        level,
        label: `≤ 15 DÍAS (${daysRemaining}d)`,
        shortLabel: '≤ 15 días',
        badgeClass: 'bg-orange-500 text-white border-orange-600',
        cardClass: 'bg-orange-50/80 border-orange-300',
        textClass: 'text-orange-700',
      };
    case 'days30':
      return {
        level,
        label: `≤ 30 DÍAS (${daysRemaining}d)`,
        shortLabel: '≤ 30 días',
        badgeClass: 'bg-amber-500 text-white border-amber-600',
        cardClass: 'bg-amber-50/80 border-amber-300',
        textClass: 'text-amber-700',
      };
    default:
      return {
        level,
        label: `EN REGLA (${daysRemaining}d)`,
        shortLabel: 'En regla',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        cardClass: 'bg-white border-slate-200',
        textClass: 'text-emerald-700',
      };
  }
};

/**
 * Garantiza que cualquier ambulancia (incluso cargada desde un backup antiguo)
 * disponga de los 4 documentos reglamentarios: ITV, Seguro, Certificado Técnico-Sanitario y Ficha Técnica.
 */
export const ensureAmbulanceDocuments = (amb: Ambulance): VehicleDocument[] => {
  const existing = (amb.documents || []).filter(
    (doc) => (doc.type as string) !== 'Tacógrafo'
  );
  const byType = new Map<DocumentType, VehicleDocument>();
  existing.forEach((doc) => byType.set(doc.type, doc));

  const subtractMonths = (dateStr: string, months: number): string => {
    return addMonthsLocal(dateStr, -months);
  };

  const defaults: Record<DocumentType, () => VehicleDocument> = {
    ITV: () => ({
      id: `${amb.id}-doc-itv`,
      type: 'ITV',
      number: `ITV-${amb.plate}`,
      issueDate: subtractMonths(amb.itvExpiry || '2027-03-15', 6),
      expiryDate: amb.itvExpiry || '2027-03-15',
      notes: 'Inspección Técnica de Vehículos Sanitarios',
    }),
    Seguro: () => ({
      id: `${amb.id}-doc-seg`,
      type: 'Seguro',
      number: `POL-FLOTA-${amb.code.replace('AMB-', '')}89`,
      issueDate: subtractMonths(amb.insuranceExpiry || '2027-04-30', 12),
      expiryDate: amb.insuranceExpiry || '2027-04-30',
      notes: 'Póliza responsabilidad civil y asistencia sanitaria',
    }),
    'Certificado Técnico-Sanitario': () => ({
      id: `${amb.id}-doc-san`,
      type: 'Certificado Técnico-Sanitario',
      number: `CTS-${amb.year}-${amb.code.replace('AMB-', '')}`,
      issueDate: subtractMonths(amb.sanitaryCertExpiry || '2027-05-20', 12),
      expiryDate: amb.sanitaryCertExpiry || '2027-05-20',
      notes: 'Autorización autonómica transporte sanitario por carretera',
    }),
    'Ficha Técnica': () => ({
      id: `${amb.id}-doc-fic`,
      type: 'Ficha Técnica',
      number: `TIT-${amb.vin}`,
      issueDate: `${amb.year}-01-15`,
      expiryDate: '2028-12-31',
      notes: 'Tarjeta eITV y homologación de carrozado sanitario',
    }),
  };

  return DOCUMENT_TYPES_ORDER.map((docType) => {
    const found = byType.get(docType);
    if (found) {
      // Mantener sincronizadas las fechas legacy si se editaron
      if (docType === 'ITV' && amb.itvExpiry && found.expiryDate !== amb.itvExpiry) {
        return { ...found, expiryDate: amb.itvExpiry };
      }
      if (
        docType === 'Certificado Técnico-Sanitario' &&
        amb.sanitaryCertExpiry &&
        found.expiryDate !== amb.sanitaryCertExpiry
      ) {
        return { ...found, expiryDate: amb.sanitaryCertExpiry };
      }
      if (docType === 'Seguro' && amb.insuranceExpiry && found.expiryDate !== amb.insuranceExpiry) {
        return { ...found, expiryDate: amb.insuranceExpiry };
      }
      return found;
    }
    return defaults[docType]();
  });
};

export const collectAllDocumentAlerts = (
  ambulances: Ambulance[],
  todayStr?: string
): DocumentExpiryAlert[] => {
  const alerts: DocumentExpiryAlert[] = [];

  ambulances.forEach((amb) => {
    const docs = ensureAmbulanceDocuments(amb);
    docs.forEach((doc) => {
      const daysRemaining = calculateDaysRemaining(doc.expiryDate, todayStr);
      const level = getExpiryAlertLevel(daysRemaining);
      if (level !== 'ok') {
        alerts.push({
          ambulanceId: amb.id,
          ambulanceCode: amb.code,
          ambulancePlate: amb.plate,
          ambulanceModel: `${amb.brand} ${amb.model}`,
          document: doc,
          daysRemaining,
          level,
        });
      }
    });
  });

  return alerts.sort((a, b) => a.daysRemaining - b.daysRemaining);
};
