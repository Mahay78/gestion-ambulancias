import React, { useState } from 'react';
import {
  Ambulance,
  PreventiveCategory,
  PreventiveSchedule,
} from '../types';
import {
  Calendar,
  Gauge,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Wrench,
  RotateCcw,
} from 'lucide-react';

interface PreventiveViewProps {
  ambulances: Ambulance[];
  schedules: PreventiveSchedule[];
  onAddSchedule: (sched: Omit<PreventiveSchedule, 'id'>) => void;
  onCompletePreventive: (scheduleId: string) => void;
  onGenerateWorkOrderFromPreventive: (schedule: PreventiveSchedule) => void;
}

export const PreventiveView: React.FC<PreventiveViewProps> = ({
  ambulances,
  schedules,
  onAddSchedule,
  onCompletePreventive,
  onGenerateWorkOrderFromPreventive,
}) => {
  const [filterAmbId, setFilterAmbId] = useState<string>('Todas');
  const [showModal, setShowModal] = useState(false);

  const [newSched, setNewSched] = useState({
    ambulanceId: ambulances[0]?.id || 'amb-1',
    category: 'Aceite y Filtros' as PreventiveCategory,
    title: 'Cambio de Aceite Sintético y Filtros',
    intervalKm: 15000,
    nextDueKm: 130000,
    nextDueDate: '2027-03-15',
    estimatedCost: 190,
    notes: '',
  });

  const today = new Date().toISOString().split('T')[0];

  const evaluateSchedule = (sched: PreventiveSchedule, amb?: Ambulance) => {
    if (!amb) return { status: 'ok' as const, badge: 'Al día', detail: '' };

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
        (new Date(sched.nextDueDate).getTime() - new Date(today).getTime()) /
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
      status === 'overdue' ? 'VENCIDO' : status === 'soon' ? 'PRÓXIMO' : 'AL DÍA';

    return { status, badge, detail: details.join(' • ') };
  };

  const filtered =
    filterAmbId === 'Todas'
      ? schedules
      : schedules.filter((s) => s.ambulanceId === filterAmbId);

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

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold uppercase text-slate-500">
            Filtrar por Ambulancia:
          </label>
          <select
            value={filterAmbId}
            onChange={(e) => setFilterAmbId(e.target.value)}
            className="text-xs font-semibold rounded-lg border border-slate-300 px-3 py-2 bg-slate-50"
          >
            <option value="Todas">Toda la Flota ({ambulances.length})</option>
            {ambulances.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} - {a.plate} ({a.brand} {a.model})
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Programar Mantenimiento Preventivo
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((sched) => {
          const amb = ambulances.find((a) => a.id === sched.ambulanceId);
          const { status, badge, detail } = evaluateSchedule(sched, amb);

          return (
            <div
              key={sched.id}
              className={`bg-white rounded-xl border p-5 shadow-sm flex flex-col justify-between ${
                status === 'overdue'
                  ? 'border-rose-300 ring-1 ring-rose-200'
                  : status === 'soon'
                  ? 'border-amber-300'
                  : 'border-slate-200'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded bg-slate-900 text-white text-xs font-bold">
                      {amb?.code} ({amb?.plate})
                    </span>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {sched.category}
                    </span>
                  </div>
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      status === 'overdue'
                        ? 'bg-rose-100 text-rose-700'
                        : status === 'soon'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {badge}
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900 mt-3">
                  {sched.title}
                </h3>
                <p className="text-xs font-semibold text-slate-600 mt-1">{detail}</p>

                <div className="grid grid-cols-2 gap-3 mt-4 p-3 rounded-lg bg-slate-50 text-xs">
                  <div>
                    <span className="text-slate-400 block">Km Actual / Próximo</span>
                    <span className="font-bold text-slate-800">
                      {amb?.mileage.toLocaleString()} km →{' '}
                      {sched.nextDueKm ? `${sched.nextDueKm.toLocaleString()} km` : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Última vez realizado</span>
                    <span className="font-semibold text-slate-700">
                      {sched.lastDoneDate}{' '}
                      {sched.lastDoneKm ? `(${sched.lastDoneKm.toLocaleString()} km)` : ''}
                    </span>
                  </div>
                </div>

                {sched.notes && (
                  <p className="text-xs text-slate-500 mt-2.5 italic">
                    Nota: {sched.notes}
                  </p>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-slate-500">
                  Frecuencia:{' '}
                  <strong className="text-slate-800">
                    {sched.intervalKm
                      ? `Cada ${sched.intervalKm.toLocaleString()} km`
                      : 'Semestral / Anual'}
                  </strong>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onGenerateWorkOrderFromPreventive(sched)}
                    className="px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    Enviar a Taller (OT)
                  </button>
                  <button
                    onClick={() => onCompletePreventive(sched.id)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Renovar Ciclo Hoy
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              Programar Mantenimiento Preventivo
            </h3>
            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Ambulancia
                </label>
                <select
                  value={newSched.ambulanceId}
                  onChange={(e) => {
                    const amb = ambulances.find((a) => a.id === e.target.value);
                    setNewSched({
                      ...newSched,
                      ambulanceId: e.target.value,
                      nextDueKm: (amb?.mileage || 100000) + newSched.intervalKm,
                    });
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                >
                  {ambulances.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} ({a.plate}) - {a.mileage.toLocaleString()} km
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
                  <option value="Aceite y Filtros">Aceite y Filtros</option>
                  <option value="Sistema de Frenos">Sistema de Frenos</option>
                  <option value="Neumáticos y Alineación">Neumáticos y Alineación</option>
                  <option value="Correa / Distribución">Correa / Distribución</option>
                  <option value="Sistema Eléctrico y Baterías">
                    Sistema Eléctrico y Baterías
                  </option>
                  <option value="Climatización y Célula Sanitaria">
                    Climatización y Célula Sanitaria
                  </option>
                  <option value="ITV / Legal">ITV / Legal</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Descripción de la Tarea
                </label>
                <input
                  type="text"
                  required
                  value={newSched.title}
                  onChange={(e) => setNewSched({ ...newSched, title: e.target.value })}
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
                    value={newSched.intervalKm}
                    onChange={(e) =>
                      setNewSched({ ...newSched, intervalKm: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Próximo Cambio (km)
                  </label>
                  <input
                    type="number"
                    value={newSched.nextDueKm}
                    onChange={(e) =>
                      setNewSched({ ...newSched, nextDueKm: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
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
    </div>
  );
};
