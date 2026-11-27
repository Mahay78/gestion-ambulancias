import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { SparePart } from '../types';
import { X, Printer, QrCode } from 'lucide-react';

interface WarehouseQrLabelsModalProps {
  spareParts: SparePart[];
  onClose: () => void;
}

export const WarehouseQrLabelsModal: React.FC<WarehouseQrLabelsModalProps> = ({
  spareParts,
  onClose,
}) => {
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const [locationFilter, setLocationFilter] = useState('');

  const filtered = spareParts.filter(
    (p) =>
      !locationFilter.trim() ||
      p.warehouseLocation.toLowerCase().includes(locationFilter.toLowerCase()) ||
      p.name.toLowerCase().includes(locationFilter.toLowerCase()) ||
      p.sku.toLowerCase().includes(locationFilter.toLowerCase())
  );

  useEffect(() => {
    let cancelled = false;
    const generate = async () => {
      const entries: Record<string, string> = {};
      for (const p of filtered) {
        try {
          const payload = p.sku || p.id;
          entries[p.id] = await QRCode.toDataURL(payload, {
            width: 140,
            margin: 1,
          });
        } catch {
          // ignore single QR error
        }
      }
      if (!cancelled) setQrMap(entries);
    };
    void generate();
    return () => {
      cancelled = true;
    };
  }, [filtered.map((p) => p.id).join(',')]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">
                Etiquetas QR de Almacén y Repuestos (A4)
              </h3>
              <p className="text-xs text-slate-500">
                Pégalas en estanterías y cajas para escanear entradas/salidas al instante
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              placeholder="Filtrar estantería o SKU..."
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-slate-50"
            />
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" /> Imprimir A4
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="border border-slate-300 rounded-xl p-3 flex flex-col items-center text-center gap-1.5 bg-white break-inside-avoid"
            >
              {qrMap[p.id] ? (
                <img
                  src={qrMap[p.id]}
                  alt={p.sku}
                  className="w-24 h-24 object-contain"
                />
              ) : (
                <div className="w-24 h-24 bg-slate-100 rounded animate-pulse" />
              )}
              <span className="text-[11px] font-black text-slate-900 leading-tight line-clamp-2">
                {p.name}
              </span>
              <span className="text-[10px] font-mono font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                {p.sku}
              </span>
              <span className="text-[10px] text-blue-700 font-semibold line-clamp-1">
                {p.warehouseLocation}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
