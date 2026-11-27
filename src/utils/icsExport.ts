import { Ambulance, PreventiveSchedule } from '../types';
import { ensureAmbulanceDocuments } from './expiryAlerts';

const pad2 = (n: number): string => String(n).padStart(2, '0');

const toIcsDate = (dateStr: string): string => {
  return dateStr.replace(/-/g, '');
};

const addDaysIcs = (dateStr: string, days: number): string => {
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return toIcsDate(dateStr);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
};

const escapeIcsText = (text: string): string => {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
};

/**
 * Genera un archivo .ICS (RFC 5545) con todos los vencimientos documentales
 * y mantenimientos preventivos programados de las 21 ambulancias.
 */
export const exportFleetCalendarIcs = (
  ambulances: Ambulance[],
  preventiveSchedules: PreventiveSchedule[]
): void => {
  const nowStamp =
    new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ambu-lz//Gestion Flota Ambulancias//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Ambu-lz - Vencimientos y Preventivos',
  ];

  ambulances.forEach((amb) => {
    const docs = ensureAmbulanceDocuments(amb);
    docs.forEach((doc) => {
      if (!doc.expiryDate) return;
      const dtStart = toIcsDate(doc.expiryDate);
      const dtEnd = addDaysIcs(doc.expiryDate, 1);
      lines.push(
        'BEGIN:VEVENT',
        `UID:doc-${amb.id}-${doc.id}@ambufleet`,
        `DTSTAMP:${nowStamp}`,
        `DTSTART;VALUE=DATE:${dtStart}`,
        `DTEND;VALUE=DATE:${dtEnd}`,
        `SUMMARY:${escapeIcsText(`[${amb.code}] Vence ${doc.type} (${amb.plate})`)}`,
        `DESCRIPTION:${escapeIcsText(
          `Unidad: ${amb.code} - ${amb.brand} ${amb.model} (${amb.plate})\nDocumento: ${doc.type} (${doc.number})\nBase: ${amb.baseLocation}`
        )}`,
        'BEGIN:VALARM',
        'TRIGGER:-P15D',
        'ACTION:DISPLAY',
        `DESCRIPTION:${escapeIcsText(`Aviso 15 días: ${amb.code} ${doc.type}`)}`,
        'END:VALARM',
        'BEGIN:VALARM',
        'TRIGGER:-P7D',
        'ACTION:DISPLAY',
        `DESCRIPTION:${escapeIcsText(`Urgente 7 días: ${amb.code} ${doc.type}`)}`,
        'END:VALARM',
        'END:VEVENT'
      );
    });
  });

  preventiveSchedules.forEach((ps) => {
    if (!ps.nextDueDate) return;
    const amb = ambulances.find((a) => a.id === ps.ambulanceId);
    const dtStart = toIcsDate(ps.nextDueDate);
    const dtEnd = addDaysIcs(ps.nextDueDate, 1);
    lines.push(
      'BEGIN:VEVENT',
      `UID:prev-${ps.id}@ambufleet`,
      `DTSTAMP:${nowStamp}`,
      `DTSTART;VALUE=DATE:${dtStart}`,
      `DTEND;VALUE=DATE:${dtEnd}`,
      `SUMMARY:${escapeIcsText(
        `[${amb?.code || 'AMB'}] Preventivo: ${ps.title}`
      )}`,
      `DESCRIPTION:${escapeIcsText(
        `Categoría: ${ps.category}\nUnidad: ${amb?.code || ''} (${amb?.plate || ''})\nNotas: ${ps.notes || 'Revisión programada'}`
      )}`,
      'BEGIN:VALARM',
      'TRIGGER:-P7D',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeIcsText(`Preventivo en 7 días: ${amb?.code || ''} ${ps.title}`)}`,
      'END:VALARM',
      'END:VEVENT'
    );
  });

  lines.push('END:VCALENDAR');

  const blob = new Blob([lines.join('\r\n')], {
    type: 'text/calendar;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Ambu-lz_Vencimientos_${new Date().toISOString().split('T')[0]}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
