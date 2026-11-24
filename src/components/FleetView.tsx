import React, { useState } from 'react';
import {
  Ambulance,
  AmbulanceStatus,
  AmbulanceType,
  SparePart,
  WorkOrder,
} from '../types';
import {
  Plus,
  Gauge,
  Wrench,
  PackageCheck,
  AlertCircle,
  CheckCircle2,
  MapPin,
  RefreshCw,
  Trash2,
  PackagePlus,
  ScanLine,
} from 'lucide-react';
import { PlateScannerModal } from './PlateScannerModal';

interface FleetViewProps {
  ambulances: Ambulance[];
  spareParts: SparePart[];
  workOrders: WorkOrder[];
  onAddAmbulance: (amb: Omit<Ambulance, 'id'>) => void;
  onDeleteAmbulance: (id: string) => void;
  onUpdateStatus: (id: string, status: AmbulanceStatus) => void;
  onUpdateMileage: (id: string, newMileage: number) => void;
  onUpdateLegalDates: (
    id: string,
    itvExpiry: string,
    sanitaryCertExpiry: string,
    insuranceExpiry: string
  ) => void;
  onRestockVehiclePart: (ambulanceId: string, partId: string) => void;
  onUpdateVehiclePartQty: (
    ambulanceId: string,
    partId: string,
    field: 'currentQty' | 'requiredQty',
    delta: number
  ) => void;
  onAddPartToVehicleOnboard: (
    ambulanceId: string,
    partId: string,
    requiredQty: number,
    currentQty: number
  ) => void;
  onRemovePartFromVehicleOnboard: (ambulanceId: string, partId: string) => void;
}

export const FleetView: React.FC<FleetViewProps> = ({
  ambulances,
  spareParts,
  workOrders,
  onAddAmbulance,
  onDeleteAmbulance,
  onUpdateStatus,
  onUpdateMileage,
  onUpdateLegalDates,
  onRestockVehiclePart,
  onUpdateVehiclePartQty,
  onAddPartToVehicleOnboard,
  onRemovePartFromVehicleOnboard,
}) => {
  const [selectedAmbId, setSelectedAmbId] = useState<string>(ambulances[0]?.id || '');
  const [filterStatus, setFilterStatus] = useState<string>('Todas');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPlateScanner, setShowPlateScanner] = useState(false);
  const [confirmDeleteAmb, setConfirmDeleteAmb] = useState<Ambulance | null>(null);
  const [mileageInput, setMileageInput] = useState<string>('');

  // Estado para añadir nueva pieza a la dotación del vehículo seleccionado
  const [newOnboardPartId, setNewOnboardPartId] = useState<string>(
    spareParts[0]?.id || ''
  );
  const [newOnboardReqQty, setNewOnboardReqQty] = useState<number>(1);
  const [newOnboardCurQty, setNewOnboardCurQty] = useState<number>(1);

  // Formulario nueva ambulancia
  const [newAmb, setNewAmb] = useState({
    code: `AMB-0${ambulances.length + 1}`,
    plate: '',
    brand: 'Mercedes-Benz',
    model: 'Sprinter 316 CDI',
    year: 2024,
    vin: 'WDB9076431N000000',
    type: 'SVA (UVI Móvil)' as AmbulanceType,
    status: 'Activa' as AmbulanceStatus,
    mileage: 15000,
    baseLocation: 'Base Central - Hospital General',
    fuelType: 'Diésel + AdBlue' as Ambulance['fuelType'],
    itvExpiry: '2027-06-30',
    sanitaryCertExpiry: '2027-06-30',
    insuranceExpiry: '2027-06-30',
    notes: '',
  });

  const filteredAmbulances =
    filterStatus === 'Todas'
      ? ambulances
      : ambulances.filter((a) => a.status === filterStatus);

  const selectedAmb =
    ambulances.find((a) => a.id === selectedAmbId) || filteredAmbulances[0] || ambulances[0];

  const handleOpenAddModal = () => {
    setNewAmb({
      ...newAmb,
      code: `AMB-0${ambulances.length + 1}`,
      plate: '',
    });
    setShowAddModal(true);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAmb.plate.trim()) return;
    onAddAmbulance({
      ...newAmb,
      lastServiceDate: new Date().toISOString().split('T')[0],
      lastServiceMileage: newAmb.mileage,
      onboardParts: [
        {
          partId: 'part-10',
          partName: 'Estuche Repuesto Fusibles + Relés + Lámparas H7/LED',
          requiredQty: 2,
          currentQty: 2,
        },
        {
          partId: 'part-4',
          partName: 'Garrafa AdBlue 10L ISO 22241',
          requiredQty: 1,
          currentQty: 1,
        },
        {
          partId: 'part-3',
          partName: 'Aceite Sintético 5W-30 Low SAPS (1L Retén)',
          requiredQty: 1,
          currentQty: 1,
        },
        {
          partId: 'part-8',
          partName: 'Módulo Estroboscópico LED Azul Prioritario 12/24V',
          requiredQty: 1,
          currentQty: 1,
        },
      ],
    });
    setShowAddModal(false);
  };

  const handleConfirmDelete = () => {
    if (!confirmDeleteAmb) return;
    const idToRemove = confirmDeleteAmb.id;
    onDeleteAmbulance(idToRemove);
    setConfirmDeleteAmb(null);
    const remaining = ambulances.filter((a) => a.id !== idToRemove);
    if (remaining.length > 0) {
      setSelectedAmbId(remaining[0].id);
    }
  };

  const handleMileageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAmb) return;
    const km = Number(mileageInput);
    if (!isNaN(km) && km >= 0) {
      onUpdateMileage(selectedAmb.id, km);
      setMileageInput('');
    }
  };

  const handleAddOnboardPartSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAmb || !newOnboardPartId) return;
    onAddPartToVehicleOnboard(
      selectedAmb.id,
      newOnboardPartId,
      Math.max(1, newOnboardReqQty),
      Math.max(0, newOnboardCurQty)
    );
  };

  // Repuestos en almacén compatibles con la ambulancia seleccionada
  const compatibleWorkshopParts = selectedAmb
    ? spareParts.filter((sp) =>
        sp.compatibleModels.some(
          (m) =>
            m === 'Universal' ||
            `${selectedAmb.brand} ${selectedAmb.model}`
              .toLowerCase()
              .includes(m.toLowerCase()) ||
            m.toLowerCase().includes(selectedAmb.brand.toLowerCase())
        )
      )
    : [];

  const ambWorkOrders = selectedAmb
    ? workOrders.filter((wo) => wo.ambulanceId === selectedAmb.id)
    : [];

  return (
    <div className="space-y-6">
      {/* Barra superior de filtros y botón nueva unidad */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {['Todas', 'Activa', 'En Taller', 'Revisión Pendiente', 'Fuera de Servicio'].map(
            (st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  filterStatus === st
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {st}
              </button>
            )
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPlateScanner(true)}
            className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
          >
            <ScanLine className="w-4 h-4" />
            Escanear Matrícula
          </button>
          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-2 shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            Añadir Unidad (Ambulancia)
          </button>
        </div>
      </div>

      {showPlateScanner && (
        <PlateScannerModal
          ambulances={ambulances}
          onSelectAmbulance={(ambId) => {
            setFilterStatus('Todas');
            setSelectedAmbId(ambId);
          }}
          onClose={() => setShowPlateScanner(false)}
        />
      )}

      {ambulances.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-3">
          <p className="text-sm text-slate-600 font-medium">
            No hay unidades registradas en la flota actualmente.
          </p>
          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Añadir Primera Unidad
          </button>
        </div>
      ) : (
        /* Layout Maestro-Detalle */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Lista de Ambulancias */}
          <div className="lg:col-span-5 space-y-3">
            {filteredAmbulances.map((amb) => {
              const isSelected = selectedAmb?.id === amb.id;
              const missingOnboard = amb.onboardParts.some(
                (p) => p.currentQty < p.requiredQty
              );
              return (
                <div
                  key={amb.id}
                  onClick={() => setSelectedAmbId(amb.id)}
                  className={`p-4 rounded-xl border transition cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50/50 border-blue-500 ring-2 ring-blue-500/20 shadow-sm'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-extrabold text-slate-900">
                          {amb.code}
                        </span>
                        <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-700">
                          {amb.plate}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">
                          {amb.type}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-800 mt-1">
                        {amb.brand} {amb.model} ({amb.year})
                      </h3>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          amb.status === 'Activa'
                            ? 'bg-emerald-100 text-emerald-800'
                            : amb.status === 'En Taller'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {amb.status}
                      </span>
                      <button
                        type="button"
                        title="Eliminar unidad de la flota"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteAmb(amb);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                    <span className="flex items-center gap-1 font-semibold">
                      <Gauge className="w-3.5 h-3.5 text-slate-400" />
                      {amb.mileage.toLocaleString()} km
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {amb.baseLocation}
                    </span>
                    {missingOnboard && (
                      <span className="text-rose-600 font-semibold flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> Faltan piezas
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Ficha Técnica Mecánica y Stock de Piezas del Vehículo */}
          {selectedAmb && (
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="px-3 py-1 rounded-lg bg-slate-900 text-white text-sm font-extrabold">
                        {selectedAmb.code}
                      </span>
                      <h2 className="text-lg font-bold text-slate-900">
                        {selectedAmb.brand} {selectedAmb.model}
                      </h2>
                      <span className="text-xs font-mono bg-slate-100 px-2.5 py-1 rounded border border-slate-200 font-semibold">
                        {selectedAmb.plate}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Bastidor (VIN): <span className="font-mono">{selectedAmb.vin}</span> •{' '}
                      {selectedAmb.type} • {selectedAmb.baseLocation}
                    </p>
                  </div>

                  {/* Selector rápido de Estado Operativo + Botón Eliminar Unidad */}
                  <div className="flex items-end gap-2">
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                        Estado Operativo
                      </label>
                      <select
                        value={selectedAmb.status}
                        onChange={(e) =>
                          onUpdateStatus(
                            selectedAmb.id,
                            e.target.value as AmbulanceStatus
                          )
                        }
                        className="text-xs font-bold rounded-lg border border-slate-300 px-3 py-2 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="Activa">Activa (Operativa)</option>
                        <option value="En Taller">En Taller Mecánico</option>
                        <option value="Revisión Pendiente">Revisión Pendiente</option>
                        <option value="Fuera de Servicio">
                          Fuera de Servicio (Baja Temp.)
                        </option>
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => setConfirmDeleteAmb(selectedAmb)}
                      className="px-3 py-2 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold flex items-center gap-1.5 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Eliminar Unidad
                    </button>
                  </div>
                </div>

                {/* Actualización rápida de odómetro y fechas clave */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-5">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="text-xs text-slate-500 block">Kilometraje Actual</span>
                    <span className="text-xl font-extrabold text-slate-900">
                      {selectedAmb.mileage.toLocaleString()} km
                    </span>
                    <form onSubmit={handleMileageSubmit} className="mt-2 flex gap-1.5">
                      <input
                        type="number"
                        min={0}
                        placeholder="Nuevo km..."
                        value={mileageInput}
                        onChange={(e) => setMileageInput(e.target.value)}
                        className="w-full text-xs px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                      />
                      <button
                        type="submit"
                        className="px-2.5 py-1.5 rounded bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 shrink-0"
                      >
                        Guardar
                      </button>
                    </form>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="text-xs text-slate-500 block">
                      Última Revisión Taller
                    </span>
                    <span className="text-sm font-bold text-slate-900 mt-1 block">
                      {selectedAmb.lastServiceDate}
                    </span>
                    <span className="text-xs text-slate-600 mt-1 block">
                      A los {selectedAmb.lastServiceMileage.toLocaleString()} km
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="text-xs text-slate-500 block">
                      Resumen Semáforo Legal
                    </span>
                    {(() => {
                      const today = new Date().toISOString().split('T')[0];
                      const getDays = (d: string) =>
                        Math.ceil(
                          (new Date(d).getTime() - new Date(today).getTime()) /
                            (1000 * 3600 * 24)
                        );
                      const dItv = getDays(selectedAmb.itvExpiry);
                      const dSan = getDays(selectedAmb.sanitaryCertExpiry);
                      const dIns = getDays(selectedAmb.insuranceExpiry);
                      const minD = Math.min(dItv, dSan, dIns);
                      return (
                        <div className="mt-1.5 space-y-1 text-xs">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                              minD < 0
                                ? 'bg-rose-600 text-white'
                                : minD <= 30
                                ? 'bg-amber-500 text-white'
                                : 'bg-emerald-600 text-white'
                            }`}
                          >
                            {minD < 0
                              ? 'DOCUMENTACIÓN VENCIDA'
                              : minD <= 30
                              ? `PRÓXIMO VENCIMIENTO (${minD}d)`
                              : 'DOCUMENTACIÓN EN REGLA'}
                          </span>
                          <p className="text-[11px] text-slate-500">
                            ITV ({dItv}d) • Sanitario ({dSan}d) • Seguro ({dIns}d)
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Semáforo de Caducidades Legales (ITV, Certificación Técnico-Sanitaria y Seguro) */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Semáforo de Caducidades Legales (ITV, Cert. Técnico-Sanitario y Seguro)
                    </h3>
                    <span className="text-[11px] text-slate-500">
                      Alerta automática a los 30 días • Editable y renovable en 1 clic
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    {[
                      {
                        key: 'itv' as const,
                        label: 'ITV Ambulancia',
                        dateVal: selectedAmb.itvExpiry,
                        renewMonths: 6,
                        renewLabel: '+6 meses',
                      },
                      {
                        key: 'sanitary' as const,
                        label: 'Certificación Técnico-Sanitaria',
                        dateVal: selectedAmb.sanitaryCertExpiry,
                        renewMonths: 12,
                        renewLabel: '+1 año',
                      },
                      {
                        key: 'insurance' as const,
                        label: 'Póliza de Seguro',
                        dateVal: selectedAmb.insuranceExpiry,
                        renewMonths: 12,
                        renewLabel: '+1 año',
                      },
                    ].map((doc) => {
                      const today = new Date().toISOString().split('T')[0];
                      const diffDays = Math.ceil(
                        (new Date(doc.dateVal).getTime() -
                          new Date(today).getTime()) /
                          (1000 * 3600 * 24)
                      );
                      const isOverdue = diffDays < 0;
                      const isSoon = diffDays >= 0 && diffDays <= 30;

                      const handleDateChange = (newDate: string) => {
                        onUpdateLegalDates(
                          selectedAmb.id,
                          doc.key === 'itv' ? newDate : selectedAmb.itvExpiry,
                          doc.key === 'sanitary'
                            ? newDate
                            : selectedAmb.sanitaryCertExpiry,
                          doc.key === 'insurance'
                            ? newDate
                            : selectedAmb.insuranceExpiry
                        );
                      };

                      const handleQuickRenew = () => {
                        const base =
                          diffDays < 0 ? new Date() : new Date(doc.dateVal);
                        base.setMonth(base.getMonth() + doc.renewMonths);
                        handleDateChange(base.toISOString().split('T')[0]);
                      };

                      return (
                        <div
                          key={doc.key}
                          className={`p-3 rounded-xl border ${
                            isOverdue
                              ? 'bg-rose-50 border-rose-300'
                              : isSoon
                              ? 'bg-amber-50 border-amber-300'
                              : 'bg-white border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1.5">
                            <span className="font-bold text-slate-800">
                              {doc.label}
                            </span>
                            <span
                              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                                isOverdue
                                  ? 'bg-rose-600 text-white'
                                  : isSoon
                                  ? 'bg-amber-500 text-white'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {isOverdue
                                ? `VENCIDO (${Math.abs(diffDays)}d)`
                                : isSoon
                                ? `VENCE EN ${diffDays}d`
                                : `AL DÍA (${diffDays}d)`}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 mt-2">
                            <input
                              type="date"
                              value={doc.dateVal}
                              onChange={(e) => handleDateChange(e.target.value)}
                              className="w-full px-2 py-1 rounded border border-slate-300 bg-white text-xs font-semibold"
                            />
                            <button
                              type="button"
                              onClick={handleQuickRenew}
                              title={`Renovar ${doc.renewLabel}`}
                              className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold shrink-0"
                            >
                              {doc.renewLabel}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Dotación y Stock de Piezas a Bordo del Vehículo (Añadir / Eliminar Unidades) */}
                <div className="mt-6 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <PackageCheck className="w-5 h-5 text-blue-600" />
                      <h3 className="text-sm font-bold text-slate-900">
                        Stock de Piezas del Vehículo ({selectedAmb.code})
                      </h3>
                    </div>
                    <span className="text-xs text-slate-500">
                      Añade, resta o elimina unidades del stock a bordo
                    </span>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                            <th className="py-2.5 px-3">Pieza / Repuesto en Vehículo</th>
                            <th className="py-2.5 px-3 text-center">Uds. Requeridas</th>
                            <th className="py-2.5 px-3 text-center">
                              Uds. Actuales a Bordo
                            </th>
                            <th className="py-2.5 px-3 text-right">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {selectedAmb.onboardParts.length === 0 ? (
                            <tr>
                              <td
                                colSpan={4}
                                className="py-4 text-center text-slate-400"
                              >
                                No hay piezas asignadas a este vehículo. Añade una abajo.
                              </td>
                            </tr>
                          ) : (
                            selectedAmb.onboardParts.map((item) => {
                              const isComplete = item.currentQty >= item.requiredQty;
                              const warehousePart = spareParts.find(
                                (sp) => sp.id === item.partId
                              );
                              return (
                                <tr key={item.partId} className="hover:bg-slate-50">
                                  <td className="py-2.5 px-3 font-medium text-slate-800">
                                    {item.partName}
                                    {warehousePart && (
                                      <span className="block text-[11px] text-slate-400">
                                        En almacén taller: {warehousePart.stockQuantity}{' '}
                                        uds.
                                      </span>
                                    )}
                                  </td>

                                  {/* Control +/- Unidades Requeridas */}
                                  <td className="py-2.5 px-3 text-center">
                                    <div className="inline-flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onUpdateVehiclePartQty(
                                            selectedAmb.id,
                                            item.partId,
                                            'requiredQty',
                                            -1
                                          )
                                        }
                                        className="w-6 h-6 rounded border border-slate-300 bg-white hover:bg-slate-100 font-bold text-slate-700"
                                      >
                                        -
                                      </button>
                                      <span className="w-6 text-center font-bold text-slate-800">
                                        {item.requiredQty}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onUpdateVehiclePartQty(
                                            selectedAmb.id,
                                            item.partId,
                                            'requiredQty',
                                            1
                                          )
                                        }
                                        className="w-6 h-6 rounded border border-slate-300 bg-white hover:bg-slate-100 font-bold text-slate-700"
                                      >
                                        +
                                      </button>
                                    </div>
                                  </td>

                                  {/* Control +/- Unidades Actuales a Bordo */}
                                  <td className="py-2.5 px-3 text-center">
                                    <div className="inline-flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onUpdateVehiclePartQty(
                                            selectedAmb.id,
                                            item.partId,
                                            'currentQty',
                                            -1
                                          )
                                        }
                                        className="w-6 h-6 rounded border border-slate-300 bg-white hover:bg-slate-100 font-bold text-slate-700"
                                      >
                                        -
                                      </button>
                                      <span
                                        className={`w-7 py-0.5 rounded-full font-extrabold text-center ${
                                          isComplete
                                            ? 'bg-emerald-100 text-emerald-800'
                                            : 'bg-rose-100 text-rose-800'
                                        }`}
                                      >
                                        {item.currentQty}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onUpdateVehiclePartQty(
                                            selectedAmb.id,
                                            item.partId,
                                            'currentQty',
                                            1
                                          )
                                        }
                                        className="w-6 h-6 rounded border border-slate-300 bg-white hover:bg-slate-100 font-bold text-slate-700"
                                      >
                                        +
                                      </button>
                                    </div>
                                  </td>

                                  <td className="py-2.5 px-3 text-right">
                                    <div className="inline-flex items-center gap-1.5">
                                      {isComplete ? (
                                        <span className="text-emerald-600 font-semibold inline-flex items-center gap-1">
                                          <CheckCircle2 className="w-3.5 h-3.5" /> OK
                                        </span>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            onRestockVehiclePart(
                                              selectedAmb.id,
                                              item.partId
                                            )
                                          }
                                          className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold inline-flex items-center gap-1 transition"
                                        >
                                          <RefreshCw className="w-3 h-3" /> Reponer
                                        </button>
                                      )}

                                      <button
                                        type="button"
                                        title="Quitar pieza de la dotación de este vehículo"
                                        onClick={() =>
                                          onRemovePartFromVehicleOnboard(
                                            selectedAmb.id,
                                            item.partId
                                          )
                                        }
                                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Formulario rápido para añadir una pieza/repuesto al stock del vehículo */}
                  <form
                    onSubmit={handleAddOnboardPartSubmit}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-end gap-2.5 text-xs"
                  >
                    <div className="flex-1 min-w-[180px]">
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">
                        Añadir Pieza al Stock de {selectedAmb.code}
                      </label>
                      <select
                        value={newOnboardPartId}
                        onChange={(e) => setNewOnboardPartId(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-medium"
                      >
                        {spareParts.map((sp) => (
                          <option key={sp.id} value={sp.id}>
                            {sp.name} ({sp.sku})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="w-24">
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">
                        Requeridas
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={newOnboardReqQty}
                        onChange={(e) => setNewOnboardReqQty(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-bold"
                      />
                    </div>

                    <div className="w-24">
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">
                        A Bordo Hoy
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={newOnboardCurQty}
                        onChange={(e) => setNewOnboardCurQty(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-bold"
                      />
                    </div>

                    <button
                      type="submit"
                      className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold flex items-center gap-1.5 h-[32px]"
                    >
                      <PackagePlus className="w-3.5 h-3.5" />
                      Añadir al Vehículo
                    </button>
                  </form>
                </div>

                {/* Repuestos en Almacén de Taller compatibles con este modelo */}
                <div className="mt-6 pt-5 border-t border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900 mb-2">
                    Stock en Almacén de Taller Compatible con {selectedAmb.brand}{' '}
                    {selectedAmb.model}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {compatibleWorkshopParts.map((sp) => (
                      <div
                        key={sp.id}
                        className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-semibold text-slate-800">{sp.name}</p>
                          <p className="text-[11px] text-slate-500">
                            SKU: {sp.sku} • {sp.locationInWorkshop}
                          </p>
                        </div>
                        <span
                          className={`px-2 py-1 rounded font-bold shrink-0 ${
                            sp.stockQuantity <= sp.minStockAlert
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {sp.stockQuantity} uds.
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Historial resumido de OTs del vehículo */}
                <div className="mt-6 pt-5 border-t border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                    <Wrench className="w-4 h-4 text-slate-600" />
                    Historial Mecánico de {selectedAmb.code} ({ambWorkOrders.length} OTs)
                  </h3>
                  {ambWorkOrders.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      Sin órdenes de trabajo registradas para esta unidad.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {ambWorkOrders.map((wo) => (
                        <div
                          key={wo.id}
                          className="p-3 rounded-lg border border-slate-200 text-xs flex items-center justify-between"
                        >
                          <div>
                            <span className="font-bold text-slate-900">{wo.code}</span> •{' '}
                            <span className="font-semibold text-slate-800">
                              {wo.title}
                            </span>
                            <p className="text-slate-500 mt-0.5">
                              {wo.createdAt} • {wo.mileageAtEntry.toLocaleString()} km •
                              Mecánico: {wo.assignedMechanic}
                            </p>
                          </div>
                          <span className="px-2.5 py-1 rounded-full font-semibold bg-slate-100 text-slate-800">
                            {wo.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Confirmación Eliminar Ambulancia */}
      {confirmDeleteAmb && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  ¿Eliminar unidad {confirmDeleteAmb.code} ({confirmDeleteAmb.plate})?
                </h3>
                <p className="text-xs text-slate-500">
                  {confirmDeleteAmb.brand} {confirmDeleteAmb.model}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              Esta acción dará de baja la ambulancia de la flota activa junto con su
              programación preventiva asociada.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => setConfirmDeleteAmb(null)}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold"
              >
                Sí, Eliminar Unidad
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dar de Alta Ambulancia */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              Añadir Nueva Unidad (Ambulancia) a la Flota
            </h3>
            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Código Unidad
                  </label>
                  <input
                    type="text"
                    required
                    value={newAmb.code}
                    onChange={(e) => setNewAmb({ ...newAmb, code: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Matrícula
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="1234-MMM"
                    value={newAmb.plate}
                    onChange={(e) => setNewAmb({ ...newAmb, plate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Marca</label>
                  <input
                    type="text"
                    required
                    value={newAmb.brand}
                    onChange={(e) => setNewAmb({ ...newAmb, brand: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Modelo / Motorización
                  </label>
                  <input
                    type="text"
                    required
                    value={newAmb.model}
                    onChange={(e) => setNewAmb({ ...newAmb, model: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Tipo Carrozado
                  </label>
                  <select
                    value={newAmb.type}
                    onChange={(e) =>
                      setNewAmb({ ...newAmb, type: e.target.value as AmbulanceType })
                    }
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300"
                  >
                    <option value="SVA (UVI Móvil)">SVA (UVI Móvil)</option>
                    <option value="SVB (Soporte Vital Básico)">SVB</option>
                    <option value="TNA (Transporte No Asistido)">TNA</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Año</label>
                  <input
                    type="number"
                    value={newAmb.year}
                    onChange={(e) => setNewAmb({ ...newAmb, year: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Kilometraje
                  </label>
                  <input
                    type="number"
                    value={newAmb.mileage}
                    onChange={(e) =>
                      setNewAmb({ ...newAmb, mileage: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Base Asignada
                  </label>
                  <input
                    type="text"
                    value={newAmb.baseLocation}
                    onChange={(e) =>
                      setNewAmb({ ...newAmb, baseLocation: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Vencimiento ITV
                  </label>
                  <input
                    type="date"
                    value={newAmb.itvExpiry}
                    onChange={(e) => setNewAmb({ ...newAmb, itvExpiry: e.target.value })}
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
                  Guardar Unidad
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
