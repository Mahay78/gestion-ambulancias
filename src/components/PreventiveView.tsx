import React, { useMemo, useState } from 'react';
import {
  Ambulance,
  PreventiveCategory,
  PreventiveSchedule,
} from '../types';
import { addMonthsLocal, getLocalDateString } from '../utils/dateUtils';
import {
  Calendar,
  Gauge,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Wrench,
  RotateCcw,
  Layers,
  Trash2,
  Edit3,
  HeartPulse,
} from 'lucide-react';

interface PreventiveViewProps {
  ambulances: Ambulance[];
  schedules: PreventiveSchedule[];
  onAddSchedule: (sched: Omit<PreventiveSchedule, 'id'>) => void;
  onAddSchedulesBulk?: (items: Omit<PreventiveSchedule, 'id'>[]) => void;
  onUpdateSchedule?: (sched: PreventiveSchedule) => void;
  onDeleteSchedule?: (scheduleId: string) => void;
  onCompletePreventive: (scheduleId: string) => void;
  onGenerateWorkOrderFromPreventive: (schedule: PreventiveSchedule) => void;
}

const CATEGORIES: PreventiveCategory[] = [
  'Aceite y Filtros',
  'Sistema de Frenos',
  'Neumáticos y Alineación',
  'Correa / Distribución',
  'Sistema Eléctrico y Baterías',
  'Suspensión y Dirección',
  'Climatización y Célula Sanitaria',
  'Electromedicina y Camilla',
  'Desinfección y Oxigenoterapia',
  'ITV / Legal',
];

interface PreventiveTemplate {
  id: string;
  category: PreventiveCategory;
  title: string;
  intervalKm?: number;
  intervalMonths: number;
  notes: string;
}

const PREVENTIVE_TEMPLATES: PreventiveTemplate[] = [
  {
    id: 'tpl-oil',
    category: 'Aceite y Filtros',
    title: 'Cambio de Aceite Sintético y Filtros (Aire/Aceite/Gasoil)',
    intervalKm: 15000,
    intervalMonths: 12,
    notes: 'Revisión periódica motor diésel y niveles AdBlue.',
  },
  {
    id: 'tpl-brakes',
    category: 'Sistema de Frenos',
    title: 'Revisión Completa de Frenos (Pastillas, Discos y Líquido)',
    intervalKm: 30000,
    intervalMonths: 12,
    notes: 'Comprobar espesor pastillas delanteras/traseras y latiguillos.',
  },
  {
    id: 'tpl-belt',
    category: 'Correa / Distribución',
    title: 'Kit Distribución, Bomba de Agua y Correa Auxiliar',
    intervalKm: 120000,
    intervalMonths: 60,
    notes: 'Sustitución preventiva según kilometraje del fabricante.',
  },
  {
    id: 'tpl-tires',
    category: 'Neumáticos y Alineación',
    title: 'Rotación, Equilibrado y Alineación de Neumáticos',
    intervalKm: 25000,
    intervalMonths: 12,
    notes: 'Verificar dibujo mínimo >3mm y válvula metálica reforzada.',
  },
  {
    id: 'tpl-electro',
    category: 'Electromedicina y Camilla',
    title: 'Revisión Bancada Camilla, Anclajes y Electromedicina',
    intervalMonths: 6,
    notes: 'Comprobar fijación 10G, cargador desfibrilador y tomas 12V/220V.',
  },
  {
    id: 'tpl-desinf',
    category: 'Desinfección y Oxigenoterapia',
    title: 'Desinfección Profunda Célula y Circuito Oxígeno Medicinal',
    intervalMonths: 3,
    notes: 'Estanqueidad tomas O2, caudalímetros y tratamiento ozono/peróxido.',
  },
];

export const PreventiveView: React.FC<PreventiveViewProps> = ({
  ambulances,
  schedules,
  onAddSchedule,
  onAddSchedulesBulk,
  onUpdateSchedule,
  onDeleteSchedule,
  onCompletePreventive,
  onGenerateWorkOrderFromPreventive,
}) => {
  const [filterAmbId, setFilterAmbId] = useState<string>('Todas');
  const [filterStatus, setFilterStatus] = useState<
    'Todos' | 'overdue' | 'soon' | 'ok'
  >('Todos');
  const [filterCategory, setFilterCategory] = useState<string>('Todas');
  const [showModal, setShowModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [editingSched, setEditingSched] = useState<PreventiveSchedule | null>(
    null
  );

  const today = getLocalDateString();

  const [newSched, setNewSched] = useState({
    ambulanceId: ambulances[0]?.id || 'amb-1',
    category: 'Aceite y Filtros' as PreventiveCategory,
    title: 'Cambio de Aceite Sintético y Filtros',
    intervalKm: 15000,
    intervalMonths: 12,
    nextDueKm: 130000,
    nextDueDate: addMonthsLocal(today, 6),
    notes: '',
  });

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    PREVENTIVE_TEMPLATES[0].id
  );
  const [bulkTargetAmbIds, setBulkTargetAmbIds] = useState<string[]>(() =>
    ambulances.map((a) => a.id)
  );

  const evaluateSchedule = (sched: PreventiveSchedule, amb?: Ambulance) => {
    if (!amb) return { status: 'ok' as const, badge: 'AL DÍA', detail: '' };

    let status: 'overdue' | 'soon' | 'ok' = 'ok';
    const details: string[] = [];

    if (sched.nextDueKm) {
      const remKm = sched.nextDueKm - amb.mileage;
      if (remKm <= 0) {
        status = 'overdue';
        details.push(`Excedido en ${Math.abs(remKm).toLocaleString()} km`);
      } else if (remKm <= 2500) {
        status = 'soon';
        details.push(`Quedan ${remKm.toLocaleString()} km`);
      } else {
        details.push(`Faltan ${remKm.toLocaleString()} km`);
      }
    }

    if (sched.nextDueDate) {
      const diffDays = Math.ceil(
        (new Date(`${sched.nextDueDate}T00:00:00`).getTime() -
          new Date(`${today}T00:00:00`).getTime()) /
          (1000 * 3600 * 24)
      );
      if (diffDays < 0) {
        status = 'overdue';
        details.push(`Fecha vencida (${sched.nextDueDate})`);
      } else if (diffDays <= 25 && status !== 'overdue') {
        status = 'soon';
        details.push(`Vence en ${diffDays} días`);
      } else {
        details.push(`Fecha límite: ${sched.nextDueDate}`);
      }
    }

    const badge =
      status === 'overdue'
        ? 'VENCIDO'
        : status === 'soon'
        ? 'PRÓXIMO'
        : 'AL DÍA';

    return { status, badge, detail: details.join(' • ') };
  };

  const evaluatedList = useMemo(() => {
    const rank = { overdue: 0, soon: 1, ok: 2 };
    return schedules
      .map((sched) => {
        const amb = ambulances.find((a) => a.id === sched.ambulanceId);
        const evalRes = evaluateSchedule(sched, amb);
        return { sched, amb, evalRes };
      })
      .sort((a, b) => rank[a.evalRes.status] - rank[b.evalRes.status]);
  }, [schedules, ambulances, today]);

  const counts = useMemo(() => {
    return {
      total: evaluatedList.length,
      overdue: evaluatedList.filter((x) => x.evalRes.status === 'overdue').length,
      soon: evaluatedList.filter((x) => x.evalRes.status === 'soon').length,
      ok: evaluatedList.filter((x) => x.evalRes.status === 'ok').length,
    };
  }, [evaluatedList]);

  const filtered = evaluatedList.filter(({ sched, evalRes }) => {
    if (filterAmbId !== 'Todas' && sched.ambulanceId !== filterAmbId)
      return false;
    if (filterStatus !== 'Todos' && evalRes.status !== filterStatus)
      return false;
    if (filterCategory !== 'Todas' && sched.category !== filterCategory)
      return false;
    return true;
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const amb = ambulances.find((a) => a.id === newSched.ambulanceId);
    onAddSchedule({
      ...newSched,
      lastDoneKm: amb?.mileage || 0,
      lastDoneDate: today,
    });
    setShowModal(false);
  };

  const handleApplyBulkTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    const tpl = PREVENTIVE_TEMPLATES.find((t) => t.id === selectedTemplateId);
    if (!tpl || bulkTargetAmbIds.length === 0) return;

    const toCreate: Omit<PreventiveSchedule, 'id'>[] = [];
    for (const ambId of bulkTargetAmbIds) {
      const alreadyExists = schedules.some(
        (s) =>
          s.ambulanceId === ambId &&
          s.title.toLowerCase() === tpl.title.toLowerCase()
      );
      if (alreadyExists) continue;
      const amb = ambulances.find((a) => a.id === ambId);
      const km = amb?.mileage || 100000;
      toCreate.push({
        ambulanceId: ambId,
        category: tpl.category,
        title: tpl.title,
        intervalKm: tpl.intervalKm,
        lastDoneKm: km,
        nextDueKm: tpl.intervalKm ? km + tpl.intervalKm : undefined,
        intervalMonths: tpl.intervalMonths,
        lastDoneDate: today,
        nextDueDate: addMonthsLocal(today, tpl.intervalMonths),
        notes: tpl.notes,
      });
    }

    if (toCreate.length === 0) {
      alert(
        'Las ambulancias seleccionadas ya tienen este plan preventivo asignado.'
      );
      return;
    }

    if (onAddSchedulesBulk) {
      onAddSchedulesBulk(toCreate);
    } else {
      toCreate.forEach((item) => onAddSchedule(item));
    }
    setShowBulkModal(false);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSched || !onUpdateSchedule) return;
    onUpdateSchedule(editingSched);
    setEditingSched(null);
  };

  return (
    <div className="space-y-6">
      {/* KPIs de Mantenimiento */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setFilterStatus('Todos')}
          className={`p-3.5 rounded-xl border text-left transition ${
            filterStatus === 'Todos'
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-900 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <div className="text-[11px] font-bold uppercase opacity-75">
            Total Planes
          </div>
          <div className="text-2xl font-extrabold mt-0.5">{counts.total}</div>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus('overdue')}
          className={`p-3.5 rounded-xl border text-left transition ${
            filterStatus === 'overdue'
              ? 'bg-rose-600 text-white border-rose-700'
              : 'bg-rose-50 text-rose-900 border-rose-200 hover:bg-rose-100'
          }`}
        >
          <div className="text-[11px] font-bold uppercase opacity-80">
            Vencidos
          </div>
          <div className="text-2xl font-extrabold mt-0.5">{counts.overdue}</div>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus('soon')}
          className={`p-3.5 rounded-xl border text-left transition ${
            filterStatus === 'soon'
              ? 'bg-amber-500 text-white border-amber-600'
              : 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
          }`}
        >
          <div className="text-[11px] font-bold uppercase opacity-80">
            Próximos (≤25d / ≤2.500km)
          </div>
          <div className="text-2xl font-extrabold mt-0.5">{counts.soon}</div>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus('ok')}
          className={`p-3.5 rounded-xl border text-left transition ${
            filterStatus === 'ok'
              ? 'bg-emerald-600 text-white border-emerald-700'
              : 'bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100'
          }`}
        >
          <div className="text-[11px] font-bold uppercase opacity-80">
            Al Día
          </div>
          <div className="text-2xl font-extrabold mt-0.5">{counts.ok}</div>
        </button>
      </div>

      {/* Cabecera y Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterAmbId}
            onChange={(e) => setFilterAmbId(e.target.value)}
            className="text-xs font-semibold rounded-lg border border-slate-300 px-3 py-2 bg-slate-50"
          >
            <option value="Todas">Todas las Ambulancias</option>
            {ambulances.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} - {a.plate} ({a.mileage.toLocaleString()} km)
              </option>
            ))}
          </select>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="text-xs font-semibold rounded-lg border border-slate-300 px-3 py-2 bg-slate-50"
          >
            <option value="Todas">Todas las Categorías</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setBulkTargetAmbIds(ambulances.map((a) => a.id));
              setShowBulkModal(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5"
          >
            <Layers className="w-4 h-4" />
            Aplicar Plantilla a Flota
          </button>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Programar Mantenimiento
          </button>
        </div>
      </div>

      {/* Lista de Mantenimientos Preventivos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.length === 0 ? (
          <div className="md:col-span-2 bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-500">
            No hay planes preventivos con los filtros seleccionados.
          </div>
        ) : (
          filtered.map(({ sched, amb, evalRes }) => {
            const isSanitary =
              sched.category === 'Electromedicina y Camilla' ||
              sched.category === 'Desinfección y Oxigenoterapia' ||
              sched.category === 'Climatización y Célula Sanitaria';

            return (
              <div
                key={sched.id}
                className={`bg-white rounded-xl border p-5 shadow-sm flex flex-col justify-between gap-4 ${
                  evalRes.status === 'overdue'
                    ? 'border-rose-300 ring-1 ring-rose-100'
                    : evalRes.status === 'soon'
                    ? 'border-amber-300'
                    : 'border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span
                        className={`text-[11px] font-bold uppercase tracking-wider inline-flex items-center gap-1 ${
                          isSanitary ? 'text-rose-600' : 'text-blue-600'
                        }`}
                      >
                        {isSanitary && <HeartPulse className="w-3.5 h-3.5" />}
                        {sched.category}
                      </span>
                      <h3 className="text-base font-bold text-slate-900 mt-0.5">
                        {sched.title}
                      </h3>
                      <p className="text-xs font-semibold text-slate-600 mt-0.5">
                        {amb?.code} ({amb?.plate}) • {amb?.brand} {amb?.model}
                      </p>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 flex items-center gap-1 ${
                        evalRes.status === 'overdue'
                          ? 'bg-rose-100 text-rose-800'
                          : evalRes.status === 'soon'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {evalRes.status === 'overdue' ? (
                        <AlertTriangle className="w-3 h-3" />
                      ) : (
                        <CheckCircle2 className="w-3 h-3" />
                      )}
                      {evalRes.badge}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg text-xs border border-slate-200/70">
                    <div>
                      <span className="text-slate-400 block flex items-center gap-1">
                        <Gauge className="w-3 h-3" /> Control Kilometraje
                      </span>
                      <span className="font-bold text-slate-800">
                        {sched.nextDueKm
                          ? `Próx: ${sched.nextDueKm.toLocaleString()} km`
                          : 'Solo por fecha'}
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        Actual: {amb?.mileage.toLocaleString()} km
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Control Temporal
                      </span>
                      <span className="font-bold text-slate-800">
                        {sched.nextDueDate || 'N/A'}
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        Última: {sched.lastDoneDate}
                      </span>
                    </div>
                  </div>

                  {evalRes.detail && (
                    <p
                      className={`mt-2.5 text-xs font-semibold ${
                        evalRes.status === 'overdue'
                          ? 'text-rose-600'
                          : evalRes.status === 'soon'
                          ? 'text-amber-700'
                          : 'text-emerald-700'
                      }`}
                    >
                      {evalRes.detail}
                    </p>
                  )}

                  {sched.notes && (
                    <p className="mt-1.5 text-xs text-slate-500 italic">
                      &ldquo;{sched.notes}&rdquo;
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-1">
                    {onUpdateSchedule && (
                      <button
                        type="button"
                        onClick={() => setEditingSched(sched)}
                        title="Editar plan"
                        className="p-2 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    )}
                    {onDeleteSchedule && (
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            window.confirm(
                              `¿Eliminar el plan "${sched.title}" de ${amb?.code || ''}?`
                            )
                          ) {
                            onDeleteSchedule(sched.id);
                          }
                        }}
                        title="Eliminar plan"
                        className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onGenerateWorkOrderFromPreventive(sched)}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      Enviar a Taller
                    </button>
                    <button
                      type="button"
                      onClick={() => onCompletePreventive(sched.id)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Marcar Realizado
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Plantilla Masiva a Flota */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-extrabold text-slate-900 mb-1">
              Aplicar Plantilla de Mantenimiento a Flota
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Asigna un plan preventivo estándar a todas o varias ambulancias en 1 clic.
            </p>
            <form onSubmit={handleApplyBulkTemplate} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Plantilla Preventiva
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-semibold"
                >
                  {PREVENTIVE_TEMPLATES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.category}: {t.title} ({t.intervalKm ? `${t.intervalKm.toLocaleString()} km / ` : ''}{t.intervalMonths}m)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-slate-700">
                    Unidades seleccionadas ({bulkTargetAmbIds.length}/{ambulances.length})
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setBulkTargetAmbIds(ambulances.map((a) => a.id))}
                      className="text-blue-600 font-bold hover:underline"
                    >
                      Todas
                    </button>
                    <button
                      type="button"
                      onClick={() => setBulkTargetAmbIds([])}
                      className="text-slate-500 font-bold hover:underline"
                    >
                      Ninguna
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1.5 max-h-44 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                  {ambulances.map((a) => {
                    const checked = bulkTargetAmbIds.includes(a.id);
                    return (
                      <label
                        key={a.id}
                        className={`px-2 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 cursor-pointer ${
                          checked
                            ? 'bg-blue-50 border-blue-300 text-blue-900'
                            : 'bg-white border-slate-200 text-slate-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setBulkTargetAmbIds((prev) =>
                              prev.includes(a.id)
                                ? prev.filter((x) => x !== a.id)
                                : [...prev, a.id]
                            )
                          }
                        />
                        {a.code}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800"
                >
                  Aplicar Plantilla
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Nuevo Plan Preventivo */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              Programar Nuevo Mantenimiento
            </h3>
            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Ambulancia
                </label>
                <select
                  value={newSched.ambulanceId}
                  onChange={(e) =>
                    setNewSched({ ...newSched, ambulanceId: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                >
                  {ambulances.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} - {a.plate} ({a.brand})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Categoría
                </label>
                <select
                  value={newSched.category}
                  onChange={(e) =>
                    setNewSched({
                      ...newSched,
                      category: e.target.value as PreventiveCategory,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Tarea / Servicio Preventivo
                </label>
                <input
                  required
                  type="text"
                  value={newSched.title}
                  onChange={(e) =>
                    setNewSched({ ...newSched, title: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Intervalo (km)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={newSched.intervalKm}
                    onChange={(e) =>
                      setNewSched({
                        ...newSched,
                        intervalKm: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Intervalo (meses)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={newSched.intervalMonths}
                    onChange={(e) =>
                      setNewSched({
                        ...newSched,
                        intervalMonths: Math.max(1, Number(e.target.value) || 1),
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Próximo a los (km)
                  </label>
                  <input
                    type="number"
                    value={newSched.nextDueKm}
                    onChange={(e) =>
                      setNewSched({
                        ...newSched,
                        nextDueKm: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Fecha Límite
                  </label>
                  <input
                    type="date"
                    value={newSched.nextDueDate}
                    onChange={(e) =>
                      setNewSched({ ...newSched, nextDueDate: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Notas técnicas
                </label>
                <textarea
                  rows={2}
                  value={newSched.notes}
                  onChange={(e) =>
                    setNewSched({ ...newSched, notes: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
                >
                  Guardar Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Plan Preventivo */}
      {editingSched && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              Editar Mantenimiento Preventivo
            </h3>
            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Tarea / Servicio
                </label>
                <input
                  required
                  type="text"
                  value={editingSched.title}
                  onChange={(e) =>
                    setEditingSched({ ...editingSched, title: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Próximo (km)
                  </label>
                  <input
                    type="number"
                    value={editingSched.nextDueKm ?? ''}
                    onChange={(e) =>
                      setEditingSched({
                        ...editingSched,
                        nextDueKm: e.target.value
                          ? Number(e.target.value)
                          : undefined,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Fecha Límite
                  </label>
                  <input
                    type="date"
                    value={editingSched.nextDueDate || ''}
                    onChange={(e) =>
                      setEditingSched({
                        ...editingSched,
                        nextDueDate: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Notas
                </label>
                <textarea
                  rows={2}
                  value={editingSched.notes || ''}
                  onChange={(e) =>
                    setEditingSched({ ...editingSched, notes: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingSched(null)}
                  className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
