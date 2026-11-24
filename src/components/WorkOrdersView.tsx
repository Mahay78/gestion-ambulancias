import React, { useState } from 'react';
import {
  Ambulance,
  SparePart,
  WorkOrder,
  WorkOrderPriority,
  WorkOrderStatus,
  WorkOrderType,
} from '../types';
import { SignaturePad } from './SignaturePad';
import {
  Plus,
  PackagePlus,
  Camera,
  CheckCircle2,
  PenTool,
} from 'lucide-react';

interface WorkOrdersViewProps {
  ambulances: Ambulance[];
  workOrders: WorkOrder[];
  spareParts: SparePart[];
  onCreateWorkOrder: (wo: Omit<WorkOrder, 'id' | 'code'>) => void;
  onUpdateWorkOrderStatus: (woId: string, status: WorkOrderStatus) => void;
  onAddPartToWorkOrder: (woId: string, partId: string, quantity: number) => void;
  onUpdateWorkOrderDetails: (
    woId: string,
    laborHours: number,
    mechanicDiagnosis: string
  ) => void;
  onUpdateWorkOrderSignatureAndPhotos: (
    woId: string,
    mechanicSignature?: string,
    newPhotoUrl?: string
  ) => void;
}

export const WorkOrdersView: React.FC<WorkOrdersViewProps> = ({
  ambulances,
  workOrders,
  spareParts,
  onCreateWorkOrder,
  onUpdateWorkOrderStatus,
  onAddPartToWorkOrder,
  onUpdateWorkOrderDetails,
  onUpdateWorkOrderSignatureAndPhotos,
}) => {
  const [selectedWoId, setSelectedWoId] = useState<string>(
    workOrders[0]?.id || ''
  );
  const [filterStatus, setFilterStatus] = useState<string>('Todas');
  const [showNewModal, setShowNewModal] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  // Selector para añadir pieza a la OT activa
  const [partIdToAdd, setPartIdToAdd] = useState<string>(
    spareParts[0]?.id || ''
  );
  const [partQtyToAdd, setPartQtyToAdd] = useState<number>(1);

  // Formulario nueva OT
  const [newWo, setNewWo] = useState({
    ambulanceId: ambulances[0]?.id || 'amb-1',
    type: 'Correctivo (Avería)' as WorkOrderType,
    priority: 'Alta' as WorkOrderPriority,
    title: '',
    description: '',
    reportedBy: 'Carlos Mendoza (Responsable de Flota)',
    assignedMechanic: 'Javier Ortega (Jefe de Taller)',
    laborHours: 2,
    laborHourlyRate: 0,
    mechanicDiagnosis: '',
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
      status: 'En Diagnóstico',
      createdAt: new Date().toISOString().split('T')[0],
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

  const handleWorkshopPhotoUpload = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!selectedWo) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 800;
        let w = img.width;
        let h = img.height;
        if (w > h && w > maxDim) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else if (h > maxDim) {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          onUpdateWorkOrderSignatureAndPhotos(
            selectedWo.id,
            undefined,
            canvas.toDataURL('image/jpeg', 0.72)
          );
        }
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      {/* Barra superior de filtros */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {[
            'Todas',
            'Pendiente',
            'En Diagnóstico',
            'Esperando Repuestos',
            'En Reparación',
            'Finalizada',
          ].map((st) => (
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
          Nueva Orden de Trabajo (OT)
        </button>
      </div>

      {/* Layout Maestro-Detalle de Órdenes de Trabajo */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Lista de OTs */}
        <div className="lg:col-span-5 space-y-3">
          {filteredOrders.map((wo) => {
            const amb = ambulances.find((a) => a.id === wo.ambulanceId);
            const isSelected = selectedWo?.id === wo.id;
            const totalPartsQty = wo.partsUsed.reduce(
              (acc, p) => acc + p.quantity,
              0
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
                      wo.status === 'Finalizada'
                        ? 'bg-emerald-100 text-emerald-800'
                        : wo.status === 'En Reparación'
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
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                  {wo.description}
                </p>

                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                  <span>{wo.createdAt}</span>
                  <div className="flex items-center gap-2">
                    {wo.photos && wo.photos.length > 0 && (
                      <span className="text-blue-600 font-semibold">
                        📷 {wo.photos.length}
                      </span>
                    )}
                    {(wo.inspectorSignature || wo.mechanicSignature) && (
                      <span className="text-emerald-700 font-semibold">
                        ✍️ Firmada
                      </span>
                    )}
                    <span className="font-semibold text-slate-700">
                      {totalPartsQty} piezas • {wo.laborHours} h
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Detalle de la OT seleccionada */}
        {selectedWo && (
          <div className="lg:col-span-7">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
              {(() => {
                const amb = ambulances.find(
                  (a) => a.id === selectedWo.ambulanceId
                );
                const totalPartsCount = selectedWo.partsUsed.reduce(
                  (acc, p) => acc + p.quantity,
                  0
                );

                return (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
                      <div>
                        <div className="flex items-center gap-2">
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
                          {amb?.model} - {amb?.plate}) • Entrada a los{' '}
                          <strong>
                            {selectedWo.mileageAtEntry.toLocaleString()} km
                          </strong>
                        </p>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                          Estado de la Orden
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
                          <option value="Pendiente">Pendiente</option>
                          <option value="En Diagnóstico">En Diagnóstico</option>
                          <option value="Esperando Repuestos">
                            Esperando Repuestos
                          </option>
                          <option value="En Reparación">En Reparación</option>
                          <option value="Finalizada">
                            Finalizada (Alta Operativa Ambulancia)
                          </option>
                        </select>
                      </div>
                    </div>

                    {/* Descripción e información de mecánico */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
                        <span className="text-slate-400 font-bold uppercase block mb-1">
                          Reporte de Entrada / Síntomas
                        </span>
                        <p className="text-slate-800">{selectedWo.description}</p>
                        <p className="text-slate-500 mt-2">
                          Reportado por: <strong>{selectedWo.reportedBy}</strong>
                        </p>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-2">
                        <span className="text-slate-400 font-bold uppercase block">
                          Diagnóstico Técnico y Tiempo de Taller
                        </span>
                        <p className="text-slate-700">
                          Mecánico asignado:{' '}
                          <strong>{selectedWo.assignedMechanic}</strong>
                        </p>
                        <div>
                          <label className="block text-slate-600 font-semibold mb-1">
                            Horas de Trabajo Invertidas (h):
                          </label>
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            value={selectedWo.laborHours}
                            onChange={(e) =>
                              onUpdateWorkOrderDetails(
                                selectedWo.id,
                                Number(e.target.value),
                                selectedWo.mechanicDiagnosis
                              )
                            }
                            className="w-28 px-2.5 py-1 rounded border border-slate-300 bg-white font-bold"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Galería de Fotos de Avería / Reparación */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Camera className="w-4 h-4 text-blue-600" />
                          Fotografías de la Avería / Intervención (
                          {selectedWo.photos?.length || 0})
                        </span>
                        <label className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer">
                          <Camera className="w-3.5 h-3.5" />
                          <span>Añadir Foto de Taller</span>
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
                              alt={`Foto OT ${idx + 1}`}
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

                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                        Informe de Intervención del Mecánico
                      </label>
                      <textarea
                        rows={2}
                        value={selectedWo.mechanicDiagnosis}
                        onChange={(e) =>
                          onUpdateWorkOrderDetails(
                            selectedWo.id,
                            selectedWo.laborHours,
                            e.target.value
                          )
                        }
                        placeholder="Detalla las pruebas realizadas, códigos de avería OBD/diagnosis y trabajos efectuados..."
                        className="w-full p-3 rounded-xl border border-slate-300 text-xs"
                      />
                    </div>

                    {/* Piezas y Repuestos imputados a esta Orden de Trabajo */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <PackagePlus className="w-4 h-4 text-blue-600" />
                        Repuestos Utilizados del Inventario en esta Reparación
                      </h3>

                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                              <th className="py-2.5 px-3">Pieza / Repuesto</th>
                              <th className="py-2.5 px-3">Referencia SKU</th>
                              <th className="py-2.5 px-3 text-right">
                                Cantidad Instalada
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {selectedWo.partsUsed.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={3}
                                  className="py-4 text-center text-slate-400"
                                >
                                  No se han asignado repuestos a esta orden
                                  todavía.
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
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Añadir repuesto desde almacén */}
                      {selectedWo.status !== 'Finalizada' && (
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
                                {sp.name} (Stock disponible: {sp.stockQuantity}{' '}
                                uds.)
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
                            + Añadir Pieza a OT
                          </button>
                        </form>
                      )}
                    </div>

                    {/* Firmas Digitales: Entrega de Flota y Alta Mecánica de Taller */}
                    <div className="space-y-4 pt-3 border-t border-slate-100">
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <PenTool className="w-4 h-4 text-blue-600" />
                        Firmas Digitales de Entrega y Alta Mecánica
                      </h3>

                      {selectedWo.inspectorSignature && (
                        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                          <div className="text-xs">
                            <span className="font-bold text-slate-800 block">
                              Firma de Entrega a Taller (Responsable de Flota)
                            </span>
                            <span className="text-slate-500">
                              {selectedWo.reportedBy}
                            </span>
                          </div>
                          <img
                            src={selectedWo.inspectorSignature}
                            alt="Firma Responsable Flota"
                            className="h-14 bg-white px-3 py-1 rounded border border-slate-200 object-contain"
                          />
                        </div>
                      )}

                      {selectedWo.mechanicSignature ? (
                        <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-wrap items-center justify-between gap-3">
                          <div className="text-xs">
                            <span className="font-bold text-emerald-900 flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              Alta Mecánica Firmada por Jefe de Taller
                            </span>
                            <span className="text-emerald-700">
                              {selectedWo.assignedMechanic}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <img
                              src={selectedWo.mechanicSignature}
                              alt="Firma Jefe de Taller"
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
                          label={`Firma Digital de Alta Mecánica — ${selectedWo.assignedMechanic}`}
                          subtitle="Firma aquí al finalizar la reparación para certificar el alta operativa de la ambulancia."
                          value={selectedWo.mechanicSignature}
                          onChange={(sig) =>
                            onUpdateWorkOrderSignatureAndPhotos(
                              selectedWo.id,
                              sig
                            )
                          }
                        />
                      )}
                    </div>

                    {/* Resumen Operativo de la Orden de Trabajo */}
                    <div className="p-4 rounded-xl bg-slate-900 text-white flex flex-wrap items-center justify-between gap-4 text-xs">
                      <div>
                        <span className="text-slate-400">
                          Tiempo de Taller:{' '}
                        </span>
                        <strong className="text-white">
                          {selectedWo.laborHours} horas
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400">
                          Total Piezas Instaladas:{' '}
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
              alt="Foto Orden de Taller"
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

      {/* Modal Nueva Orden de Trabajo */}
      {showNewModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              Apertura de Orden de Trabajo en Taller
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
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Título de la Avería / Intervención
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
                <label className="font-semibold text-slate-700 block mb-1">
                  Descripción de Síntomas
                </label>
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
                    Mecánico Asignado
                  </label>
                  <input
                    type="text"
                    value={newWo.assignedMechanic}
                    onChange={(e) =>
                      setNewWo({ ...newWo, assignedMechanic: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Solicitado por
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
                  Abrir Orden de Trabajo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
