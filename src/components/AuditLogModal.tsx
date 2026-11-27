import React from 'react';
import { AuditLogEntry } from '../types';
import { History, X, Download } from 'lucide-react';
import { getLocalDateString } from '../utils/dateUtils';

interface AuditLogModalProps {
  logs: AuditLogEntry[];
  onClose: () => void;
}

export const AuditLogModal: React.FC<AuditLogModalProps> = ({
  logs,
  onClose,
}) => {
  const handleExportCsv = () => {
    const header = 'FECHA_HORA,ROL,ACCION,OBJETIVO,DETALLES';
    const rows = logs.map((l) =>
      [l.timestamp, l.role, l.action, l.target, l.details]
        .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
        .join(',')
    );
    const blob = new Blob(['\uFEFF' + [header, ...rows].join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ambu-lzflota_auditoria_${getLocalDateString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden">
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="text-sm font-extrabold">
                Registro de Auditoría ({logs.length} eventos)
              </h3>
              <p className="text-[11px] text-slate-300">
                Trazabilidad de bajas, cambios de estado, km, órdenes y stock
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {logs.length > 0 && (
              <button
                type="button"
                onClick={handleExportCsv}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                CSV
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-4 overflow-y-auto space-y-2 text-xs">
          {logs.length === 0 ? (
            <p className="text-center text-slate-500 py-8">
              Aún no se han registrado eventos de auditoría en esta sesión.
            </p>
          ) : (
            logs.map((entry) => (
              <div
                key={entry.id}
                className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-slate-900 text-white text-[10px] font-bold">
                      {entry.role}
                    </span>
                    <strong className="text-slate-900">{entry.action}</strong>
                    <span className="text-blue-700 font-bold">
                      {entry.target}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    {entry.details}
                  </p>
                </div>
                <span className="text-[10px] font-mono text-slate-500">
                  {new Date(entry.timestamp).toLocaleString('es-ES')}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
