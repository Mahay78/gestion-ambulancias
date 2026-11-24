import React, { useState } from 'react';
import { Ambulance, PartCategory, SparePart } from '../types';
import {
  Package,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Truck,
  RefreshCw,
  Search,
} from 'lucide-react';

interface PartsInventoryViewProps {
  spareParts: SparePart[];
  ambulances: Ambulance[];
  onAddSparePart: (part: Omit<SparePart, 'id'>) => void;
  onUpdatePartStock: (partId: string, delta: number) => void;
  onRestockVehiclePart: (ambulanceId: string, partId: string) => void;
}

export const PartsInventoryView: React.FC<PartsInventoryViewProps> = ({
  spareParts,
  ambulances,
  onAddSparePart,
  onUpdatePartStock,
  onRestockVehiclePart,
}) => {
  const [subTab, setSubTab] = useState<'warehouse' | 'vehicles'>('warehouse');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [showAddModal, setShowAddModal] = useState(false);

  const [newPart, setNewPart] = useState({
    sku: '',
    name: '',
    category: 'Filtros y Lubricantes' as PartCategory,
    compatibleModelsText: 'Mercedes-Benz Sprinter, Volkswagen Crafter',
    stockQuantity: 10,
    minStockAlert: 4,
    unitCost: 0,
    locationInWorkshop: 'Estantería A-05',
    supplier: 'Recambios ProFlota',
    isVehicleOnboardStandard: false,
  });

  const filteredParts = spareParts.filter((p) => {
    const matchesCategory =
      selectedCategory === 'Todas' || p.category === selectedCategory;
    const matchesQuery =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.compatibleModels.some((m) =>
        m.toLowerCase().includes(searchQuery.toLowerCase())
      );
    return matchesCategory && matchesQuery;
  });

  const totalUnitsInStock = spareParts.reduce(
    (acc, p) => acc + p.stockQuantity,
    0
  );

  const handleCreatePart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPart.name.trim() || !newPart.sku.trim()) return;
    onAddSparePart({
      sku: newPart.sku,
      name: newPart.name,
      category: newPart.category,
      compatibleModels: newPart.compatibleModelsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      stockQuantity: newPart.stockQuantity,
      minStockAlert: newPart.minStockAlert,
      unitCost: 0,
      locationInWorkshop: newPart.locationInWorkshop,
      supplier: newPart.supplier,
      isVehicleOnboardStandard: newPart.isVehicleOnboardStandard,
    });
    setShowAddModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Cabecera de Inventario y Selector de Vista: Almacén Taller vs Stock por Vehículo */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSubTab('warehouse')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
              subTab === 'warehouse'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Package className="w-4 h-4" />
            Almacén General de Taller ({spareParts.length} referencias)
          </button>
          <button
            onClick={() => setSubTab('vehicles')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
              subTab === 'vehicles'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Truck className="w-4 h-4" />
            Matriz de Stock de Piezas por Vehículo ({ambulances.length} ambulancias)
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right text-xs">
            <span className="text-slate-400 block">Unidades Totales Almacén</span>
            <span className="text-sm font-extrabold text-slate-900">
              {totalUnitsInStock} uds.
            </span>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Alta de Repuesto
          </button>
        </div>
      </div>

      {subTab === 'warehouse' ? (
        <div className="space-y-4">
          {/* Buscador y filtro por categoría */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar por nombre de pieza, referencia SKU o modelo compatible (ej. Sprinter, Crafter)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-300 text-xs"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                'Todas',
                'Filtros y Lubricantes',
                'Frenos',
                'Eléctrico y Prioritarios',
                'Suspensión y Neumáticos',
                'Dotación a Bordo Vehículo',
                'Carrocería y Célula Sanitaria',
              ].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    selectedCategory === cat
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Tabla de Repuestos del Taller */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                    <th className="py-3 px-4">SKU / Pieza</th>
                    <th className="py-3 px-4">Categoría</th>
                    <th className="py-3 px-4">Modelos Compatibles</th>
                    <th className="py-3 px-4">Ubicación / Proveedor</th>
                    <th className="py-3 px-4 text-center">Stock Actual</th>
                    <th className="py-3 px-4 text-right">Ajuste Rápido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredParts.map((part) => {
                    const isLow = part.stockQuantity <= part.minStockAlert;
                    return (
                      <tr key={part.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4">
                          <span className="font-mono text-[11px] text-slate-500 block">
                            {part.sku}
                          </span>
                          <span className="font-bold text-slate-900 text-sm">
                            {part.name}
                          </span>
                          {part.isVehicleOnboardStandard && (
                            <span className="inline-block mt-1 text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                              Dotación a Bordo Vehículo
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-700">
                          {part.category}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {part.compatibleModels.map((m) => (
                              <span
                                key={m}
                                className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[11px]"
                              >
                                {m}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          <strong className="text-slate-800 block">
                            {part.locationInWorkshop}
                          </strong>
                          <span>{part.supplier}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold ${
                              isLow
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {isLow && <AlertTriangle className="w-3.5 h-3.5" />}
                            {part.stockQuantity} uds.
                          </span>
                          <span className="block text-[10px] text-slate-400 mt-0.5">
                            Mín: {part.minStockAlert}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => onUpdatePartStock(part.id, -1)}
                              className="px-2.5 py-1 rounded border border-slate-300 hover:bg-slate-100 font-bold"
                            >
                              -1
                            </button>
                            <button
                              onClick={() => onUpdatePartStock(part.id, 1)}
                              className="px-2.5 py-1 rounded border border-slate-300 hover:bg-slate-100 font-bold"
                            >
                              +1
                            </button>
                            <button
                              onClick={() => onUpdatePartStock(part.id, 5)}
                              className="px-2.5 py-1 rounded bg-slate-900 text-white hover:bg-slate-800 font-semibold"
                            >
                              +5
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Vista 2: Matriz de Stock de Piezas por Vehículo */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {ambulances.map((amb) => {
            const missingTotal = amb.onboardParts.reduce(
              (acc, p) => acc + Math.max(0, p.requiredQty - p.currentQty),
              0
            );
            return (
              <div
                key={amb.id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
              >
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded bg-slate-900 text-white text-xs font-bold">
                        {amb.code}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900">
                        {amb.brand} {amb.model} ({amb.plate})
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{amb.type}</p>
                  </div>

                  {missingTotal === 0 ? (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Dotación Completa
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Faltan {missingTotal}{' '}
                      piezas
                    </span>
                  )}
                </div>

                <div className="p-4 divide-y divide-slate-100 text-xs">
                  {amb.onboardParts.map((item) => {
                    const isComplete = item.currentQty >= item.requiredQty;
                    return (
                      <div
                        key={item.partId}
                        className="py-2.5 flex items-center justify-between gap-2"
                      >
                        <div>
                          <p className="font-semibold text-slate-800">
                            {item.partName}
                          </p>
                          <p className="text-slate-500">
                            A bordo: <strong>{item.currentQty}</strong> / Exigido:{' '}
                            <strong>{item.requiredQty}</strong>
                          </p>
                        </div>

                        {isComplete ? (
                          <span className="text-emerald-600 font-bold">OK</span>
                        ) : (
                          <button
                            onClick={() => onRestockVehiclePart(amb.id, item.partId)}
                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-1"
                          >
                            <RefreshCw className="w-3 h-3" /> Reponer desde Taller
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Alta de Nuevo Repuesto */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              Alta de Nueva Referencia en Almacén
            </h3>
            <form onSubmit={handleCreatePart} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Código SKU
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="FRN-DSC-09"
                    value={newPart.sku}
                    onChange={(e) => setNewPart({ ...newPart, sku: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Categoría
                  </label>
                  <select
                    value={newPart.category}
                    onChange={(e) =>
                      setNewPart({
                        ...newPart,
                        category: e.target.value as PartCategory,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  >
                    <option value="Filtros y Lubricantes">
                      Filtros y Lubricantes
                    </option>
                    <option value="Frenos">Frenos</option>
                    <option value="Eléctrico y Prioritarios">
                      Eléctrico y Prioritarios
                    </option>
                    <option value="Suspensión y Neumáticos">
                      Suspensión y Neumáticos
                    </option>
                    <option value="Dotación a Bordo Vehículo">
                      Dotación a Bordo Vehículo
                    </option>
                    <option value="Carrocería y Célula Sanitaria">
                      Carrocería y Célula Sanitaria
                    </option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Nombre del Repuesto
                </label>
                <input
                  type="text"
                  required
                  value={newPart.name}
                  onChange={(e) => setNewPart({ ...newPart, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Modelos de Ambulancia Compatibles (separados por coma)
                </label>
                <input
                  type="text"
                  value={newPart.compatibleModelsText}
                  onChange={(e) =>
                    setNewPart({
                      ...newPart,
                      compatibleModelsText: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Stock Inicial
                  </label>
                  <input
                    type="number"
                    value={newPart.stockQuantity}
                    onChange={(e) =>
                      setNewPart({
                        ...newPart,
                        stockQuantity: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Stock Mínimo (Alerta)
                  </label>
                  <input
                    type="number"
                    value={newPart.minStockAlert}
                    onChange={(e) =>
                      setNewPart({
                        ...newPart,
                        minStockAlert: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
                >
                  Guardar Repuesto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
