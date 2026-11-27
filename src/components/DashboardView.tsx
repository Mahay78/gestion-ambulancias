import React, { useState } from 'react';
import {
  Ambulance,
  PreventiveSchedule,
  FleetChecklist,
  WorkOrder,
  SparePart,
} from '../types';
import {
  collectAllDocumentAlerts,
  getExpiryBadgeMeta,
} from '../utils/expiryAlerts';
import { getLocalDateString } from '../utils/dateUtils';
import { exportFleetCalendarIcs } from '../utils/icsExport';
import {
  checkAndNotifyCriticalExpiries,
  getNotificationPermission,
  requestNotificationPermission,
} from '../utils/notifications';
import {
  Truck,
  Wrench,
  AlertTriangle,
  ClipboardCheck,
  Package,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
  Gauge,
  FileWarning,
  CalendarPlus,
  Bell,
  FileText,
} from 'lucide-react';

interface DashboardViewProps {
  ambulances: Ambulance[];
  preventiveSchedules: PreventiveSchedule[];
  checklists: FleetChecklist[];
  workOrders: WorkOrder[];
  spareParts: SparePart[];
  onNavigate: (
    tab:
      | 'dashboard'
      | 'fleet'
      | 'preventive'
      | 'checklist'
      | 'workorders'
      | 'workshops'
      | 'parts'
  ) => void;
  onCreateWorkOrderFromChecklist: (checklist: FleetChecklist) => void;
  onOpenBreakdownReport?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  ambulances,
  preventiveSchedules,
  checklists,
  workOrders,
  spareParts,
  onNavigate,
  onCreateWorkOrderFromChecklist,
  onOpenBreakdownReport,
}) => {
  const availableCount = ambulances.filter((a) => a.status === 'Disponible').length;
  const workshopCount = ambulances.filter((a) => a.status === 'En taller').length;
  const outOfServiceCount = ambulances.filter(
    (a) => a.status === 'Fuera de servicio'
  ).length;

  const openWorkOrders = workOrders.filter((w) => w.status !== 'Cerrada');
  const [notifyFeedback, setNotifyFeedback] = useState<string>('');
  const [notifPerm, setNotifPerm] = useState<string>(() =>
    getNotificationPermission()
  );

  const handleEnableNotifications = async () => {
    const perm = await requestNotificationPermission();
    setNotifPerm(perm);
    if (perm === 'granted') {
      const res = await checkAndNotifyCriticalExpiries(ambulances, true);
      setNotifyFeedback(
        res.criticalCount > 0
          ? `Notificación enviada (${res.criticalCount} alertas críticas).`
          : res.summary
      );
    } else {
      setNotifyFeedback(
        'Permiso de notificaciones denegado o no soportado en este navegador.'
      );
    }
  };
  const pendingChecklists = checklists.filter(
    (c) => c.workshopStatus === 'Pendiente de Asignar Taller'
  );
  const lowStockParts = spareParts.filter((p) => p.stockQuantity <= p.minStockAlert);

  // Calcular alertas de vencimientos documentales (ITV, Seguro, Cert. Técnico-Sanitario, Ficha Técnica) a 30/15/7 días y vencidos
  const documentAlerts = collectAllDocumentAlerts(ambulances);
  const expiredDocsCount = documentAlerts.filter((a) => a.level === 'expired').length;
  const days7DocsCount = documentAlerts.filter((a) => a.level === 'days7').length;
  const days15DocsCount = documentAlerts.filter((a) => a.level === 'days15').length;
  const days30DocsCount = documentAlerts.filter((a) => a.level === 'days30').length;

  // Calcular alertas de mantenimiento preventivo (por km o fecha)
  const today = getLocalDateString();
  const preventiveAlerts = preventiveSchedules
    .map((sched) => {
      const amb = ambulances.find((a) => a.id === sched.ambulanceId);
      if (!amb) return null;

      let status: 'overdue' | 'soon' | 'ok' = 'ok';
      let reason = '';

      if (sched.nextDueKm) {
        const remainingKm = sched.nextDueKm - amb.mileage;
        if (remainingKm <= 0) {
          status = 'overdue';
          reason = `Excedido por ${Math.abs(remainingKm).toLocaleString()} km`;
        } else if (remainingKm <= 2500) {
          status = 'soon';
          reason = `Faltan ${remainingKm.toLocaleString()} km`;
        }
      }

      if (sched.nextDueDate && status !== 'overdue') {
        const diffDays = Math.ceil(
          (new Date(sched.nextDueDate).getTime() - new Date(today).getTime()) / (1000 * 3600 * 24)
        );
        if (diffDays < 0) {
          status = 'overdue';
          reason = `Vencido hace ${Math.abs(diffDays)} días (${sched.nextDueDate})`;
        } else if (diffDays <= 25 && status === 'ok') {
          status = 'soon';
          reason = `Vence en ${diffDays} días (${sched.nextDueDate})`;
        }
      }

      return { sched, amb, status, reason };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null && item.status !== 'ok');

  // Órdenes cerradas y urgentes
  const completedWorkOrdersCount = workOrders.filter(
    (w) => w.status === 'Cerrada'
  ).length;
  const criticalWorkOrdersCount = openWorkOrders.filter(
    (w) => w.priority === 'Crítica (Urgente)' || w.priority === 'Alta'
  ).length;

  // Piezas faltantes en dotación de vehículos
  const vehiclesWithMissingOnboard = ambulances.filter((amb) =>
    amb.onboardParts.some((p) => p.currentQty < p.requiredQty)
  );

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          role="button"
          tabIndex={0}
          onClick={() => onNavigate('fleet')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onNavigate('fleet');
            }
          }}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Disponibilidad de Flota ({ambulances.length})
              </p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {availableCount} / {ambulances.length} Disponibles
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Truck className="w-6 h-6" />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium">
            <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
              {workshopCount} en taller
            </span>
            <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">
              {outOfServiceCount} fuera de servicio
            </span>
          </div>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => onNavigate('checklist')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onNavigate('checklist');
            }
          }}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Incidencias / Checklists
              </p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {pendingChecklists.length} Sin Asignar
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <ClipboardCheck className="w-6 h-6" />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {checklists.length} partes registrados •{' '}
            <span className="text-blue-600 font-medium">Generan orden externa</span>
          </p>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => onNavigate('workorders')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onNavigate('workorders');
            }
          }}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Órdenes Externas (Talleres)
              </p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {openWorkOrders.length} Abiertas
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Wrench className="w-6 h-6" />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {criticalWorkOrdersCount} prioritarias •{' '}
            <span className="font-semibold text-emerald-700">
              {completedWorkOrdersCount} cerradas
            </span>
          </p>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => onNavigate('parts')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onNavigate('parts');
            }
          }}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Stock Taller y Vehículos
              </p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {lowStockParts.length} Alertas Stock
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Package className="w-6 h-6" />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {vehiclesWithMissingOnboard.length} ambulancias con piezas a bordo incompletas
          </p>
        </div>
      </div>

      {/* Panel de Alertas de Documentación y Vencimientos (30 / 15 / 7 días y Vencidos) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <FileWarning className="w-5 h-5 text-rose-600" />
            <div>
              <h2 className="font-bold text-slate-800">
                Alertas de Vencimientos Documentales (ITV, Seguro, Técnico-Sanitario y Ficha Técnica)
              </h2>
              <p className="text-xs text-slate-500">
                Avisos automáticos escalonados a 30 días, 15 días, 7 días y documentos vencidos
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <span className="px-2.5 py-1 rounded-full bg-rose-600 text-white">
              Vencidos: {expiredDocsCount}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-red-500 text-white">
              ≤ 7 días: {days7DocsCount}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-orange-500 text-white">
              ≤ 15 días: {days15DocsCount}
            </span>
            <span className="px-2.5 py-1 rounded-full bg-amber-500 text-white">
              ≤ 30 días: {days30DocsCount}
            </span>
            {onOpenBreakdownReport && (
              <button
                type="button"
                onClick={onOpenBreakdownReport}
                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold flex items-center gap-1"
                title="Generar informe de roturas en PDF o enviar por Email al Jefe"
              >
                <FileText className="w-3.5 h-3.5" />
                Informe Roturas (Jefe)
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                exportFleetCalendarIcs(ambulances, preventiveSchedules)
              }
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold flex items-center gap-1"
              title="Descargar vencimientos y preventivos en formato calendario .ICS"
            >
              <CalendarPlus className="w-3.5 h-3.5" />
              Exportar .ICS
            </button>
            <button
              type="button"
              onClick={handleEnableNotifications}
              className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 border ${
                notifPerm === 'granted'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
              }`}
              title="Activar o probar notificaciones locales PWA de vencimientos críticos"
            >
              <Bell className="w-3.5 h-3.5" />
              {notifPerm === 'granted' ? 'Probar Aviso PWA' : 'Activar Avisos PWA'}
            </button>
            <button
              onClick={() => onNavigate('fleet')}
              className="ml-1 text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
            >
              Gestionar Documentos <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {notifyFeedback && (
            <div className="w-full text-[11px] font-semibold text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
              {notifyFeedback}
            </div>
          )}
        </div>

        <div className="p-5">
          {documentAlerts.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-sm">
              Toda la documentación de las {ambulances.length} ambulancias tiene más de 30 días de vigencia.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {documentAlerts.map((alert) => {
                const meta = getExpiryBadgeMeta(alert.daysRemaining);
                return (
                  <div
                    key={`${alert.ambulanceId}-${alert.document.type}`}
                    onClick={() => onNavigate('fleet')}
                    className={`p-3.5 rounded-xl border cursor-pointer transition hover:shadow-xs flex items-start justify-between gap-2 ${meta.cardClass}`}
                  >
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-bold">
                          {alert.ambulanceCode}
                        </span>
                        <span className="font-mono font-semibold text-slate-700">
                          {alert.ambulancePlate}
                        </span>
                      </div>
                      <p className="font-bold text-slate-900 text-sm">
                        {alert.document.type}
                      </p>
                      <p className="text-slate-600">
                        Nº: <span className="font-mono">{alert.document.number}</span> • Vence:{' '}
                        <strong>{alert.document.expiryDate}</strong>
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold shrink-0 border ${meta.badgeClass}`}
                    >
                      {meta.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Main Grid: Checklists para taller & Alertas Preventivas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Informes del Responsable de Flota pendientes para Taller */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
            <div className="flex items-center gap-2.5">
              <ClipboardCheck className="w-5 h-5 text-blue-600" />
              <h2 className="font-bold text-slate-800">
                Checklists del Responsable de Flota para Taller
              </h2>
            </div>
            <button
              onClick={() => onNavigate('checklist')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              Nueva Inspección <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="p-5 space-y-4">
            {checklists.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">
                No hay checklists registrados todavía.
              </p>
            ) : (
              checklists.slice(0, 3).map((chk) => {
                const amb = ambulances.find((a) => a.id === chk.ambulanceId);
                const faults = chk.items.filter((i) => i.status === 'Avería').length;
                const obs = chk.items.filter((i) => i.status === 'Observación').length;
                return (
                  <div
                    key={chk.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 hover:bg-slate-50 transition"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-md bg-slate-900 text-white text-xs font-bold">
                          {amb?.code} ({amb?.plate})
                        </span>
                        <span
                          className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                            chk.overallUrgency === 'Inmovilización Inmediata'
                              ? 'bg-rose-100 text-rose-700'
                              : chk.overallUrgency === 'Prioritaria'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {chk.overallUrgency}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500">
                        {chk.date} • {chk.mileageAtInspection.toLocaleString()} km
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 mt-2 line-clamp-2">
                      {chk.generalObservations}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/70">
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-rose-600 font-semibold">
                          {faults} averías detectadas
                        </span>
                        <span className="text-amber-600 font-medium">
                          {obs} observaciones
                        </span>
                        {chk.missingParts.length > 0 && (
                          <span className="text-purple-700 bg-purple-50 px-2 py-0.5 rounded font-medium">
                            {chk.missingParts.length} piezas a reponer en vehículo
                          </span>
                        )}
                      </div>

                      {chk.workshopStatus === 'Pendiente de Asignar Taller' ? (
                        <button
                          onClick={() => onCreateWorkOrderFromChecklist(chk)}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition flex items-center gap-1.5"
                        >
                          <Wrench className="w-3.5 h-3.5" />
                          Crear Orden Externa
                        </button>
                      ) : (
                        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {chk.workshopStatus}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Alertas de Mantenimiento Preventivo e ITV */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <h2 className="font-bold text-slate-800">
                Alertas de Mantenimiento Preventivo e ITV
              </h2>
            </div>
            <button
              onClick={() => onNavigate('preventive')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              Ver Plan Preventivo <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="p-5 space-y-3">
            {preventiveAlerts.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                Todos los mantenimientos preventivos están al día.
              </div>
            ) : (
              preventiveAlerts.map(({ sched, amb, status, reason }) => (
                <div
                  key={sched.id}
                  className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 ${
                    status === 'overdue'
                      ? 'bg-rose-50/60 border-rose-200'
                      : 'bg-amber-50/60 border-amber-200'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                        {amb.code}
                      </span>
                      <span className="text-xs font-semibold text-slate-700">
                        {amb.brand} {amb.model} ({amb.plate})
                      </span>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          status === 'overdue'
                            ? 'bg-rose-600 text-white'
                            : 'bg-amber-500 text-white'
                        }`}
                      >
                        {status === 'overdue' ? 'VENCIDO' : 'PRÓXIMO'}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900">{sched.title}</p>
                    <p className="text-xs font-medium text-slate-600">{reason}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs text-slate-500 block">Km actual</span>
                    <span className="text-sm font-bold text-slate-800">
                      {amb.mileage.toLocaleString()} km
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Estado rápido de todas las ambulancias y stock a bordo */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gauge className="w-5 h-5 text-slate-700" />
            <h2 className="font-bold text-slate-800">
              Estado Mecánico y Stock de Piezas por Ambulancia
            </h2>
          </div>
          <button
            onClick={() => onNavigate('fleet')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700"
          >
            Gestionar Flota →
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Unidad</th>
                <th className="py-3 px-4">Vehículo / Motor</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4">Kilometraje</th>
                <th className="py-3 px-4">Próx. ITV</th>
                <th className="py-3 px-4">Dotación Piezas Vehículo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {ambulances.map((amb) => {
                const missingPartsCount = amb.onboardParts.reduce(
                  (acc, p) => acc + Math.max(0, p.requiredQty - p.currentQty),
                  0
                );
                return (
                  <tr key={amb.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {amb.code}
                      <span className="block text-xs font-normal text-slate-500">
                        {amb.plate}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-slate-800">
                        {amb.brand} {amb.model}
                      </span>
                      <span className="block text-xs text-slate-500">
                        Año {amb.year} • {amb.fuelType}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-slate-700">
                      {amb.type}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          amb.status === 'Disponible'
                            ? 'bg-emerald-100 text-emerald-800'
                            : amb.status === 'En taller'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            amb.status === 'Disponible'
                              ? 'bg-emerald-600'
                              : amb.status === 'En taller'
                              ? 'bg-amber-600'
                              : 'bg-rose-600'
                          }`}
                        />
                        {amb.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {amb.mileage.toLocaleString()} km
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {(() => {
                        const diffItv = Math.ceil(
                          (new Date(amb.itvExpiry).getTime() -
                            new Date(today).getTime()) /
                            (1000 * 3600 * 24)
                        );
                        const diffSan = Math.ceil(
                          (new Date(amb.sanitaryCertExpiry).getTime() -
                            new Date(today).getTime()) /
                            (1000 * 3600 * 24)
                        );
                        const minDiff = Math.min(diffItv, diffSan);
                        const badgeClass =
                          minDiff < 0
                            ? 'bg-rose-100 text-rose-800 border-rose-300'
                            : minDiff <= 30
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200';
                        const labelText =
                          diffItv < 0
                            ? `ITV Vencida (${Math.abs(diffItv)}d)`
                            : diffItv <= 30
                            ? `ITV en ${diffItv} días`
                            : `ITV: ${amb.itvExpiry}`;
                        return (
                          <div className="space-y-0.5">
                            <span
                              className={`inline-block px-2 py-0.5 rounded border font-bold text-[11px] ${badgeClass}`}
                            >
                              {labelText}
                            </span>
                            <span className="block text-[11px] text-slate-500">
                              Sanitario: {amb.sanitaryCertExpiry}
                            </span>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="py-3 px-4">
                      {missingPartsCount === 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Stock Completo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-md">
                          <ShieldAlert className="w-3.5 h-3.5" /> Faltan {missingPartsCount}{' '}
                          uds.
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
