import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Ambulance } from '../types';
import { QrCode, Printer, X, CheckSquare, Square } from 'lucide-react';

interface QrLabelsModalProps {
  ambulances: Ambulance[];
  onClose: () => void;
}

export const QrLabelsModal: React.FC<QrLabelsModalProps> = ({
  ambulances,
  onClose,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    ambulances.map((a) => a.id)
  );
  const [qrMap, setQrMap] = useState<Record<string, string>>({});

  const baseUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}`
      : 'https://mahay78.github.io/gestion-ambulancias/';

  useEffect(() => {
    let cancelled = false;
    const generateAll = async () => {
      const entries: Record<string, string> = {};
      for (const amb of ambulances) {
        const targetUrl = `${baseUrl}?amb=${encodeURIComponent(amb.code)}`;
        try {
          entries[amb.id] = await QRCode.toDataURL(targetUrl, {
            width: 220,
            margin: 1,
            color: { dark: '#0f172a', light: '#ffffff' },
          });
        } catch {
          entries[amb.id] = '';
        }
      }
      if (!cancelled) setQrMap(entries);
    };
    generateAll();
    return () => {
      cancelled = true;
    };
  }, [ambulances, baseUrl]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handlePrintA4 = () => {
    const selectedAmbs = ambulances.filter((a) => selectedIds.includes(a.id));
    if (selectedAmbs.length === 0) return;

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;

    const cardsHtml = selectedAmbs
      .map(
        (amb) => `
      <div class="label-card">
        <div class="label-header">
          <span class="code">${amb.code}</span>
          <span class="plate">${amb.plate}</span>
        </div>
        <img class="qr" src="${qrMap[amb.id] || ''}" alt="QR ${amb.code}" />
        <div class="model">${amb.brand} ${amb.model}</div>
        <div class="hint">Escanear para ficha, dotación o parte</div>
      </div>`
      )
      .join('');

    win.document.write(`<!doctype html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Etiquetas QR Flota Ambu-lz (A4)</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; }
    body { margin: 0; color: #0f172a; }
    .toolbar { padding: 10px 0 14px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #cbd5e1; margin-bottom: 12px; }
    .btn { background: #0f172a; color: #fff; border: none; padding: 8px 14px; border-radius: 8px; font-weight: 700; cursor: pointer; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8mm; }
    .label-card { border: 1.5px dashed #94a3b8; border-radius: 10px; padding: 8px; text-align: center; page-break-inside: avoid; background: #fff; }
    .label-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
    .code { font-size: 16px; font-weight: 900; color: #e11d48; }
    .plate { font-size: 12px; font-weight: 800; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; }
    .qr { width: 34mm; height: 34mm; display: block; margin: 4px auto; }
    .model { font-size: 10px; font-weight: 700; color: #334155; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .hint { font-size: 9px; color: #64748b; margin-top: 2px; }
    @media print { .toolbar { display: none; } }
  </style>
</head>
<body>
  <div class="toolbar">
    <strong>Ambu-lz — Etiquetas QR de Puerta (${selectedAmbs.length} unidades)</strong>
    <button class="btn" onclick="window.print()">Imprimir / Guardar PDF (A4)</button>
  </div>
  <div class="grid">${cardsHtml}</div>
</body>
</html>`);
    win.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Etiquetas QR Imprimibles (Formato A4)
              </h3>
              <p className="text-xs text-slate-500">
                Pega cada etiqueta en el marco de puerta para abrir su ficha al instante
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs bg-white">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIds(ambulances.map((a) => a.id))}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-slate-700"
            >
              Seleccionar todas ({ambulances.length})
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-slate-700"
            >
              Limpiar selección
            </button>
          </div>
          <button
            onClick={handlePrintA4}
            disabled={selectedIds.length === 0}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-bold flex items-center gap-2 shadow-sm"
          >
            <Printer className="w-4 h-4" />
            Imprimir / PDF A4 ({selectedIds.length})
          </button>
        </div>

        <div className="p-5 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 bg-slate-50">
          {ambulances.map((amb) => {
            const isSelected = selectedIds.includes(amb.id);
            return (
              <button
                key={amb.id}
                type="button"
                onClick={() => toggleSelect(amb.id)}
                className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center ${
                  isSelected
                    ? 'bg-white border-rose-500 ring-2 ring-rose-500/20 shadow-sm'
                    : 'bg-slate-100 border-slate-200 opacity-60'
                }`}
              >
                <div className="w-full flex items-center justify-between text-xs mb-1.5">
                  <span className="font-extrabold text-rose-600">{amb.code}</span>
                  {isSelected ? (
                    <CheckSquare className="w-4 h-4 text-rose-600" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                </div>
                {qrMap[amb.id] ? (
                  <img
                    src={qrMap[amb.id]}
                    alt={`QR ${amb.code}`}
                    className="w-24 h-24 rounded-lg border border-slate-100"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-lg bg-slate-200 animate-pulse" />
                )}
                <span className="mt-1.5 text-[11px] font-bold text-slate-800">
                  {amb.plate}
                </span>
                <span className="text-[10px] text-slate-500 truncate w-full">
                  {amb.brand} {amb.model}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
