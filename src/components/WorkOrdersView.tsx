import React, { useState } from 'react';
import {
  Ambulance,
  ExternalWorkshop,
  SparePart,
  WorkOrder,
  WorkOrderPriority,
  WorkOrderStatus,
  WorkOrderType,
} from '../types';
import { SignaturePad } from './SignaturePad';
import { VoiceDictationButton } from './VoiceDictationButton';
import { compressImageFile } from '../utils/imageCompression';
import {
  shareWorkOrderViaWhatsApp,
  printWorkOrderReport,
} from '../utils/shareAndPrint';
import {
  Plus,
  PackagePlus,
  Camera,
  CheckCircle2,
  PenTool,
  MessageCircle,
  Printer,
  Trash2,
  Building2,
  Clock,
  ShieldCheck,
} from 'lucide-react';

interface WorkOrdersViewProps {
  ambulances: Ambulance[];
  workshops: ExternalWorkshop[];
  workOrders: WorkOrder[];
  spareParts: SparePart[];
  onCreateWorkOrder: (wo: Omit<WorkOrder, 'id' | 'code'>) => void;
  onUpdateWorkOrderStatus: (woId: string, status: WorkOrderStatus) => void;
  onAddPartToWorkOrder: (woId: string, partId: string, quantity: number) => void;
  onRemovePartFromWorkOrder: (woId: string, partIndex: number) => void;
  onUpdateWorkOrderDetails: (
    woId: string,
    patch: Partial<
      Pick<
        WorkOrder,
        | 'workshopId'
        | 'entryDate'
        | 'exitDate'
        | 'workshopReport'
        | 'warranty'
      >
    >
  ) => void;
  onUpdateWorkOrderSignatureAndPhotos: (
    woId: string,
    workshopConformitySignature?: string,
    newPhotoUrl?: string
  ) => void;
}

export const calculateDowntimeDays = (
  entryDate?: string,
  exitDate?: string,
  status?: WorkOrderStatus
): number => {
  if (!entryDate) return 0;
  const start = new Date(`${entryDate}T00:00:00`);
  if (isNaN(start.getTime())) return 0;
  const endStr =
    exitDate ||
    (status === 'Cerrada' || status === 'Reparada'
      ? entryDate
      : new Date().toISOString().split('T')[0]);
  const end = new Date(`${endStr}T00:00:00`);
  if (isNaN(end.getTime())) return 0;
  const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24));
  return Math.max(0, diff);
};

export const WorkOrdersView: React.FC<WorkOrdersViewProps> = ({
  ambulances,
  workshops,
  workOrders,
  spareParts,
  onCreateWorkOrder,
  onUpdateWorkOrderStatus,
  onAddPartToWorkOrder,
  onRemovePartFromWorkOrder,
  onUpdateWorkOrderDetails,
  onUpdateWorkOrderSignatureAndPhotos,
}) => {
  const [selectedWoId, setSelectedWoId] = useState<string>(
    workOrders[0]?.id || ''
  );
  const [filterStatus, setFilterStatus] = useState<string>('Todas');
  const [showNewModal, setShowNewModal] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  // Selector para suministrar pieza propia a la Orden Externa activa
  const [partIdToAdd, setPartIdToAdd] = useState<string>(
    spareParts[0]?.id || ''
  );
  const [partQtyToAdd, setPartQtyToAdd] = useState<number>(1);

  const today = new Date().toISOString().split('T')[0];

  // Formulario nueva Orden de Reparación Externa
  const [newWo, setNewWo] = useState({
    ambulanceId: ambulances[0]?.id || 'amb-1',
    workshopId: workshops[0]?.id || 'ws-1',
    type: 'Correctivo (Avería)' as WorkOrderType,
    priority: 'Alta' as WorkOrderPriority,
    status: 'Asignada' as WorkOrderStatus,
    title: '',
    description: '',
    reportedBy: 'Carlos Mendoza (Encargado de Vehículos)',
    entryDate: today,
    workshopReport: '',
    warranty: '6 meses en reparación',
  });

  const filteredOrders =
    filterStatus === 'Todas'
      ? workOrders
      : workOrders.filter((w) => w.status === filterStatus);

  const selectedWo =
    workOrders.find((w) => w.id === selectedWoId) || filteredOrders[0];

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWo.title.trim()) return;
    const amb = ambulances.find((a) => a.id === newWo.ambulanceId);
    onCreateWorkOrder({
      ...newWo,
      createdAt: today,
      mileageAtEntry: amb?.mileage || 0,
      partsUsed: [],
    });
    setShowNewModal(false);
    setNewWo({ ...newWo, title: '', description: '' });
  };

  const handleAddPart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWo || !partIdToAdd || partQtyToAdd <= 0) return;
    onAddPartToWorkOrder(selectedWo.id, partIdToAdd, partQtyToAdd);
    setPartQtyToAdd(1);
  };

  const handleWorkshopPhotoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!selectedWo) return;
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 720, 0.65);
      onUpdateWorkOrderSignatureAndPhotos(selectedWo.id, undefined, compressed);
    } catch {
      alert('No se pudo procesar la fotografía.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Barra superior de filtros por estado de orden externa */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              'Todas',
              'Reportada',
              'Asignada',
              'En taller',
              'Reparada',
              'Cerrada',
            ] as const
          ).map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filterStatus === st
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowNewModal(true)}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nueva Orden de Reparación Externa
        </button>
      </div>

      {/* Layout Maestro-Detalle de Órdenes de Reparación Externas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Lista de Órdenes */}
        <div className="lg:col-span-5 space-y-3">
          {filteredOrders.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-500">
              No hay órdenes de reparación externas en este estado.
            </div>
          ) : (
            filteredOrders.map((wo) => {
              const amb = ambulances.find((a) => a.id === wo.ambulanceId);
              const ws = workshops.find((w) => w.id === wo.workshopId);
              const isSelected = selectedWo?.id === wo.id;
              const totalPartsQty = wo.partsUsed.reduce(
                (acc, p) => acc + p.quantity,
                0
              );
              const downtimeDays = calculateDowntimeDays(
                wo.entryDate || wo.createdAt,
                wo.exitDate || wo.completedAt,
                wo.status
              );

              return (
                <div
                  key={wo.id}
                  onClick={() => setSelectedWoId(wo.id)}
                  className={`p-4 rounded-xl border transition cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50/50 border-blue-500 ring-2 ring-blue-500/20 shadow-sm'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold px-2 py-0.5 rounded bg-slate-900 text-white">
                        {wo.code}
                      </span>
                      <span className="text-xs font-bold text-slate-700">
                        {amb?.code} ({amb?.plate})
                      </span>
                    </div>
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                        wo.status === 'Cerrada'
                          ? 'bg-emerald-100 text-emerald-800'
                          : wo.status === 'Reparada'
                          ? 'bg-teal-100 text-teal-800'
                          : wo.status === 'En taller'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {wo.status}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 mt-2">
                    {wo.title}
                  </h3>
                  <p className="text-xs font-semibold text-blue-700 mt-0.5 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5" />
                    {ws?.name || 'Taller externo pendiente de asignar'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                    {wo.description}
                  </p>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                    <span className="flex items-center gap-1 font-semibold text-amber-800">
                      <Clock className="w-3.5 h-3.5" />
                      {downtimeDays} {downtimeDays === 1 ? 'día' : 'días'} parado
                    </span>
                    <div className="flex items-center gap-2">
                      {wo.photos && wo.photos.length > 0 && (
                        <span className="text-blue-600 font-semibold">
                          📷 {wo.photos.length}
                        </span>
                      )}
                      <span className="font-semibold text-slate-700">
                        {totalPartsQty} repuestos suministrados
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Detalle de la Orden Externa seleccionada */}
        {selectedWo && (
          <div className="lg:col-span-7">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
              {(() => {
                const amb = ambulances.find(
                  (a) => a.id === selectedWo.ambulanceId
                );
                const ws = workshops.find((w) => w.id === selectedWo.workshopId);
                const totalPartsCount = selectedWo.partsUsed.reduce(
                  (acc, p) => acc + p.quantity,
                  0
                );
                const downtimeDays = calculateDowntimeDays(
                  selectedWo.entryDate || selectedWo.createdAt,
                  selectedWo.exitDate || selectedWo.completedAt,
                  selectedWo.status
                );

                return (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-1 rounded bg-slate-900 text-white text-xs font-bold">
                            {selectedWo.code}
                          </span>
                          <span className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-100 text-slate-700">
                            {selectedWo.type}
                          </span>
                          <span className="text-xs font-bold px-2.5 py-1 rounded bg-rose-50 text-rose-700">
                            Prioridad: {selectedWo.priority}
                          </span>
                        </div>
                        <h2 className="text-lg font-bold text-slate-900 mt-2">
                          {selectedWo.title}
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Unidad: <strong>{amb?.code}</strong> ({amb?.brand}{' '}
                          {amb?.model} - {amb?.plate}) • Km Entrada:{' '}
                          <strong>
                            {selectedWo.mileageAtEntry.toLocaleString()} km
                          </strong>
                        </p>
                      </div>

                      <div className="flex flex-wrap items-end gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            shareWorkOrderViaWhatsApp(selectedWo, amb, ws)
                          }
                          className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          WhatsApp Taller
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            printWorkOrderReport(selectedWo, amb, ws)
                          }
                          className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-semibold flex items-center gap-1.5"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Volante Taller PDF
                        </button>
                        <div>
                          <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                            Estado (Reportada → Cerrada)
                          </label>
                          <select
                            value={selectedWo.status}
                            onChange={(e) =>
                              onUpdateWorkOrderStatus(
                                selectedWo.id,
                                e.target.value as WorkOrderStatus
                              )
                            }
                            className="text-xs font-bold rounded-lg border border-slate-300 px-3 py-2 bg-slate-50 text-slate-900"
                          >
                            <option value="Reportada">1. Reportada</option>
                            <option value="Asignada">2. Asignada a Taller</option>
                            <option value="En taller">
                              3. En taller (Ambulancia → En taller)
                            </option>
                            <option value="Reparada">4. Reparada</option>
                            <option value="Cerrada">
                              5. Cerrada (Ambulancia → Disponible)
                            </option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Taller Externo Asignado y Fechas Entrada / Salida / Días Parado */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-2">
                        <span className="text-slate-500 font-bold uppercase block">
                          Taller Externo Asignado
                        </span>
                        <select
                          value={selectedWo.workshopId || ''}
                          onChange={(e) =>
                            onUpdateWorkOrderDetails(selectedWo.id, {
                              workshopId: e.target.value,
                            })
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-bold text-slate-900"
                        >
                          {workshops.map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.name} ({w.specialty})
                            </option>
                          ))}
                        </select>
                        {ws && (
                          <div className="text-[11px] text-slate-600 space-y-0.5 pt-1">
                            <p>
                              Contacto: <strong>{ws.contactPerson}</strong> • Tel:{' '}
                              <strong>{ws.phone}</strong>
                            </p>
                            <p>Zona: {ws.zone}</p>
                          </div>
                        )}
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 font-bold uppercase">
                            Control de Estancia y Días Parado
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-extrabold">
                            {downtimeDays} {downtimeDays === 1 ? 'día' : 'días'} parado
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">
                              Fecha Entrada Taller
                            </label>
                            <input
                              type="date"
                              value={selectedWo.entryDate || selectedWo.createdAt}
                              onChange={(e) =>
                                onUpdateWorkOrderDetails(selectedWo.id, {
                                  entryDate: e.target.value,
                                })
                              }
                              className="w-full px-2 py-1 rounded border border-slate-300 bg-white font-semibold"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">
                              Fecha Salida Taller
                            </label>
                            <input
                              type="date"
                              value={selectedWo.exitDate || ''}
                              onChange={(e) =>
                                onUpdateWorkOrderDetails(selectedWo.id, {
                                  exitDate: e.target.value || undefined,
                                })
                              }
                              className="w-full px-2 py-1 rounded border border-slate-300 bg-white font-semibold"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Motivo reportado y Garantía */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
                        <span className="text-slate-500 font-bold uppercase block mb-1">
                          Motivo / Descripción de la Avería
                        </span>
                        <p className="text-slate-800">{selectedWo.description}</p>
                        <p className="text-slate-500 mt-2">
                          Reportado por: <strong>{selectedWo.reportedBy}</strong>
                        </p>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-2">
                        <span className="text-slate-500 font-bold uppercase flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          Garantía de la Reparación Externa
                        </span>
                        <input
                          type="text"
                          value={selectedWo.warranty || ''}
                          onChange={(e) =>
                            onUpdateWorkOrderDetails(selectedWo.id, {
                              warranty: e.target.value,
                            })
                          }
                          placeholder="Ej. 6 meses o 15.000 km en piezas y montaje"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold"
                        />
                        <p className="text-[11px] text-slate-500">
                          Registra el plazo o condiciones de garantía indicadas por el taller externo.
                        </p>
                      </div>
                    </div>

                    {/* Informe del Taller Externo */}
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                        <label className="block text-xs font-bold uppercase text-slate-600">
                          Informe Técnico del Taller Externo
                        </label>
                        <VoiceDictationButton
                          label="Dictar Informe del Taller"
                          onTranscript={(text) =>
                            onUpdateWorkOrderDetails(selectedWo.id, {
                              workshopReport: selectedWo.workshopReport
                                ? `${selectedWo.workshopReport}. ${text}`
                                : text,
                            })
                          }
                        />
                      </div>
                      <textarea
                        rows={2}
                        value={selectedWo.workshopReport || ''}
                        onChange={(e) =>
                          onUpdateWorkOrderDetails(selectedWo.id, {
                            workshopReport: e.target.value,
                          })
                        }
                        placeholder="Describe los trabajos realizados por el taller externo, piezas sustituidas y observaciones de entrega..."
                        className="w-full p-3 rounded-xl border border-slate-300 text-xs"
                      />
                    </div>

                    {/* Galería de Fotos de Avería / Reparación */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Camera className="w-4 h-4 text-blue-600" />
                          Fotografías de la Avería / Parte del Taller (
                          {selectedWo.photos?.length || 0})
                        </span>
                        <label className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer">
                          <Camera className="w-3.5 h-3.5" />
                          <span>Adjuntar Foto Comprimida</span>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handleWorkshopPhotoUpload}
                            className="hidden"
                          />
                        </label>
                      </div>

                      {selectedWo.photos && selectedWo.photos.length > 0 ? (
                        <div className="flex flex-wrap gap-3">
                          {selectedWo.photos.map((ph, idx) => (
                            <img
                              key={idx}
                              src={ph}
                              alt={`Foto Orden ${idx + 1}`}
                              onClick={() => setPreviewPhoto(ph)}
                              className="w-24 h-20 object-cover rounded-lg border border-slate-300 cursor-pointer hover:opacity-90"
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">
                          No hay fotos adjuntas en esta orden todavía.
                        </p>
                      )}
                    </div>

                    {/* Repuestos propios suministrados al taller externo (SIN importes, descuentan stock) */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <PackagePlus className="w-4 h-4 text-blue-600" />
                        Repuestos Propios Suministrados al Taller Externo (Descuentan Stock)
                      </h3>

                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                              <th className="py-2.5 px-3">Pieza / Repuesto Entregado</th>
                              <th className="py-2.5 px-3">Referencia SKU</th>
                              <th className="py-2.5 px-3 text-right">
                                Cantidad Suministrada
                              </th>
                              {selectedWo.status !== 'Cerrada' && (
                                <th className="py-2.5 px-3 text-right">Devolver</th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {selectedWo.partsUsed.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={selectedWo.status !== 'Cerrada' ? 4 : 3}
                                  className="py-4 text-center text-slate-400"
                                >
                                  No se han suministrado repuestos propios a esta orden externa.
                                </td>
                              </tr>
                            ) : (
                              selectedWo.partsUsed.map((pu, idx) => (
                                <tr key={`${pu.partId}-${idx}`}>
                                  <td className="py-2.5 px-3 font-medium text-slate-800">
                                    {pu.partName}
                                  </td>
                                  <td className="py-2.5 px-3 font-mono text-slate-500">
                                    {pu.sku}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                                    {pu.quantity} uds.
                                  </td>
                                  {selectedWo.status !== 'Cerrada' && (
                                    <td className="py-2.5 px-3 text-right">
                                      <button
                                        type="button"
                                        title="Cancelar suministro y devolver repuesto al stock del almacén"
                                        onClick={() =>
                                          onRemovePartFromWorkOrder(
                                            selectedWo.id,
                                            idx
                                          )
                                        }
                                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </td>
                                  )}
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Formulario para suministrar repuesto desde almacén propio */}
                      {selectedWo.status !== 'Cerrada' && (
                        <form
                          onSubmit={handleAddPart}
                          className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center gap-2 text-xs"
                        >
                          <select
                            value={partIdToAdd}
                            onChange={(e) => setPartIdToAdd(e.target.value)}
                            className="flex-1 min-w-[220px] px-3 py-2 rounded-lg border border-slate-300 bg-white font-medium"
                          >
                            {spareParts.map((sp) => (
                              <option key={sp.id} value={sp.id}>
                                {sp.name} (Stock almacén: {sp.stockQuantity} uds.)
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min={1}
                            value={partQtyToAdd}
                            onChange={(e) =>
                              setPartQtyToAdd(Number(e.target.value))
                            }
                            className="w-20 px-3 py-2 rounded-lg border border-slate-300 bg-white font-bold"
                          />
                          <button
                            type="submit"
                            className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold"
                          >
                            + Suministrar Repuesto a Taller
                          </button>
                        </form>
                      )}
                    </div>

                    {/* Firmas Digitales: Entrega y Recepción de Conformidad */}
                    <div className="space-y-4 pt-3 border-t border-slate-100">
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <PenTool className="w-4 h-4 text-blue-600" />
                        Conformidad de Entrega y Recepción del Vehículo
                      </h3>

                      {selectedWo.inspectorSignature && (
                        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                          <div className="text-xs">
                            <span className="font-bold text-slate-800 block">
                              Firma de Apertura / Envío a Taller Externo
                            </span>
                            <span className="text-slate-500">
                              {selectedWo.reportedBy}
                            </span>
                          </div>
                          <img
                            src={selectedWo.inspectorSignature}
                            alt="Firma Encargado"
                            className="h-14 bg-white px-3 py-1 rounded border border-slate-200 object-contain"
                          />
                        </div>
                      )}

                      {selectedWo.workshopConformitySignature ? (
                        <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-wrap items-center justify-between gap-3">
                          <div className="text-xs">
                            <span className="font-bold text-emerald-900 flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              Recepción y Conformidad Firmada
                            </span>
                            <span className="text-emerald-700">
                              Taller: {ws?.name || 'Taller Externo'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <img
                              src={selectedWo.workshopConformitySignature}
                              alt="Firma Conformidad"
                              className="h-14 bg-white px-3 py-1 rounded border border-emerald-200 object-contain"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateWorkOrderSignatureAndPhotos(
                                  selectedWo.id,
                                  ''
                                )
                              }
                              className="text-xs text-rose-600 font-semibold hover:underline"
                            >
                              Borrar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <SignaturePad
                          label="Firma de Recepción / Conformidad de Reparación Externa"
                          subtitle="Firma al recoger la ambulancia del taller externo para validar el cierre de la orden."
                          value={selectedWo.workshopConformitySignature}
                          onChange={(sig) =>
                            onUpdateWorkOrderSignatureAndPhotos(
                              selectedWo.id,
                              sig
                            )
                          }
                        />
                      )}
                    </div>

                    {/* Resumen Operativo sin ningún campo monetario */}
                    <div className="p-4 rounded-xl bg-slate-900 text-white flex flex-wrap items-center justify-between gap-4 text-xs">
                      <div>
                        <span className="text-slate-400">Días Parado: </span>
                        <strong className="text-amber-400">
                          {downtimeDays} {downtimeDays === 1 ? 'día' : 'días'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400">Garantía: </span>
                        <strong className="text-white">
                          {selectedWo.warranty || 'Según taller externo'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400">
                          Repuestos Suministrados:{' '}
                        </span>
                        <strong className="text-emerald-400 text-sm">
                          {totalPartsCount} unidades
                        </strong>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Modal Vista Previa de Foto */}
      {previewPhoto && (
        <div
          onClick={() => setPreviewPhoto(null)}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50"
        >
          <div className="max-w-2xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl">
            <img
              src={previewPhoto}
              alt="Foto Orden de Reparación"
              className="w-full max-h-[75vh] object-contain bg-slate-900"
            />
            <div className="p-3 bg-slate-900 text-white flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nueva Orden de Reparación Externa */}
      {showNewModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              Nueva Orden de Reparación en Taller Externo
            </h3>
            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Ambulancia
                  </label>
                  <select
                    value={newWo.ambulanceId}
                    onChange={(e) =>
                      setNewWo({ ...newWo, ambulanceId: e.target.value })
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
                    Taller Externo Asignado
                  </label>
                  <select
                    value={newWo.workshopId}
                    onChange={(e) =>
                      setNewWo({ ...newWo, workshopId: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  >
                    {workshops.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.specialty})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Estado Inicial
                  </label>
                  <select
                    value={newWo.status}
                    onChange={(e) =>
                      setNewWo({
                        ...newWo,
                        status: e.target.value as WorkOrderStatus,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-semibold"
                  >
                    <option value="Reportada">Reportada</option>
                    <option value="Asignada">Asignada</option>
                    <option value="En taller">En taller</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Prioridad
                  </label>
                  <select
                    value={newWo.priority}
                    onChange={(e) =>
                      setNewWo({
                        ...newWo,
                        priority: e.target.value as WorkOrderPriority,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  >
                    <option value="Baja">Baja</option>
                    <option value="Media">Media</option>
                    <option value="Alta">Alta</option>
                    <option value="Crítica (Urgente)">Crítica (Urgente)</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Fecha Entrada
                  </label>
                  <input
                    type="date"
                    value={newWo.entryDate}
                    onChange={(e) =>
                      setNewWo({ ...newWo, entryDate: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Motivo de la Reparación *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Fallo en compresor A/C célula sanitaria"
                  value={newWo.title}
                  onChange={(e) =>
                    setNewWo({ ...newWo, title: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700 block">
                    Descripción / Síntomas para el Taller Externo
                  </label>
                  <VoiceDictationButton
                    label="Dictar Síntomas"
                    onTranscript={(text) =>
                      setNewWo((prev) => ({
                        ...prev,
                        description: prev.description
                          ? `${prev.description}. ${text}`
                          : text,
                      }))
                    }
                  />
                </div>
                <textarea
                  rows={3}
                  required
                  value={newWo.description}
                  onChange={(e) =>
                    setNewWo({ ...newWo, description: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Reportado por
                  </label>
                  <input
                    type="text"
                    value={newWo.reportedBy}
                    onChange={(e) =>
                      setNewWo({ ...newWo, reportedBy: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Condiciones de Garantía
                  </label>
                  <input
                    type="text"
                    value={newWo.warranty}
                    onChange={(e) =>
                      setNewWo({ ...newWo, warranty: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
                >
                  Crear Orden Externa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
