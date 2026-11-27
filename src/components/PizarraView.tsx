import React, { useMemo, useState } from 'react';
import {
  Ambulance,
  BoardTask,
  FleetChecklist,
  PreventiveSchedule,
  WorkOrder,
} from '../types';
import { collectAllDocumentAlerts } from '../utils/expiryAlerts';
import { getLocalDateString } from '../utils/dateUtils';
import {
  LayoutGrid,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Plus,
  Trash2,
  CheckSquare,
  Square,
  Wrench,
  FileWarning,
  CalendarClock,
  Package,
  Car,
  ClipboardCheck,
  Disc,
  BatteryCharging,
  Printer,
  Check,
} from 'lucide-react';

export interface PizarraTodoItem {
  id: string;
  category:
    | 'Documento'
    | 'Preventivo'
    | 'Orden Taller'
    | 'Checklist / Parte'
    | 'Dotación'
    | 'Carrocería'
    | 'Neumáticos / Batería';
  urgency: 'critical' | 'warning' | 'info';
  title: string;
  detail: string;
  targetTab: 'fleet' | 'preventive' | 'checklist' | 'workorders';
}

export const collectUnitTodos = (
  amb: Ambulance,
  workOrders: WorkOrder[],
  checklists: FleetChecklist[],
  preventiveSchedules: PreventiveSchedule[],
  today: string
): PizarraTodoItem[] => {
  const todos: PizarraTodoItem[] = [];

  // 1. Documentos vencidos o <= 30 días
  const docAlerts = collectAllDocumentAlerts([amb], today);
  docAlerts.forEach((a) => {
    todos.push({
      id: `doc-${a.document.id}`,
      category: 'Documento',
      urgency:
        a.level === 'expired' || a.level === 'days7' ? 'critical' : 'warning',
      title: `${a.document.type} (${a.daysRemaining < 0 ? `VENCIDA hace ${Math.abs(a.daysRemaining)}d` : `vence en ${a.daysRemaining}d`})`,
      detail: `Fecha límite: ${a.document.expiryDate}`,
      targetTab: 'fleet',
    });
  });

  // 2. Órdenes externas abiertas
  workOrders
    .filter((w) => w.ambulanceId === amb.id && w.status !== 'Cerrada')
    .forEach((wo) => {
      todos.push({
        id: `wo-${wo.id}`,
        category: 'Orden Taller',
        urgency:
          wo.priority === 'Crítica (Urgente)' || wo.priority === 'Alta'
            ? 'critical'
            : 'warning',
        title: `${wo.code}: ${wo.title}`,
        detail: `Estado: ${wo.status} • Prioridad: ${wo.priority}`,
        targetTab: 'workorders',
      });
    });

  // 3. Checklists / Partes pendientes de asignar taller (listar cada avería individualmente)
  checklists
    .filter(
      (c) =>
        c.ambulanceId === amb.id &&
        c.workshopStatus === 'Pendiente de Asignar Taller'
    )
    .forEach((chk) => {
      const isDotacionReport =
        chk.generalObservations.includes('[DOTACIÓN UNIDAD') ||
        (chk.missingParts && chk.missingParts.length > 0);
      const faultItems = chk.items.filter(
        (i) => i.status === 'Avería' || i.status === 'Observación'
      );

      if (faultItems.length > 0) {
        faultItems.forEach((item) => {
          todos.push({
            id: `chk-${chk.id}-${item.id}`,
            category: isDotacionReport ? 'Dotación' : 'Checklist / Parte',
            urgency:
              item.status === 'Avería' &&
              chk.overallUrgency === 'Inmovilización Inmediata'
                ? 'critical'
                : item.status === 'Avería'
                ? 'warning'
                : 'info',
            title: `${item.status === 'Avería' ? 'Avería' : 'Observación'}: ${item.label}`,
            detail: `${item.comment ? `${item.comment} • ` : ''}Parte del ${chk.date} por ${chk.inspectorName}`,
            targetTab: 'checklist',
          });
        });
      } else {
        todos.push({
          id: `chk-${chk.id}`,
          category: isDotacionReport ? 'Dotación' : 'Checklist / Parte',
          urgency:
            chk.overallUrgency === 'Inmovilización Inmediata'
              ? 'critical'
              : 'warning',
          title:
            chk.generalObservations ||
            'Incidencia pendiente de asignar a taller',
          detail: `Parte del ${chk.date} por ${chk.inspectorName}`,
          targetTab: 'checklist',
        });
      }
    });

  // 4. Preventivos vencidos o próximos (<= 25d o <= 2500 km)
  preventiveSchedules
    .filter((ps) => ps.ambulanceId === amb.id)
    .forEach((ps) => {
      const remKm = ps.nextDueKm ? ps.nextDueKm - amb.mileage : null;
      const diffDays = ps.nextDueDate
        ? Math.ceil(
            (new Date(`${ps.nextDueDate}T00:00:00`).getTime() -
              new Date(`${today}T00:00:00`).getTime()) /
              (1000 * 3600 * 24)
          )
        : null;

      const isOverdue =
        (remKm !== null && remKm <= 0) || (diffDays !== null && diffDays < 0);
      const isSoon =
        (remKm !== null && remKm <= 2500) ||
        (diffDays !== null && diffDays <= 25);

      if (isOverdue || isSoon) {
        todos.push({
          id: `prev-${ps.id}`,
          category: 'Preventivo',
          urgency: isOverdue ? 'critical' : 'warning',
          title: `${ps.title} (${isOverdue ? 'VENCIDO' : 'PRÓXIMO'})`,
          detail: [
            remKm !== null ? `${remKm.toLocaleString()} km rest.` : '',
            ps.nextDueDate ? `Fecha: ${ps.nextDueDate}` : '',
          ]
            .filter(Boolean)
            .join(' • '),
          targetTab: 'preventive',
        });
      }
    });

  // 5. Dotación a bordo incompleta (FALTA) y reportes de dotación en checklists activos
  const onboardMissingIds = new Set<string>();
  amb.onboardParts
    .filter((p) => p.currentQty < p.requiredQty || p.status === 'Falta')
    .forEach((p) => {
      onboardMissingIds.add(p.partId);
      todos.push({
        id: `part-${p.partId}`,
        category: 'Dotación',
        urgency: 'warning',
        title: `Falta dotación: ${p.partName}`,
        detail: `A bordo: ${p.currentQty} / Requeridas: ${p.requiredQty}`,
        targetTab: 'fleet',
      });
    });

  checklists
    .filter(
      (c) =>
        c.ambulanceId === amb.id &&
        c.workshopStatus !== 'Archivada / OK' &&
        c.missingParts &&
        c.missingParts.length > 0
    )
    .forEach((chk) => {
      chk.missingParts.forEach((mp, idx) => {
        if (onboardMissingIds.has(mp.partId)) return;
        if (chk.workshopStatus === 'Pendiente de Asignar Taller' && chk.generalObservations.includes('[DOTACIÓN UNIDAD')) {
          return;
        }
        todos.push({
          id: `chk-dot-${chk.id}-${idx}`,
          category: 'Dotación',
          urgency: 'warning',
          title: `Dotación reportada (${chk.date}): ${mp.partName}`,
          detail: `Faltan ${mp.missingQty} uds. • ${mp.actionRequired}`,
          targetTab: 'fleet',
        });
      });
    });

  // 6. Daños de carrocería/lunas activos
  (amb.bodyDamages || [])
    .filter((d) => !d.repaired)
    .forEach((d) => {
      todos.push({
        id: `dmg-${d.id}`,
        category: 'Carrocería',
        urgency: d.type === 'Luna / Cristal' ? 'critical' : 'info',
        title: `${d.type} (${d.moment})`,
        detail: d.note,
        targetTab: 'fleet',
      });
    });

  // 7. Neumáticos críticos (<3mm) y baterías bajas/críticas
  (amb.tires || [])
    .filter((t) => t.treadDepthMm < 3)
    .forEach((t) => {
      todos.push({
        id: `tire-${t.position}`,
        category: 'Neumáticos / Batería',
        urgency: 'critical',
        title: `Neumático ${t.label} crítico (${t.treadDepthMm} mm)`,
        detail: `Presión: ${t.pressureBar} bar`,
        targetTab: 'fleet',
      });
    });

  if (amb.batteries) {
    if (amb.batteries.starterStatus !== 'OK') {
      todos.push({
        id: 'batt-starter',
        category: 'Neumáticos / Batería',
        urgency:
          amb.batteries.starterStatus === 'Crítica' ? 'critical' : 'warning',
        title: `Batería Arranque ${amb.batteries.starterStatus} (${amb.batteries.starterVoltage}V)`,
        detail: 'Revisar carga o sustituir batería de motor',
        targetTab: 'fleet',
      });
    }
    if (amb.batteries.auxStatus !== 'OK') {
      todos.push({
        id: 'batt-aux',
        category: 'Neumáticos / Batería',
        urgency:
          amb.batteries.auxStatus === 'Crítica' ? 'critical' : 'warning',
        title: `Batería Auxiliar AGM ${amb.batteries.auxStatus} (${amb.batteries.auxVoltage}V)`,
        detail: amb.batteries.auxType,
        targetTab: 'fleet',
      });
    }
  }

  const rank = { critical: 0, warning: 1, info: 2 };
  return todos.sort((a, b) => rank[a.urgency] - rank[b.urgency]);
};

interface PizarraViewProps {
  ambulances: Ambulance[];
  workOrders: WorkOrder[];
  checklists: FleetChecklist[];
  preventiveSchedules: PreventiveSchedule[];
  onNavigateToUnitTab: (
    tab: 'fleet' | 'preventive' | 'checklist' | 'workorders',
    ambulanceId: string
  ) => void;
  onUpdateBoardTasks: (ambulanceId: string, tasks: BoardTask[]) => void;
  onRestockFromPizarra?: (ambulanceId: string, partId: string) => void;
}

export const PizarraView: React.FC<PizarraViewProps> = ({
  ambulances,
  workOrders,
  checklists,
  preventiveSchedules,
  onNavigateToUnitTab,
  onUpdateBoardTasks,
  onRestockFromPizarra,
}) => {
  const today = getLocalDateString();
  const [selectedAmbId, setSelectedAmbId] = useState<string>(
    ambulances[0]?.id || ''
  );
  const [filterMode, setFilterMode] = useState<
    'Todas' | 'Con pendientes' | 'Al día' | 'En taller'
  >('Todas');
  const [newTaskText, setNewTaskText] = useState('');

  const unitSummaries = useMemo(() => {
    return ambulances.map((amb) => {
      const autoTodos = collectUnitTodos(
        amb,
        workOrders,
        checklists,
        preventiveSchedules,
        today
      );
      const manualPending = (amb.boardTasks || []).filter((t) => !t.done);
      const criticalCount = autoTodos.filter(
        (t) => t.urgency === 'critical'
      ).length;
      const totalPending = autoTodos.length + manualPending.length;
      return {
        amb,
        autoTodos,
        manualTasks: amb.boardTasks || [],
        criticalCount,
        totalPending,
      };
    });
  }, [ambulances, workOrders, checklists, preventiveSchedules, today]);

  const filteredSummaries = unitSummaries.filter((u) => {
    if (filterMode === 'Con pendientes') return u.totalPending > 0;
    if (filterMode === 'Al día') return u.totalPending === 0;
    if (filterMode === 'En taller') return u.amb.status === 'En taller';
    return true;
  });

  const activeUnit =
    unitSummaries.find((u) => u.amb.id === selectedAmbId) ||
    filteredSummaries[0] ||
    unitSummaries[0];

  const handleAddManualTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeUnit || !newTaskText.trim()) return;
    const nextTask: BoardTask = {
      id: `bt-${Date.now()}`,
      text: newTaskText.trim(),
      done: false,
      createdAt: today,
    };
    onUpdateBoardTasks(activeUnit.amb.id, [
      nextTask,
      ...(activeUnit.manualTasks || []),
    ]);
    setNewTaskText('');
  };

  const handleToggleManualTask = (taskId: string) => {
    if (!activeUnit) return;
    onUpdateBoardTasks(
      activeUnit.amb.id,
      activeUnit.manualTasks.map((t) =>
        t.id === taskId ? { ...t, done: !t.done } : t
      )
    );
  };

  const handleDeleteManualTask = (taskId: string) => {
    if (!activeUnit) return;
    onUpdateBoardTasks(
      activeUnit.amb.id,
      activeUnit.manualTasks.filter((t) => t.id !== taskId)
    );
  };

  const renderCategoryIcon = (cat: PizarraTodoItem['category']) => {
    switch (cat) {
      case 'Documento':
        return <FileWarning className="w-4 h-4 text-rose-600" />;
      case 'Orden Taller':
        return <Wrench className="w-4 h-4 text-amber-600" />;
      case 'Checklist / Parte':
        return <ClipboardCheck className="w-4 h-4 text-blue-600" />;
      case 'Preventivo':
        return <CalendarClock className="w-4 h-4 text-indigo-600" />;
      case 'Dotación':
        return <Package className="w-4 h-4 text-orange-600" />;
      case 'Carrocería':
        return <Car className="w-4 h-4 text-purple-600" />;
      case 'Neumáticos / Batería':
        return activeUnit?.autoTodos.some((t) => t.id.startsWith('tire')) ? (
          <Disc className="w-4 h-4 text-slate-700" />
        ) : (
          <BatteryCharging className="w-4 h-4 text-blue-600" />
        );
    }
  };

  return (
    <div className="space-y-5">
      {/* Cabecera de la Pizarra */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
            <LayoutGrid className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-900">
              Pizarra de Unidades ({ambulances.length})
            </h2>
            <p className="text-xs text-slate-500">
              Pulsa cualquier ambulancia para ver toda su lista de cosas por hacer
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {(['Todas', 'Con pendientes', 'Al día', 'En taller'] as const).map(
            (mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setFilterMode(mode)}
                className={`px-3 py-1.5 rounded-xl font-bold transition ${
                  filterMode === mode
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {mode}
              </button>
            )
          )}
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-1.5 rounded-xl font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition flex items-center gap-1.5"
            title="Imprimir hoja del día"
          >
            <Printer className="w-3.5 h-3.5" />
            Imprimir
          </button>
        </div>
      </div>

      {/* Distribución: Tablero de Unidades (izq) + Lista de Cosas por Hacer (der) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Tablero / Pizarra de Unidades */}
        <div className="lg:col-span-6 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {filteredSummaries.map(({ amb, criticalCount, totalPending }) => {
            const isSelected = activeUnit?.amb.id === amb.id;
            return (
              <button
                key={amb.id}
                type="button"
                onClick={() => setSelectedAmbId(amb.id)}
                className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between gap-2 ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900 shadow-lg ring-2 ring-blue-500/40'
                    : criticalCount > 0
                    ? 'bg-rose-50/70 border-rose-200 hover:border-rose-400 text-slate-900'
                    : totalPending > 0
                    ? 'bg-amber-50/60 border-amber-200 hover:border-amber-400 text-slate-900'
                    : 'bg-white border-slate-200 hover:border-emerald-400 text-slate-900'
                }`}
              >
                <div className="flex items-center justify-between gap-1 w-full">
                  <span
                    className={`text-sm font-black ${
                      isSelected ? 'text-rose-400' : 'text-slate-900'
                    }`}
                  >
                    {amb.code}
                  </span>
                  {totalPending === 0 ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                      OK
                    </span>
                  ) : (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                        criticalCount > 0
                          ? 'bg-rose-600 text-white'
                          : 'bg-amber-500 text-white'
                      }`}
                    >
                      {totalPending}
                    </span>
                  )}
                </div>

                <div>
                  <div
                    className={`text-xs font-bold ${
                      isSelected ? 'text-slate-200' : 'text-slate-700'
                    }`}
                  >
                    {amb.plate}
                  </div>
                  <div
                    className={`text-[10px] truncate ${
                      isSelected ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  >
                    {amb.status}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Lista de Cosas por Hacer de la Unidad Seleccionada */}
        {activeUnit && (
          <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-extrabold">
                    {activeUnit.amb.code} — {activeUnit.amb.plate}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-bold">
                    {activeUnit.amb.status}
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  {activeUnit.amb.brand} {activeUnit.amb.model} •{' '}
                  {activeUnit.amb.mileage.toLocaleString()} km
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-slate-300">
                  Pendientes:{' '}
                  <strong className="text-white text-sm">
                    {activeUnit.totalPending}
                  </strong>
                </span>
              </div>
            </div>

            <div className="p-5 space-y-5 text-xs">
              {/* Lista automática de cosas por hacer */}
              <div className="space-y-2">
                <h4 className="font-extrabold text-slate-800 uppercase tracking-wide text-[11px]">
                  Cosas por hacer detectadas automáticamente ({activeUnit.autoTodos.length})
                </h4>

                {activeUnit.autoTodos.length === 0 ? (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    ¡Esta unidad no tiene documentos, averías, preventivos ni dotación pendiente!
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activeUnit.autoTodos.map((item) => (
                      <div
                        key={item.id}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                          item.urgency === 'critical'
                            ? 'bg-rose-50 border-rose-200'
                            : item.urgency === 'warning'
                            ? 'bg-amber-50/70 border-amber-200'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="mt-0.5 shrink-0">
                            {item.urgency === 'critical' ? (
                              <AlertTriangle className="w-4 h-4 text-rose-600" />
                            ) : (
                              renderCategoryIcon(item.category)
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
                              {item.category}
                            </span>
                            <p className="font-bold text-slate-900">
                              {item.title}
                            </p>
                            {item.detail && (
                              <p className="text-[11px] text-slate-600 truncate">
                                {item.detail}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {onRestockFromPizarra && item.id.startsWith('part-') && (
                            <button
                              type="button"
                              onClick={() =>
                                onRestockFromPizarra(
                                  activeUnit.amb.id,
                                  item.id.slice(5)
                                )
                              }
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 shadow-sm"
                              title="Marcar dotación como repuesta a bordo"
                            >
                              <Check className="w-3 h-3" /> Repuesta
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              onNavigateToUnitTab(
                                item.targetTab,
                                activeUnit.amb.id
                              )
                            }
                            className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-bold text-[11px] flex items-center gap-1 shrink-0"
                          >
                            Ir <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Notas / Tareas manuales de la Pizarra */}
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <h4 className="font-extrabold text-slate-800 uppercase tracking-wide text-[11px]">
                  Notas y tareas rápidas en Pizarra ({activeUnit.manualTasks.filter((t) => !t.done).length} pendientes)
                </h4>

                <form onSubmit={handleAddManualTask} className="flex gap-2">
                  <input
                    type="text"
                    value={newTaskText}
                    onChange={(e) => setNewTaskText(e.target.value)}
                    placeholder={`Añadir nota por hacer a ${activeUnit.amb.code}...`}
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-300 bg-slate-50"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1 shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    Añadir
                  </button>
                </form>

                {activeUnit.manualTasks.length > 0 && (
                  <div className="space-y-1.5">
                    {activeUnit.manualTasks.map((task) => (
                      <div
                        key={task.id}
                        className={`px-3 py-2 rounded-xl border flex items-center justify-between gap-2 ${
                          task.done
                            ? 'bg-slate-50 border-slate-200 text-slate-400'
                            : 'bg-blue-50/50 border-blue-200 text-slate-900'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleManualTask(task.id)}
                          className="flex items-center gap-2 text-left flex-1 min-w-0"
                        >
                          {task.done ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-blue-600 shrink-0" />
                          )}
                          <span
                            className={`font-semibold truncate ${
                              task.done ? 'line-through' : ''
                            }`}
                          >
                            {task.text}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteManualTask(task.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
