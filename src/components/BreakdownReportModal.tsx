import React, { useMemo, useState } from 'react';
import { Ambulance, ExternalWorkshop, FleetChecklist, WorkOrder } from '../types';
import { getLocalDateString } from '../utils/dateUtils';
import { getSavedBossEmail, saveBossEmail } from '../utils/storage';
import { sendEmailViaLinkedGmail } from '../utils/driveSync';
import {
  BreakdownReportRow,
  printBreakdownsManagementReport,
} from '../utils/shareAndPrint';
import {
  FileText,
  Mail,
  MessageCircle,
  Printer,
  X,
  CheckCircle2,
} from 'lucide-react';

interface BreakdownReportModalProps {
  ambulances: Ambulance[];
  workOrders: WorkOrder[];
  checklists: FleetChecklist[];
  workshops: ExternalWorkshop[];
  onClose: () => void;
}

export const BreakdownReportModal: React.FC<BreakdownReportModalProps> = ({
  ambulances,
  workOrders,
  checklists,
  workshops,
  onClose,
}) => {
  const today = getLocalDateString();
  const thirtyDaysAgo = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return getLocalDateString(d);
  })();

  const [bossEmail, setBossEmail] = useState(() => getSavedBossEmail());
  const [emailSaved, setEmailSaved] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSendStatus, setEmailSendStatus] = useState('');
  const [fromDate, setFromDate] = useState(thirtyDaysAgo);
  const [toDate, setToDate] = useState(today);
  const [selectedAmbId, setSelectedAmbId] = useState<string>('Todas');

  const rows = useMemo<BreakdownReportRow[]>(() => {
    const list: BreakdownReportRow[] = [];

    workOrders.forEach((wo) => {
      const dateStr = wo.entryDate || wo.createdAt;
      if (fromDate && dateStr < fromDate) return;
      if (toDate && dateStr > toDate) return;
      if (selectedAmbId !== 'Todas' && wo.ambulanceId !== selectedAmbId) return;

      const amb = ambulances.find((a) => a.id === wo.ambulanceId);
      const ws = workshops.find((w) => w.id === wo.workshopId);
      const start = new Date(`${dateStr}T00:00:00`);
      const end = wo.exitDate
        ? new Date(`${wo.exitDate}T00:00:00`)
        : new Date(`${today}T00:00:00`);
      const days = Math.max(
        0,
        Math.round((end.getTime() - start.getTime()) / (1000 * 3600 * 24))
      );

      list.push({
        date: dateStr,
        code: wo.code,
        ambulanceCode: amb?.code || '?',
        plate: amb?.plate || '',
        mileage: wo.mileageAtEntry,
        title: wo.title,
        workshopName: ws?.name || 'Por asignar',
        status: wo.status,
        daysInShop: isNaN(days) ? 0 : days,
        partsSummary:
          wo.partsUsed.length > 0
            ? wo.partsUsed
                .map((p) => `${p.partName} (x${p.quantity})`)
                .join(', ')
            : '',
      });
    });

    // Incluir partes/checklists con avería que aún no tengan orden externa asociada
    checklists.forEach((chk) => {
      if (chk.linkedWorkOrderId) return;
      const hasBreakdown =
        chk.items.some((i) => i.status === 'Avería') ||
        chk.generalObservations.includes('[PARTE UNIDAD');
      if (!hasBreakdown) return;
      if (fromDate && chk.date < fromDate) return;
      if (toDate && chk.date > toDate) return;
      if (selectedAmbId !== 'Todas' && chk.ambulanceId !== selectedAmbId)
        return;

      const amb = ambulances.find((a) => a.id === chk.ambulanceId);
      list.push({
        date: chk.date,
        code: 'PARTE',
        ambulanceCode: amb?.code || '?',
        plate: amb?.plate || '',
        mileage: chk.mileageAtInspection,
        title:
          chk.generalObservations ||
          chk.items.find((i) => i.status === 'Avería')?.label ||
          'Avería reportada',
        workshopName: 'Pendiente de taller',
        status: chk.workshopStatus,
        daysInShop: 0,
        partsSummary: '',
      });
    });

    return list.sort((a, b) => (b.date > a.date ? 1 : -1));
  }, [workOrders, checklists, ambulances, workshops, fromDate, toDate, selectedAmbId, today]);

  const totalUnitsAffected = useMemo(
    () => new Set(rows.map((r) => r.ambulanceCode)).size,
    [rows]
  );
  const totalDaysInShop = useMemo(
    () => rows.reduce((sum, r) => sum + r.daysInShop, 0),
    [rows]
  );
  const openCount = useMemo(
    () =>
      rows.filter(
        (r) => r.status !== 'Cerrada' && r.status !== 'Archivada / OK'
      ).length,
    [rows]
  );

  const selectedAmbLabel =
    selectedAmbId === 'Todas'
      ? 'Toda la flota (21 unidades)'
      : (() => {
          const a = ambulances.find((x) => x.id === selectedAmbId);
          return a ? `${a.code} (${a.plate})` : 'Unidad';
        })();

  const buildTextSummary = () => {
    const header = [
      `INFORME DE ROTURAS Y AVERÍAS — AMBU-LZFLOTA`,
      `Periodo: ${fromDate || 'Inicio'} a ${toDate || today} | Filtro: ${selectedAmbLabel}`,
      `Resumen: ${rows.length} roturas | ${totalUnitsAffected} unidades afectadas | ${openCount} abiertas | ${totalDaysInShop} días en taller`,
      ``,
    ];
    const body =
      rows.length > 0
        ? rows.map(
            (r) =>
              `• ${r.date} | ${r.ambulanceCode} (${r.plate}) | [${r.code}] ${r.title} — ${r.workshopName} (${r.status}, ${r.daysInShop}d)`
          )
        : ['• Sin roturas registradas en este periodo.'];
    return [...header, ...body].join('\n');
  };

  const handleSaveEmail = () => {
    saveBossEmail(bossEmail);
    setEmailSaved(true);
    setTimeout(() => setEmailSaved(false), 2500);
  };

  const handleSendDirectGmail = async () => {
    const cleanTo = bossEmail.trim();
    if (!cleanTo) {
      setEmailSendStatus('⚠️ Introduce primero el correo electrónico de tu jefe.');
      return;
    }
    saveBossEmail(cleanTo);
    setIsSendingEmail(true);
    setEmailSendStatus('Enviando correo desde flotaambulz@gmail.com...');

    const subject = `Informe de Roturas Ambu-lzflota (${fromDate} a ${toDate})`;
    const body = buildTextSummary();
    const htmlRows = rows
      .map(
        (r) =>
          `<tr><td style="padding:6px;border:1px solid #cbd5e1;">${r.date}</td><td style="padding:6px;border:1px solid #cbd5e1;"><b>${r.ambulanceCode}</b> (${r.plate})</td><td style="padding:6px;border:1px solid #cbd5e1;">${r.code}: ${r.title}</td><td style="padding:6px;border:1px solid #cbd5e1;">${r.workshopName}</td><td style="padding:6px;border:1px solid #cbd5e1;">${r.status} (${r.daysInShop}d)</td></tr>`
      )
      .join('');
    const htmlBody = `<div style="font-family:sans-serif;color:#0f172a;"><h2>Informe de Roturas — Ambu-lzflota</h2><p><b>Periodo:</b> ${fromDate} a ${toDate} | <b>Filtro:</b> ${selectedAmbLabel}</p><p><b>Resumen:</b> ${rows.length} roturas | ${totalUnitsAffected} unidades afectadas | ${openCount} abiertas | ${totalDaysInShop} días en taller</p><table style="border-collapse:collapse;width:100%;font-size:12px;"><thead><tr style="background:#0f172a;color:#fff;"><th style="padding:6px;">Fecha</th><th style="padding:6px;">Unidad</th><th style="padding:6px;">Rotura</th><th style="padding:6px;">Taller</th><th style="padding:6px;">Estado</th></tr></thead><tbody>${htmlRows}</tbody></table></div>`;

    const res = await sendEmailViaLinkedGmail({
      to: cleanTo,
      subject,
      body,
      htmlBody,
    });
    setIsSendingEmail(false);
    if (res.ok) {
      setEmailSendStatus(
        `✅ Correo enviado correctamente desde ${res.sentFrom || 'flotaambulz@gmail.com'} a ${cleanTo}.`
      );
    } else {
      setEmailSendStatus(
        `⚠️ ${res.error} (Si acabas de actualizar el script, recuerda crear una Nueva versión en Implementar -> Gestionar implementaciones).`
      );
    }
  };

  const handleSendMailto = () => {
    saveBossEmail(bossEmail);
    const subject = `Informe de Roturas Ambu-lzflota (${fromDate} a ${toDate})`;
    const body = buildTextSummary();
    window.location.href = `mailto:${encodeURIComponent(
      bossEmail.trim()
    )}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handleSendWhatsApp = () => {
    const text = buildTextSummary();
    window.open(
      `https://wa.me/?text=${encodeURIComponent(text)}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-rose-400" />
            <div>
              <h3 className="text-sm font-extrabold">
                Informe de Roturas para Dirección / Jefe
              </h3>
              <p className="text-[11px] text-slate-300">
                Genera PDF o envía el resumen directamente por correo electrónico
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Correo de Dirección */}
          <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 space-y-2">
            <label className="font-bold text-slate-800 flex items-center gap-1.5">
              <Mail className="w-4 h-4 text-blue-600" />
              Correo electrónico del destinatario (Jefe / Dirección)
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                type="email"
                value={bossEmail}
                onChange={(e) => {
                  setBossEmail(e.target.value);
                  setEmailSaved(false);
                }}
                placeholder="jefe@empresa.es"
                className="flex-1 min-w-[200px] px-3 py-2 rounded-lg border border-blue-300 bg-white font-semibold"
              />
              <button
                type="button"
                onClick={handleSaveEmail}
                className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1"
              >
                {emailSaved ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Guardado
                  </>
                ) : (
                  'Guardar Correo'
                )}
              </button>
            </div>
          </div>

          {/* Filtros */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div>
              <label className="font-bold text-slate-600 block mb-1">Desde</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold"
              />
            </div>
            <div>
              <label className="font-bold text-slate-600 block mb-1">Hasta</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold"
              />
            </div>
            <div>
              <label className="font-bold text-slate-600 block mb-1">
                Ambulancia
              </label>
              <select
                value={selectedAmbId}
                onChange={(e) => setSelectedAmbId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold"
              >
                <option value="Todas">Todas (21 unidades)</option>
                {ambulances.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} - {a.plate}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* KPIs rápidos */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[10px] text-slate-500 font-bold uppercase">
                Roturas
              </div>
              <div className="text-lg font-extrabold text-slate-900">
                {rows.length}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[10px] text-slate-500 font-bold uppercase">
                Unidades
              </div>
              <div className="text-lg font-extrabold text-slate-900">
                {totalUnitsAffected}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200">
              <div className="text-[10px] text-rose-700 font-bold uppercase">
                Abiertas
              </div>
              <div className="text-lg font-extrabold text-rose-700">
                {openCount}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
              <div className="text-[10px] text-amber-800 font-bold uppercase">
                Días Taller
              </div>
              <div className="text-lg font-extrabold text-amber-800">
                {totalDaysInShop}d
              </div>
            </div>
          </div>

          {/* Vista previa */}
          <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
            {rows.length === 0 ? (
              <div className="p-6 text-center text-slate-500">
                No hay roturas en las fechas seleccionadas.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-[11px]">
                <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0">
                  <tr>
                    <th className="p-2">Fecha</th>
                    <th className="p-2">Unidad</th>
                    <th className="p-2">Rotura / Motivo</th>
                    <th className="p-2">Taller</th>
                    <th className="p-2 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r, i) => (
                    <tr key={`${r.code}-${i}`}>
                      <td className="p-2 whitespace-nowrap">{r.date}</td>
                      <td className="p-2 font-bold">
                        {r.ambulanceCode}{' '}
                        <span className="font-normal text-slate-500">
                          ({r.plate})
                        </span>
                      </td>
                      <td className="p-2">{r.title}</td>
                      <td className="p-2 text-slate-600">{r.workshopName}</td>
                      <td className="p-2 text-center font-bold">{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Acciones de exportación y envío */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 space-y-2 text-xs">
          {emailSendStatus && (
            <p className="text-[11px] font-semibold text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2">
              {emailSendStatus}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() =>
                printBreakdownsManagementReport({
                  fromDate,
                  toDate,
                  ambulanceLabel: selectedAmbLabel,
                  bossEmail: bossEmail.trim(),
                  rows,
                  totalUnitsAffected,
                  totalDaysInShop,
                  openCount,
                })
              }
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              PDF / Imprimir
            </button>
            <button
              type="button"
              disabled={isSendingEmail}
              onClick={handleSendDirectGmail}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1.5"
            >
              <Mail className="w-4 h-4" />
              {isSendingEmail ? 'Enviando...' : 'Enviar Directo (flotaambulz)'}
            </button>
            <button
              type="button"
              onClick={handleSendMailto}
              className="px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold flex items-center gap-1.5"
              title="Abrir tu aplicación de correo local"
            >
              App Correo
            </button>
            <button
              type="button"
              onClick={handleSendWhatsApp}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5"
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
