import React, { useState } from 'react';
import {
  Ambulance,
  PartCategory,
  SparePart,
  StockMovement,
  StockMovementType,
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
  ArrowUpDown,
} from 'lucide-react';

interface PartsInventoryViewProps {
  spareParts: SparePart[];
  ambulances: Ambulance[];
  stockMovements: StockMovement[];
  onAddSparePart: (part: Omit<SparePart, 'id'>) => void;
  onUpdatePartStock: (partId: string, delta: number, notes?: string) => void;
  onRecordCustomMovement?: (
    partId: string,
    type: StockMovementType,
    quantity: number,
    destination: string,
    notes: string,
    performedBy: string
  ) => void;
  onRestockVehiclePart: (ambulanceId: string, partId: string) => void;
  onReceiveSupplierOrder: (partId: string, quantityToAdd: number) => void;
}

export const PartsInventoryView: React.FC<PartsInventoryViewProps> = ({
  spareParts,
  ambulances,
  stockMovements,
  onAddSparePart,
  onUpdatePartStock,
  onRecordCustomMovement,
  onRestockVehiclePart,
  onReceiveSupplierOrder,
}) => {
  const [subTab, setSubTab] = useState<
    'warehouse' | 'vehicles' | 'orders' | 'movements'
  >('warehouse');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);

  const [newPart, setNewPart] = useState({
    sku: '',
    name: '',
    category: 'Filtros y Lubricantes' as PartCategory,
    compatibleModelsText: 'Mercedes-Benz Sprinter, Volkswagen Crafter',
    stockQuantity: 10,
    minStockAlert: 4,
    warehouseLocation: 'Almacén Central - Estante A1',
    supplier: 'Recambios ProFlota',
    supplierContact: '954 200 111 / pedidos@proflota.es',
    isVehicleOnboardStandard: false,
  });

  const [newMovForm, setNewMovForm] = useState({
    partId: spareParts[0]?.id || '',
    type: 'Entrada' as StockMovementType,
    quantity: 1,
    destination: 'Almacén Central',
    notes: '',
    performedBy: 'Carlos Mendoza (Encargado)',
  });

  const filteredParts = spareParts.filter((p) => {
    const matchesCategory =
      selectedCategory === 'Todas' || p.category === selectedCategory;
    const matchesQuery =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.warehouseLocation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.supplier.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.compatibleModels.some((m) =>
        m.toLowerCase().includes(searchQuery.toLowerCase())
      );
    return matchesCategory && matchesQuery;
  });

  const totalUnitsInStock = spareParts.reduce(
    (acc, p) => acc + p.stockQuantity,
    0
  );

  const lowStockCount = spareParts.filter(
    (p) => p.stockQuantity <= p.minStockAlert
  ).length;

  // Calcular Lista Automática de Pedido a Proveedores (sin importes)
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
          `• *${l.part.name}* (${l.part.sku}) → Solicitar *${l.suggestedOrderQty} uds.* [Proveedor: ${l.part.supplier} (${l.part.supplierContact || 'Sin contacto'}) | Stock actual: ${l.part.stockQuantity}]`
      )
      .join('\n');

    const text = [
      `📦 *SOLICITUD DE PEDIDO DE REPUESTOS — AMBUFLEET FLOTA*`,
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
      warehouseLocation: newPart.warehouseLocation,
      supplier: newPart.supplier,
      supplierContact: newPart.supplierContact,
      isVehicleOnboardStandard: newPart.isVehicleOnboardStandard,
    });
    setShowAddModal(false);
  };

  const handleCreateCustomMovement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMovForm.partId || newMovForm.quantity <= 0) return;
    if (onRecordCustomMovement) {
      onRecordCustomMovement(
        newMovForm.partId,
        newMovForm.type,
        newMovForm.quantity,
        newMovForm.destination,
        newMovForm.notes,
        newMovForm.performedBy
      );
    } else {
      const sign =
        newMovForm.type === 'Salida a reparación' ||
        newMovForm.type === 'Salida a vehículo'
          ? -newMovForm.quantity
          : newMovForm.quantity;
      onUpdatePartStock(newMovForm.partId, sign, newMovForm.notes);
    }
    setShowMovementModal(false);
    setNewMovForm({ ...newMovForm, notes: '', quantity: 1 });
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
            Almacén de Repuestos ({spareParts.length})
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
            Dotación a Bordo ({ambulances.length})
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
            Pedidos a Proveedor ({supplierOrderLines.length})
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
            Movimientos de Stock ({stockMovements.length})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="text-right text-xs">
            <span className="text-slate-400 block">
              Stock Total ({lowStockCount} en alerta)
            </span>
            <span className="text-sm font-extrabold text-slate-900">
              {totalUnitsInStock} uds.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowMovementModal(true)}
            className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5"
          >
            <ArrowUpDown className="w-4 h-4" />
            Registrar Movimiento
          </button>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Nuevo Repuesto
          </button>
        </div>
      </div>

      {/* Sub-pestaña 1: Almacén Propio de Repuestos (Sin Costes) */}
      {subTab === 'warehouse' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar por SKU, nombre, ubicación en almacén, proveedor o modelo compatible..."
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
                    <th className="py-3 px-4">SKU / Repuesto</th>
                    <th className="py-3 px-4">Categoría</th>
                    <th className="py-3 px-4">Modelos Compatibles</th>
                    <th className="py-3 px-4">Ubicación Almacén / Proveedor</th>
                    <th className="py-3 px-4 text-center">Cantidad / Mínimo</th>
                    <th className="py-3 px-4 text-right">Movimiento Rápido</th>
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
                              Dotación a Bordo
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
                            {part.warehouseLocation}
                          </strong>
                          <span className="font-semibold text-slate-700">
                            {part.supplier}
                          </span>
                          {part.supplierContact && (
                            <span className="block text-[11px] text-slate-400">
                              {part.supplierContact}
                            </span>
                          )}
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
                            Stock mín: {part.minStockAlert}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() =>
                                onUpdatePartStock(
                                  part.id,
                                  -1,
                                  'Ajuste rápido salida (-1)'
                                )
                              }
                              className="px-2.5 py-1 rounded border border-slate-300 hover:bg-slate-100 font-bold"
                            >
                              -1
                            </button>
                            <button
                              onClick={() =>
                                onUpdatePartStock(
                                  part.id,
                                  1,
                                  'Ajuste rápido entrada (+1)'
                                )
                              }
                              className="px-2.5 py-1 rounded border border-slate-300 hover:bg-slate-100 font-bold"
                            >
                              +1
                            </button>
                            <button
                              onClick={() =>
                                onUpdatePartStock(
                                  part.id,
                                  5,
                                  'Recepción lote almacén (+5)'
                                )
                              }
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

      {/* Sub-pestaña 2: Dotación a Bordo Obligatoria por Vehículo (OK / Falta) */}
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
                    <p className="text-xs text-slate-500 mt-0.5">
                      {amb.type} • {amb.baseLocation}
                    </p>
                  </div>

                  {missingTotal === 0 ? (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Dotación OK
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Falta (
                      {missingTotal} uds.)
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
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded font-extrabold text-[10px] ${
                                isComplete
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-600 text-white'
                              }`}
                            >
                              {isComplete ? 'OK' : 'FALTA'}
                            </span>
                            <p className="font-semibold text-slate-800">
                              {item.partName}
                            </p>
                          </div>
                          <p className="text-slate-500 mt-0.5">
                            A bordo: <strong>{item.currentQty}</strong> / Exigido:{' '}
                            <strong>{item.requiredQty}</strong>
                          </p>
                        </div>

                        {isComplete ? (
                          <span className="text-emerald-600 font-bold">
                            Completo
                          </span>
                        ) : (
                          <button
                            onClick={() =>
                              onRestockVehiclePart(amb.id, item.partId)
                            }
                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-1"
                          >
                            <RefreshCw className="w-3 h-3" /> Suministrar desde Almacén
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

      {/* Sub-pestaña 3: Pedidos a Proveedor Opcionales (Sin Importes) */}
      {subTab === 'orders' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-rose-600" />
                Pedidos a Proveedores (Sin Importes — Basado en Stock Mínimo)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Referencias con cantidad menor o igual al stock mínimo o pendientes de reponer en la dotación de las 21 ambulancias.
              </p>
            </div>

            {supplierOrderLines.length > 0 && (
              <button
                type="button"
                onClick={sendSupplierOrderViaWhatsApp}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 shadow-xs"
              >
                <MessageCircle className="w-4 h-4" />
                Enviar Pedido a Proveedor por WhatsApp
              </button>
            )}
          </div>

          {supplierOrderLines.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500">
              Todas las referencias superan el stock mínimo. No hay pedidos pendientes a proveedor.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-500 font-bold uppercase">
                    <th className="py-3 px-4">Proveedor / Contacto</th>
                    <th className="py-3 px-4">Repuesto / SKU / Ubicación</th>
                    <th className="py-3 px-4 text-center">Stock Almacén</th>
                    <th className="py-3 px-4 text-center">
                      Faltan en Ambulancias
                    </th>
                    <th className="py-3 px-4 text-center">Cantidad a Pedir</th>
                    <th className="py-3 px-4 text-right">Recepción en Almacén</th>
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
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-800 block">
                            {part.supplier}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {part.supplierContact || 'Contacto general'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900 block">
                            {part.name}
                          </span>
                          <span className="font-mono text-[11px] text-slate-500">
                            {part.sku} • {part.warehouseLocation}
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
                            Registrar Entrada
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

      {/* Sub-pestaña 4: Historial de Movimientos de Stock (Entrada, Salida a reparación, Salida a vehículo, Ajuste) */}
      {subTab === 'movements' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <History className="w-4 h-4 text-blue-600" />
                Movimientos de Stock (Entrada, Salida a reparación, Salida a vehículo y Ajuste)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Trazabilidad completa con fecha, cantidad, destino, notas y usuario que realiza la operación.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowMovementModal(true)}
              className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Nuevo Movimiento Manual
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-500 font-bold uppercase">
                  <th className="py-3 px-4">Fecha / Hora</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Repuesto / SKU</th>
                  <th className="py-3 px-4 text-center">Cantidad</th>
                  <th className="py-3 px-4">Destino / Referencia</th>
                  <th className="py-3 px-4">Notas</th>
                  <th className="py-3 px-4">Usuario</th>
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
                    <td className="py-3 px-4 text-slate-500">
                      {mov.notes || '-'}
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-medium">
                      {mov.performedBy}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Registrar Movimiento de Stock */}
      {showMovementModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-4">
              Registrar Movimiento de Almacén
            </h3>
            <form onSubmit={handleCreateCustomMovement} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Repuesto
                </label>
                <select
                  value={newMovForm.partId}
                  onChange={(e) =>
                    setNewMovForm({ ...newMovForm, partId: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                >
                  {spareParts.map((sp) => (
                    <option key={sp.id} value={sp.id}>
                      {sp.sku} — {sp.name} (Actual: {sp.stockQuantity} uds.)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Tipo de Movimiento
                  </label>
                  <select
                    value={newMovForm.type}
                    onChange={(e) =>
                      setNewMovForm({
                        ...newMovForm,
                        type: e.target.value as StockMovementType,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-semibold"
                  >
                    <option value="Entrada">Entrada</option>
                    <option value="Salida a reparación">
                      Salida a reparación
                    </option>
                    <option value="Salida a vehículo">Salida a vehículo</option>
                    <option value="Ajuste">Ajuste</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Cantidad (uds.)
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={newMovForm.quantity}
                    onChange={(e) =>
                      setNewMovForm({
                        ...newMovForm,
                        quantity: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Destino / Referencia (Vehículo, Taller Externo o Almacén)
                </label>
                <input
                  type="text"
                  required
                  value={newMovForm.destination}
                  onChange={(e) =>
                    setNewMovForm({
                      ...newMovForm,
                      destination: e.target.value,
                    })
                  }
                  placeholder="Ej. AMB-04 / Talleres DieselSur / Almacén Central"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Notas
                </label>
                <input
                  type="text"
                  value={newMovForm.notes}
                  onChange={(e) =>
                    setNewMovForm({ ...newMovForm, notes: e.target.value })
                  }
                  placeholder="Motivo o albarán de entrega sin importes..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Usuario
                </label>
                <input
                  type="text"
                  required
                  value={newMovForm.performedBy}
                  onChange={(e) =>
                    setNewMovForm({
                      ...newMovForm,
                      performedBy: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowMovementModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
                >
                  Guardar Movimiento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Alta de Nuevo Repuesto (Sin Costes) */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              Alta de Nueva Referencia en Almacén Propio
            </h3>
            <form onSubmit={handleCreatePart} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Código SKU *
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
                  Nombre del Repuesto *
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
                  Modelos Compatibles (separados por coma)
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
                    Cantidad Actual
                  </label>
                  <input
                    type="number"
                    min={0}
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
                    min={0}
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

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Ubicación en Almacén
                </label>
                <input
                  type="text"
                  required
                  value={newPart.warehouseLocation}
                  onChange={(e) =>
                    setNewPart({
                      ...newPart,
                      warehouseLocation: e.target.value,
                    })
                  }
                  placeholder="Ej. Almacén Central - Estante B2"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Proveedor (Nombre)
                  </label>
                  <input
                    type="text"
                    value={newPart.supplier}
                    onChange={(e) =>
                      setNewPart({ ...newPart, supplier: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Contacto Proveedor
                  </label>
                  <input
                    type="text"
                    value={newPart.supplierContact}
                    onChange={(e) =>
                      setNewPart({
                        ...newPart,
                        supplierContact: e.target.value,
                      })
                    }
                    placeholder="Teléfono / Email"
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
