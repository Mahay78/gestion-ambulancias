import React, { useMemo, useState } from 'react';
import {
  Ambulance,
  ExternalWorkshop,
  FleetChecklist,
  SparePart,
  WorkOrder,
} from '../types';
import {
  Search,
  X,
  Truck,
  Wrench,
  Building2,
  Package,
  ClipboardCheck,
  ArrowRight,
} from 'lucide-react';

interface GlobalSearchModalProps {
  ambulances: Ambulance[];
  workOrders: WorkOrder[];
  workshops: ExternalWorkshop[];
  spareParts: SparePart[];
  checklists: FleetChecklist[];
  onNavigate: (
    tab: 'fleet' | 'workorders' | 'workshops' | 'parts' | 'checklist',
    ambulanceId?: string
  ) => void;
  onClose: () => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  ambulances,
  workOrders,
  workshops,
  spareParts,
  checklists,
  onNavigate,
  onClose,
}) => {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;

    const matchedAmbs = ambulances
      .filter(
        (a) =>
          a.code.toLowerCase().includes(q) ||
          a.plate.toLowerCase().includes(q) ||
          a.brand.toLowerCase().includes(q) ||
          a.model.toLowerCase().includes(q) ||
          a.baseLocation.toLowerCase().includes(q)
      )
      .slice(0, 6);

    const matchedOrders = workOrders
      .filter(
        (w) =>
          w.code.toLowerCase().includes(q) ||
          w.title.toLowerCase().includes(q) ||
          w.description.toLowerCase().includes(q)
      )
      .slice(0, 6);

    const matchedParts = spareParts
      .filter(
        (p) =>
          p.sku.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          p.warehouseLocation.toLowerCase().includes(q) ||
          p.supplier.toLowerCase().includes(q)
      )
      .slice(0, 6);

    const matchedWorkshops = workshops
      .filter(
        (ws) =>
          ws.name.toLowerCase().includes(q) ||
          ws.specialty.toLowerCase().includes(q) ||
          ws.zone.toLowerCase().includes(q) ||
          ws.phone.toLowerCase().includes(q)
      )
      .slice(0, 4);

    const matchedChecklists = checklists
      .filter(
        (c) =>
          c.generalObservations.toLowerCase().includes(q) ||
          c.inspectorName.toLowerCase().includes(q)
      )
      .slice(0, 4);

    return {
      matchedAmbs,
      matchedOrders,
      matchedParts,
      matchedWorkshops,
      matchedChecklists,
      total:
        matchedAmbs.length +
        matchedOrders.length +
        matchedParts.length +
        matchedWorkshops.length +
        matchedChecklists.length,
    };
  }, [query, ambulances, workOrders, spareParts, workshops, checklists]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-sm flex items-start justify-center p-4 pt-12 sm:pt-20">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden">
        <div className="p-3.5 border-b border-slate-200 flex items-center gap-2.5 bg-slate-50">
          <Search className="w-5 h-5 text-blue-600 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar matrícula, AMB-04, avería, orden OR-..., taller o SKU..."
            className="flex-1 bg-transparent text-sm font-semibold text-slate-900 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto p-4 space-y-4 text-xs">
          {!results ? (
            <p className="text-center text-slate-500 py-8">
              Escribe una matrícula, código de unidad, avería, proveedor o referencia SKU.
            </p>
          ) : results.total === 0 ? (
            <p className="text-center text-slate-500 py-8">
              Sin resultados para &ldquo;{query}&rdquo;.
            </p>
          ) : (
            <>
              {results.matchedAmbs.length > 0 && (
                <div className="space-y-1.5">
                  <div className="font-extrabold text-slate-500 uppercase text-[10px] flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5" /> Ambulancias
                  </div>
                  {results.matchedAmbs.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => {
                        onNavigate('fleet', a.id);
                        onClose();
                      }}
                      className="w-full p-2.5 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 flex items-center justify-between text-left"
                    >
                      <div>
                        <strong className="text-slate-900">{a.code}</strong> —{' '}
                        <span className="font-bold text-blue-700">{a.plate}</span>{' '}
                        <span className="text-slate-500">
                          • {a.brand} {a.model} ({a.status})
                        </span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  ))}
                </div>
              )}

              {results.matchedOrders.length > 0 && (
                <div className="space-y-1.5">
                  <div className="font-extrabold text-slate-500 uppercase text-[10px] flex items-center gap-1">
                    <Wrench className="w-3.5 h-3.5" /> Órdenes Externas
                  </div>
                  {results.matchedOrders.map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => {
                        onNavigate('workorders');
                        onClose();
                      }}
                      className="w-full p-2.5 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 flex items-center justify-between text-left"
                    >
                      <div>
                        <strong className="text-rose-600">{w.code}</strong> — {w.title}{' '}
                        <span className="text-slate-500">({w.status})</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  ))}
                </div>
              )}

              {results.matchedParts.length > 0 && (
                <div className="space-y-1.5">
                  <div className="font-extrabold text-slate-500 uppercase text-[10px] flex items-center gap-1">
                    <Package className="w-3.5 h-3.5" /> Almacén de Repuestos
                  </div>
                  {results.matchedParts.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        onNavigate('parts');
                        onClose();
                      }}
                      className="w-full p-2.5 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 flex items-center justify-between text-left"
                    >
                      <div>
                        <strong className="font-mono text-slate-900">{p.sku}</strong> —{' '}
                        {p.name}{' '}
                        <span className="text-slate-500">
                          (Stock: {p.stockQuantity} uds. • {p.warehouseLocation})
                        </span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  ))}
                </div>
              )}

              {results.matchedWorkshops.length > 0 && (
                <div className="space-y-1.5">
                  <div className="font-extrabold text-slate-500 uppercase text-[10px] flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5" /> Talleres Externos
                  </div>
                  {results.matchedWorkshops.map((ws) => (
                    <button
                      key={ws.id}
                      type="button"
                      onClick={() => {
                        onNavigate('workshops');
                        onClose();
                      }}
                      className="w-full p-2.5 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 flex items-center justify-between text-left"
                    >
                      <div>
                        <strong>{ws.name}</strong> — {ws.specialty}{' '}
                        <span className="text-slate-500">({ws.phone})</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  ))}
                </div>
              )}

              {results.matchedChecklists.length > 0 && (
                <div className="space-y-1.5">
                  <div className="font-extrabold text-slate-500 uppercase text-[10px] flex items-center gap-1">
                    <ClipboardCheck className="w-3.5 h-3.5" /> Incidencias / Partes
                  </div>
                  {results.matchedChecklists.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        onNavigate('checklist');
                        onClose();
                      }}
                      className="w-full p-2.5 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 flex items-center justify-between text-left"
                    >
                      <div className="truncate pr-2">
                        <strong>{c.date}</strong> — {c.generalObservations}
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
