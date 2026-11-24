import React, { useState } from 'react';
import {
  Ambulance,
  PartCategory,
  SparePart,
  StockMovement,
} from '../types';
import {
  Package,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Truck,
  RefreshCw,
  Search,
  ShoppingCart,
  History,
  MessageCircle,
  PackageCheck,
} from 'lucide-react';

interface PartsInventoryViewProps {
  spareParts: SparePart[];
  ambulances: Ambulance[];
  stockMovements: StockMovement[];
  onAddSparePart: (part: Omit<SparePart, 'id'>) => void;
  onUpdatePartStock: (partId: string, delta: number) => void;
  onRestockVehiclePart: (ambulanceId: string, partId: string) => void;
  onReceiveSupplierOrder: (partId: string, quantityToAdd: number) => void;
}

export const PartsInventoryView: React.FC<PartsInventoryViewProps> = ({
  spareParts,
  ambulances,
  stockMovements,
  onAddSparePart,
  onUpdatePartStock,
  onRestockVehiclePart,
  onReceiveSupplierOrder,
}) => {
  const [subTab, setSubTab] = useState<
    'warehouse' | 'vehicles' | 'orders' | 'movements'
  >('warehouse');
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

  // Calcular Lista Automática de Pedido a Proveedores (3.1)
  // Incluye piezas con stockQuantity <= minStockAlert O que falten a bordo de las ambulancias
  const supplierOrderLines = spareParts
    .map((part) => {
      const missingAcrossVehicles = ambulances.reduce((sum, amb) => {
        const onboard = amb.onboardParts.find((op) => op.partId === part.id);
        if (!onboard) return sum;
        return sum + Math.max(0, onboard.requiredQty - onboard.currentQty);
      }, 0);

      const warehouseShortfall = Math.max(
        0,
        part.minStockAlert * 2 - part.stockQuantity
      );
      const needsOrder =
        part.stockQuantity <= part.minStockAlert ||
        missingAcrossVehicles > part.stockQuantity;

      const suggestedOrderQty = Math.max(
        4,
        warehouseShortfall + missingAcrossVehicles
      );

      return {
        part,
        missingAcrossVehicles,
        needsOrder,
        suggestedOrderQty,
      };
    })
    .filter((item) => item.needsOrder);

  const sendSupplierOrderViaWhatsApp = () => {
    if (supplierOrderLines.length === 0) return;
    const lines = supplierOrderLines
      .map(
        (l) =>
          `• *${l.part.name}* (${l.part.sku}) → Pedir *${l.suggestedOrderQty} uds.* [Proveedor: ${l.part.supplier} | Stock actual: ${l.part.stockQuantity}]`
      )
      .join('\n');

    const text = [
      `📦 *SOLICITUD DE PEDIDO DE REPUESTOS — AMBUFLEET TALLER*`,
      `Fecha: ${new Date().toISOString().split('T')[0]}`,
      ``,
      lines,
    ].join('\n');

    window.open(
      `https://wa.me/?text=${encodeURIComponent(text)}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

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
      {/* Cabecera de Inventario y Selector de 4 Sub-Pestañas */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSubTab('warehouse')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              subTab === 'warehouse'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Package className="w-4 h-4" />
            Almacén Taller ({spareParts.length})
          </button>

          <button
            onClick={() => setSubTab('vehicles')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              subTab === 'vehicles'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Truck className="w-4 h-4" />
            Stock por Vehículo ({ambulances.length})
          </button>

          <button
            onClick={() => setSubTab('orders')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              subTab === 'orders'
                ? 'bg-rose-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            Pedido a Proveedores ({supplierOrderLines.length})
          </button>

          <button
            onClick={() => setSubTab('movements')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              subTab === 'movements'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <History className="w-4 h-4" />
            Historial de Movimientos ({stockMovements.length})
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right text-xs">
            <span className="text-slate-400 block">Unidades en Almacén</span>
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

      {/* Sub-pestaña 1: Almacén General de Taller */}
      {subTab === 'warehouse' && (
        <div className="space-y-4">
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
      )}

      {/* Sub-pestaña 2: Matriz de Stock de Piezas por Vehículo */}
      {subTab === 'vehicles' && (
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
                      <AlertTriangle className="w-3.5 h-3.5" /> Faltan{' '}
                      {missingTotal} piezas
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
                            onClick={() =>
                              onRestockVehiclePart(amb.id, item.partId)
                            }
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

      {/* Sub-pestaña 3: Lista Automática de Pedido a Proveedores (3.1) */}
      {subTab === 'orders' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-rose-600" />
                Propuesta Automática de Pedido a Proveedores
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Calculada cruzando las referencias bajo mínimo en almacén más las
                piezas que faltan a bordo de las ambulancias.
              </p>
            </div>

            {supplierOrderLines.length > 0 && (
              <button
                type="button"
                onClick={sendSupplierOrderViaWhatsApp}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 shadow-xs"
              >
                <MessageCircle className="w-4 h-4" />
                Enviar Lista de Pedido por WhatsApp
              </button>
            )}
          </div>

          {supplierOrderLines.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500">
              Todas las referencias superan el stock mínimo. No hay pedidos
              pendientes.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-500 font-bold uppercase">
                    <th className="py-3 px-4">Proveedor</th>
                    <th className="py-3 px-4">Repuesto / SKU</th>
                    <th className="py-3 px-4 text-center">Stock Almacén</th>
                    <th className="py-3 px-4 text-center">
                      Faltan en Ambulancias
                    </th>
                    <th className="py-3 px-4 text-center">Cantidad a Pedir</th>
                    <th className="py-3 px-4 text-right">Recepción Mercancía</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {supplierOrderLines.map(
                    ({
                      part,
                      missingAcrossVehicles,
                      suggestedOrderQty,
                    }) => (
                      <tr key={part.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-bold text-slate-800">
                          {part.supplier}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900 block">
                            {part.name}
                          </span>
                          <span className="font-mono text-[11px] text-slate-500">
                            {part.sku} • {part.locationInWorkshop}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold">
                            {part.stockQuantity} / mín {part.minStockAlert}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center font-semibold text-purple-700">
                          {missingAcrossVehicles > 0
                            ? `${missingAcrossVehicles} uds.`
                            : '-'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-3 py-1 rounded-lg bg-slate-900 text-white font-extrabold">
                            +{suggestedOrderQty} uds.
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              onReceiveSupplierOrder(part.id, suggestedOrderQty)
                            }
                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold inline-flex items-center gap-1.5"
                          >
                            <PackageCheck className="w-3.5 h-3.5" />
                            Recibir en Almacén
                          </button>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Sub-pestaña 4: Historial de Movimientos de Stock / Trazabilidad (3.2) */}
      {subTab === 'movements' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 bg-slate-50 border-b border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <History className="w-4 h-4 text-blue-600" />
              Historial de Movimientos y Trazabilidad de Piezas
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Registro automático de todas las salidas de repuestos hacia Órdenes
              de Trabajo, reposiciones a bordo de ambulancias y entradas de
              almacén.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-500 font-bold uppercase">
                  <th className="py-3 px-4">Fecha / Hora</th>
                  <th className="py-3 px-4">Tipo de Movimiento</th>
                  <th className="py-3 px-4">Pieza / SKU</th>
                  <th className="py-3 px-4 text-center">Variación</th>
                  <th className="py-3 px-4">Ambulancia / Destino</th>
                  <th className="py-3 px-4">Responsable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {stockMovements.map((mov) => (
                  <tr key={mov.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {mov.date}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                          mov.quantityChange < 0
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {mov.type}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900">
                        {mov.partName}
                      </span>
                      <span className="block font-mono text-[11px] text-slate-400">
                        {mov.sku}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`font-extrabold text-sm ${
                          mov.quantityChange < 0
                            ? 'text-rose-600'
                            : 'text-emerald-600'
                        }`}
                      >
                        {mov.quantityChange > 0
                          ? `+${mov.quantityChange}`
                          : mov.quantityChange}{' '}
                        uds.
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {mov.targetReference}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {mov.performedBy}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                    onChange={(e) =>
                      setNewPart({ ...newPart, sku: e.target.value })
                    }
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
                  onChange={(e) =>
                    setNewPart({ ...newPart, name: e.target.value })
                  }
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
