import React, { useMemo } from 'react';
import {
  Ambulance,
  ExternalWorkshop,
  PreventiveSchedule,
  SparePart,
  WorkOrder,
} from '../types';
import { collectAllDocumentAlerts } from '../utils/expiryAlerts';
import { getLocalDateString } from '../utils/dateUtils';
import { detectActiveWarranties } from '../utils/warrantyDetector';
import { Bell, AlertTriangle, ArrowRight, X, CheckCircle2 } from 'lucide-react';

interface UnifiedAlert {
  id: string;
  severity: 'critical' | 'warning';
  category: string;
  title: string;
  detail: string;
  targetTab: 'fleet' | 'preventive' | 'parts' | 'workorders';
  ambulanceId?: string;
}

export const buildUnifiedAlerts = (params: {
  ambulances: Ambulance[];
  preventiveSchedules: PreventiveSchedule[];
  spareParts: SparePart[];
  workOrders: WorkOrder[];
  workshops: ExternalWorkshop[];
}): UnifiedAlert[] => {
  const today = getLocalDateString();
  const alerts: UnifiedAlert[] = [];

  // 1. Documentos <= 30d / vencidos
  collectAllDocumentAlerts(params.ambulances, today).forEach((d) => {
    alerts.push({
      id: `doc-${d.ambulanceId}-${d.document.id}`,
      severity:
        d.level === 'expired' || d.level === 'days7' ? 'critical' : 'warning',
      category: 'Documentación',
      title: `${d.ambulanceCode} (${d.ambulancePlate}) — ${d.document.type}`,
      detail:
        d.daysRemaining < 0
          ? `Vencido hace ${Math.abs(d.daysRemaining)} días (${d.document.expiryDate})`
          : `Vence en ${d.daysRemaining} días (${d.document.expiryDate})`,
      targetTab: 'fleet',
      ambulanceId: d.ambulanceId,
    });
  });

  // 2. Preventivos vencidos o próximos
  params.preventiveSchedules.forEach((ps) => {
    const amb = params.ambulances.find((a) => a.id === ps.ambulanceId);
    if (!amb) return;
    const remKm = ps.nextDueKm ? ps.nextDueKm - amb.mileage : null;
    const diffDays = ps.nextDueDate
      ? Math.ceil(
          (new Date(`${ps.nextDueDate}T00:00:00`).getTime() -
            new Date(`${today}T00:00:00`).getTime()) /
            (1000 * 3600 * 24)
        )
      : null;
    const overdue =
      (remKm !== null && remKm <= 0) || (diffDays !== null && diffDays < 0);
    const soon =
      (remKm !== null && remKm <= 2500) || (diffDays !== null && diffDays <= 25);

    if (overdue || soon) {
      alerts.push({
        id: `prev-${ps.id}`,
        severity: overdue ? 'critical' : 'warning',
        category: 'Preventivo',
        title: `${amb.code} — ${ps.title}`,
        detail: overdue
          ? 'Mantenimiento vencido'
          : `Próximo (${remKm !== null ? `${remKm.toLocaleString()} km` : ps.nextDueDate})`,
        targetTab: 'preventive',
        ambulanceId: amb.id,
      });
    }
  });

  // 3. Neumáticos críticos y baterías bajas
  params.ambulances.forEach((amb) => {
    (amb.tires || [])
      .filter((t) => t.treadDepthMm < 3)
      .forEach((t) => {
        alerts.push({
          id: `tire-${amb.id}-${t.position}`,
          severity: 'critical',
          category: 'Neumáticos',
          title: `${amb.code} — ${t.label} (${t.treadDepthMm} mm)`,
          detail: 'Dibujo por debajo de 3 mm',
          targetTab: 'fleet',
          ambulanceId: amb.id,
        });
      });

    if (
      amb.batteries &&
      (amb.batteries.starterStatus !== 'OK' || amb.batteries.auxStatus !== 'OK')
    ) {
      alerts.push({
        id: `batt-${amb.id}`,
        severity:
          amb.batteries.starterStatus === 'Crítica' ||
          amb.batteries.auxStatus === 'Crítica'
            ? 'critical'
            : 'warning',
        category: 'Baterías',
        title: `${amb.code} — Tensión baja en batería`,
        detail: `Motor: ${amb.batteries.starterVoltage}V | Aux AGM: ${amb.batteries.auxVoltage}V`,
        targetTab: 'fleet',
        ambulanceId: amb.id,
      });
    }
  });

  // 4. Stock bajo mínimos
  params.spareParts
    .filter((p) => p.stockQuantity <= p.minStockAlert)
    .forEach((p) => {
      alerts.push({
        id: `stock-${p.id}`,
        severity: p.stockQuantity === 0 ? 'critical' : 'warning',
        category: 'Almacén',
        title: `${p.name} (${p.sku})`,
        detail: `Stock: ${p.stockQuantity} uds. (mínimo: ${p.minStockAlert})`,
        targetTab: 'parts',
      });
    });

  // 5. Garantías próximas a caducar (revisión post-reparación <= 20 días)
  params.ambulances.forEach((amb) => {
    detectActiveWarranties(
      amb.id,
      amb.mileage,
      params.workOrders,
      params.workshops
    )
      .filter((w) => w.daysRemaining !== null && w.daysRemaining <= 20)
      .forEach((w) => {
        alerts.push({
          id: `war-${w.workOrder.id}`,
          severity: 'warning',
          category: 'Revisión Garantía',
          title: `${amb.code} — ${w.workOrder.code} (${w.workshop?.name || 'Taller'})`,
          detail: `Quedan ${w.daysRemaining} días de garantía (${w.warrantyText}). Verifica si hay reincidencia.`,
          targetTab: 'workorders',
        });
      });
  });

  return alerts.sort((a, b) =>
    a.severity === b.severity ? 0 : a.severity === 'critical' ? -1 : 1
  );
};

interface AlertCenterModalProps {
  ambulances: Ambulance[];
  preventiveSchedules: PreventiveSchedule[];
  spareParts: SparePart[];
  workOrders: WorkOrder[];
  workshops: ExternalWorkshop[];
  onNavigate: (
    tab: 'fleet' | 'preventive' | 'parts' | 'workorders',
    ambulanceId?: string
  ) => void;
  onClose: () => void;
}

export const AlertCenterModal: React.FC<AlertCenterModalProps> = ({
  ambulances,
  preventiveSchedules,
  spareParts,
  workOrders,
  workshops,
  onNavigate,
  onClose,
}) => {
  const alerts = useMemo(
    () =>
      buildUnifiedAlerts({
        ambulances,
        preventiveSchedules,
        spareParts,
        workOrders,
        workshops,
      }),
    [ambulances, preventiveSchedules, spareParts, workOrders, workshops]
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Bell className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-sm font-extrabold">
                Centro de Alertas Único ({alerts.length})
              </h3>
              <p className="text-[11px] text-slate-300">
                Documentos, preventivos, neumáticos, baterías, stock y garantías
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

        <div className="p-4 overflow-y-auto space-y-2 text-xs">
          {alerts.length === 0 ? (
            <div className="py-10 text-center text-emerald-700 font-bold flex flex-col items-center gap-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              Sin alertas activas en toda la flota.
            </div>
          ) : (
            alerts.map((al) => (
              <div
                key={al.id}
                className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                  al.severity === 'critical'
                    ? 'bg-rose-50 border-rose-200'
                    : 'bg-amber-50/70 border-amber-200'
                }`}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <AlertTriangle
                    className={`w-4 h-4 shrink-0 mt-0.5 ${
                      al.severity === 'critical'
                        ? 'text-rose-600'
                        : 'text-amber-600'
                    }`}
                  />
                  <div className="min-w-0">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                      {al.category}
                    </span>
                    <p className="font-bold text-slate-900">{al.title}</p>
                    <p className="text-[11px] text-slate-600">{al.detail}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onNavigate(al.targetTab, al.ambulanceId);
                    onClose();
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-bold text-[11px] flex items-center gap-1 shrink-0"
                >
                  Ver <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
