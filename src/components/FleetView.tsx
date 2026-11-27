import React, { useEffect, useState } from 'react';
import {
  Ambulance,
  AmbulanceStatus,
  AmbulanceType,
  ExternalWorkshop,
  FleetChecklist,
  PreventiveSchedule,
  SparePart,
  StockMovement,
  VehicleDocument,
  WorkOrder,
} from '../types';
import {
  ensureAmbulanceDocuments,
  calculateDaysRemaining,
  getExpiryBadgeMeta,
} from '../utils/expiryAlerts';
import { addMonthsLocal, getLocalDateString } from '../utils/dateUtils';
import { compressImageFile } from '../utils/imageCompression';
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
  FileText,
  Upload,
  Eye,
  History,
  ClipboardCheck,
  CalendarClock,
  Package,
  QrCode,
} from 'lucide-react';
import { PlateScannerModal } from './PlateScannerModal';
import { QrLabelsModal } from './QrLabelsModal';
import { BodyDamageMap } from './BodyDamageMap';
import { TiresAndBatteriesPanel } from './TiresAndBatteriesPanel';

interface FleetViewProps {
  ambulances: Ambulance[];
  spareParts: SparePart[];
  workOrders: WorkOrder[];
  checklists?: FleetChecklist[];
  preventiveSchedules?: PreventiveSchedule[];
  stockMovements?: StockMovement[];
  workshops?: ExternalWorkshop[];
  initialSelectedAmbulanceId?: string;
  onAddAmbulance: (amb: Omit<Ambulance, 'id'>) => string | void;
  onDeleteAmbulance: (id: string) => void;
  onUpdateStatus: (id: string, status: AmbulanceStatus) => void;
  onUpdateMileage: (id: string, newMileage: number) => void;
  onUpdateLegalDates: (
    id: string,
    itvExpiry: string,
    sanitaryCertExpiry: string,
    insuranceExpiry: string
  ) => void;
  onUpdateVehicleDocument?: (ambulanceId: string, doc: VehicleDocument) => void;
  onUpdateBodyAndVisualState?: (
    ambulanceId: string,
    patch: Partial<Pick<Ambulance, 'bodyDamages' | 'tires' | 'batteries'>>
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
  checklists = [],
  preventiveSchedules = [],
  stockMovements = [],
  workshops = [],
  initialSelectedAmbulanceId,
  onAddAmbulance,
  onDeleteAmbulance,
  onUpdateStatus,
  onUpdateMileage,
  onUpdateLegalDates,
  onUpdateVehicleDocument,
  onUpdateBodyAndVisualState,
  onRestockVehiclePart,
  onUpdateVehiclePartQty,
  onAddPartToVehicleOnboard,
  onRemovePartFromVehicleOnboard,
}) => {
  const [selectedAmbId, setSelectedAmbId] = useState<string>(
    initialSelectedAmbulanceId || ambulances[0]?.id || ''
  );
  const [showQrLabels, setShowQrLabels] = useState(false);

  useEffect(() => {
    if (initialSelectedAmbulanceId) {
      setSelectedAmbId(initialSelectedAmbulanceId);
    }
  }, [initialSelectedAmbulanceId]);
  const [filterStatus, setFilterStatus] = useState<string>('Todas');
  const [historyFilter, setHistoryFilter] = useState<
    'all' | 'orders' | 'incidents' | 'preventive' | 'documents' | 'stock'
  >('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addError, setAddError] = useState('');
  const [addSuccessMsg, setAddSuccessMsg] = useState('');
  const [showPlateScanner, setShowPlateScanner] = useState(false);
  const [confirmDeleteAmb, setConfirmDeleteAmb] = useState<Ambulance | null>(null);
  const [mileageInput, setMileageInput] = useState<string>('');
  const [previewDocFile, setPreviewDocFile] = useState<{ title: string; url: string } | null>(
    null
  );

  // Estado para añadir nueva pieza a la dotación del vehículo seleccionado
  const [newOnboardPartId, setNewOnboardPartId] = useState<string>(
    spareParts[0]?.id || ''
  );
  const [newOnboardReqQty, setNewOnboardReqQty] = useState<number>(1);
  const [newOnboardCurQty, setNewOnboardCurQty] = useState<number>(1);

  // Formulario nueva ambulancia
  const [newAmb, setNewAmb] = useState({
    code: `AMB-${String(ambulances.length + 1).padStart(2, '0')}`,
    plate: '',
    brand: 'Mercedes-Benz',
    model: 'Sprinter 316 CDI',
    year: 2024,
    vin: 'WDB9076431N000000',
    type: 'SVA (UVI Móvil)' as AmbulanceType,
    status: 'Disponible' as AmbulanceStatus,
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
    const maxNum = ambulances.reduce((max, amb) => {
      const m = amb.code.match(/(\d+)$/);
      const n = m ? parseInt(m[1], 10) : 0;
      return n > max ? n : max;
    }, 0);
    const nextCode = `AMB-${String(maxNum + 1).padStart(2, '0')}`;
    setNewAmb({
      ...newAmb,
      code: nextCode,
      plate: '',
    });
    setAddError('');
    setShowAddModal(true);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    if (!newAmb.code.trim()) {
      setAddError('Introduce el código de la unidad (ej. AMB-22).');
      return;
    }
    if (!newAmb.plate.trim()) {
      setAddError('Introduce la matrícula del vehículo.');
      return;
    }
    if (!newAmb.brand.trim() || !newAmb.model.trim()) {
      setAddError('Introduce la marca y el modelo del vehículo.');
      return;
    }

    const cleanCode = newAmb.code.trim().toUpperCase();
    const cleanPlate = newAmb.plate.trim().toUpperCase();
    const createdId = onAddAmbulance({
      ...newAmb,
      code: cleanCode,
      plate: cleanPlate,
      year: Number(newAmb.year) || new Date().getFullYear(),
      mileage: Math.max(0, Number(newAmb.mileage) || 0),
      lastServiceDate: getLocalDateString(),
      lastServiceMileage: Math.max(0, Number(newAmb.mileage) || 0),
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
    setFilterStatus('Todas');
    if (typeof createdId === 'string' && createdId) {
      setSelectedAmbId(createdId);
    }
    setShowAddModal(false);
    setAddSuccessMsg(`✅ Unidad ${cleanCode} (${cleanPlate}) añadida correctamente.`);
    setTimeout(() => setAddSuccessMsg(''), 4000);
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
    const raw = mileageInput.trim();
    if (!raw) return;
    const km = Number(raw);
    if (!Number.isInteger(km) || km < 0) {
      alert('Introduce un kilometraje entero válido.');
      return;
    }
    if (km < selectedAmb.mileage) {
      const confirmed = window.confirm(
        `El kilometraje introducido (${km.toLocaleString()} km) es menor que el actual (${selectedAmb.mileage.toLocaleString()} km). ¿Confirmas que deseas corregirlo a la baja?`
      );
      if (!confirmed) return;
    }
    onUpdateMileage(selectedAmb.id, km);
    setMileageInput('');
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
          {['Todas', 'Disponible', 'En taller', 'Fuera de servicio'].map(
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
            onClick={() => setShowQrLabels(true)}
            className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
          >
            <QrCode className="w-4 h-4" />
            Etiquetas QR (A4)
          </button>
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

      {addSuccessMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold">
          {addSuccessMsg}
        </div>
      )}

      {showQrLabels && (
        <QrLabelsModal
          ambulances={ambulances}
          onClose={() => setShowQrLabels(false)}
        />
      )}

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
        /* Layout Maestro-Detalle Optimizado para Móvil, Tablet y Escritorio */
        <div className="space-y-4">
          {/* Selector Rápido Táctil en Móvil y Tablet Vertical (< 1024px) */}
          <div className="lg:hidden bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
                Seleccionar Ambulancia ({filteredAmbulances.length})
              </label>
              <span className="text-[11px] text-slate-400">
                Toca o desliza para cambiar
              </span>
            </div>
            <select
              value={selectedAmb?.id || ''}
              onChange={(e) => setSelectedAmbId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-xs font-bold text-slate-900"
            >
              {filteredAmbulances.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.plate} • {a.brand} {a.model} [{a.status}]
                </option>
              ))}
            </select>

            {/* Carrusel horizontal de píldoras para cambio en 1 toque en móvil/tablet */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
              {filteredAmbulances.map((a) => {
                const active = selectedAmb?.id === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setSelectedAmbId(a.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 border transition ${
                      active
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    {a.code} ({a.plate})
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Lista de Ambulancias (Columna lateral en Escritorio / Tablet Horizontal) */}
            <div className="hidden lg:block lg:col-span-5 space-y-2.5 max-h-[82vh] overflow-y-auto pr-1">
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
                            amb.status === 'Disponible'
                              ? 'bg-emerald-100 text-emerald-800'
                              : amb.status === 'En taller'
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
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-6">
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
                        <option value="Disponible">Disponible (Operativa)</option>
                        <option value="En taller">En taller externo</option>
                        <option value="Fuera de servicio">
                          Fuera de servicio (Baja Temp.)
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
                      Resumen Semáforo Documental (30/15/7d)
                    </span>
                    {(() => {
                      const docs = ensureAmbulanceDocuments(selectedAmb);
                      const daysList = docs.map((d) =>
                        calculateDaysRemaining(d.expiryDate)
                      );
                      const minD = Math.min(...daysList);
                      const meta = getExpiryBadgeMeta(minD);
                      return (
                        <div className="mt-1.5 space-y-1 text-xs">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[11px] border ${meta.badgeClass}`}
                          >
                            {minD < 0
                              ? `DOCUMENTO VENCIDO (${Math.abs(minD)}d)`
                              : minD <= 30
                              ? `ALERTA VENCIMIENTO: ${meta.label}`
                              : '4 DOCUMENTOS EN REGLA'}
                          </span>
                          <p className="text-[11px] text-slate-500">
                            ITV, Seguro, Técnico-Sanitario y Ficha Técnica
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Documentación y Vencimientos (4 Documentos Reglamentarios con Alertas 30/15/7 días y Vencidos) */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-blue-600" />
                      Documentación y Vencimientos (ITV, Seguro, Técnico-Sanitario y Ficha Técnica)
                    </h3>
                    <span className="text-[11px] text-slate-500">
                      Alertas: 30d (Ámbar) • 15d (Naranja) • 7d (Rojo) • Vencido
                    </span>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    {ensureAmbulanceDocuments(selectedAmb).map((doc) => {
                      const diffDays = calculateDaysRemaining(doc.expiryDate);
                      const meta = getExpiryBadgeMeta(diffDays);
                      const renewMonths = doc.type === 'ITV' ? 6 : 12;

                      const updateDocField = (patch: Partial<VehicleDocument>) => {
                        const updated: VehicleDocument = { ...doc, ...patch };
                        if (onUpdateVehicleDocument) {
                          onUpdateVehicleDocument(selectedAmb.id, updated);
                        } else if (patch.expiryDate) {
                          onUpdateLegalDates(
                            selectedAmb.id,
                            doc.type === 'ITV' ? patch.expiryDate : selectedAmb.itvExpiry,
                            doc.type === 'Certificado Técnico-Sanitario'
                              ? patch.expiryDate
                              : selectedAmb.sanitaryCertExpiry,
                            doc.type === 'Seguro'
                              ? patch.expiryDate
                              : selectedAmb.insuranceExpiry
                          );
                        }
                      };

                      const handleQuickRenew = () => {
                        const todayStr = getLocalDateString();
                        const baseDateStr = diffDays < 0 ? todayStr : doc.expiryDate;
                        updateDocField({
                          issueDate: todayStr,
                          expiryDate: addMonthsLocal(baseDateStr, renewMonths),
                        });
                      };

                      const handleFileUpload = async (
                        e: React.ChangeEvent<HTMLInputElement>
                      ) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const compressed = await compressImageFile(file, 800, 0.65);
                          updateDocField({
                            fileName: file.name,
                            fileDataUrl: compressed,
                          });
                        } catch (err) {
                          alert(
                            err instanceof Error
                              ? err.message
                              : 'No se pudo adjuntar el archivo.'
                          );
                        }
                      };

                      return (
                        <div
                          key={doc.type}
                          className={`p-3 rounded-xl border ${meta.cardClass}`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">
                                {doc.type}
                              </span>
                              <span
                                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${meta.badgeClass}`}
                              >
                                {meta.label}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {doc.fileDataUrl && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewDocFile({
                                      title: `${doc.type} — ${selectedAmb.code} (${selectedAmb.plate})`,
                                      url: doc.fileDataUrl!,
                                    })
                                  }
                                  className="px-2 py-1 rounded bg-blue-100 text-blue-800 font-bold text-[11px] flex items-center gap-1 hover:bg-blue-200"
                                >
                                  <Eye className="w-3 h-3" />
                                  Ver Archivo
                                </button>
                              )}
                              <label className="px-2 py-1 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-[11px] flex items-center gap-1 cursor-pointer">
                                <Upload className="w-3 h-3 text-blue-600" />
                                <span>{doc.fileName ? 'Cambiar' : 'Adjuntar'}</span>
                                <input
                                  type="file"
                                  accept="image/*,application/pdf"
                                  onChange={handleFileUpload}
                                  className="hidden"
                                />
                              </label>
                              <button
                                type="button"
                                onClick={handleQuickRenew}
                                className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold"
                              >
                                +{renewMonths}m
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div>
                              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">
                                Número / Referencia
                              </label>
                              <input
                                type="text"
                                value={doc.number}
                                onChange={(e) =>
                                  updateDocField({ number: e.target.value })
                                }
                                placeholder="Nº documento..."
                                className="w-full px-2 py-1 rounded border border-slate-300 bg-white text-xs font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">
                                Fecha Emisión
                              </label>
                              <input
                                type="date"
                                value={doc.issueDate}
                                onChange={(e) =>
                                  updateDocField({ issueDate: e.target.value })
                                }
                                className="w-full px-2 py-1 rounded border border-slate-300 bg-white text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">
                                Fecha Vencimiento
                              </label>
                              <input
                                type="date"
                                value={doc.expiryDate}
                                onChange={(e) =>
                                  updateDocField({ expiryDate: e.target.value })
                                }
                                className="w-full px-2 py-1 rounded border border-slate-300 bg-white text-xs font-bold"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Dotación a Bordo Obligatoria del Vehículo (Estado OK / Falta) */}
                <div className="mt-6 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <PackageCheck className="w-5 h-5 text-blue-600" />
                      <h3 className="text-sm font-bold text-slate-900">
                        Dotación a Bordo Obligatoria ({selectedAmb.code}) — Estado OK / Falta
                      </h3>
                    </div>
                    <span className="text-xs text-slate-500">
                      Equipamiento obligatorio por vehículo y reposición desde almacén
                    </span>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                            <th className="py-2.5 px-3">Equipamiento / Pieza a Bordo</th>
                            <th className="py-2.5 px-3 text-center">Estado</th>
                            <th className="py-2.5 px-3 text-center">Exigido</th>
                            <th className="py-2.5 px-3 text-center">
                              Actual a Bordo
                            </th>
                            <th className="py-2.5 px-3 text-right">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {selectedAmb.onboardParts.length === 0 ? (
                            <tr>
                              <td
                                colSpan={5}
                                className="py-4 text-center text-slate-400"
                              >
                                No hay equipamiento asignado a este vehículo. Añade uno abajo.
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
                                        En almacén propio: {warehousePart.stockQuantity}{' '}
                                        uds.
                                      </span>
                                    )}
                                  </td>

                                  {/* Estado OK / Falta con botón directo para alternar */}
                                  <td className="py-2.5 px-3 text-center">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onUpdateVehiclePartQty(
                                          selectedAmb.id,
                                          item.partId,
                                          'currentQty',
                                          isComplete
                                            ? -item.currentQty
                                            : item.requiredQty - item.currentQty
                                        )
                                      }
                                      title="Pulsar para alternar estado OK / Falta"
                                      className={`px-2.5 py-1 rounded-full font-extrabold text-[11px] transition ${
                                        isComplete
                                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                          : 'bg-rose-600 text-white hover:bg-rose-700'
                                      }`}
                                    >
                                      {isComplete ? 'OK' : 'FALTA'}
                                    </button>
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
                                        title="Quitar equipamiento de la dotación de este vehículo"
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
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setNewOnboardReqQty(isNaN(val) ? 1 : Math.max(1, val));
                        }}
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
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setNewOnboardCurQty(isNaN(val) ? 0 : Math.max(0, val));
                        }}
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
                            SKU: {sp.sku} • {sp.warehouseLocation}
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

                {/* Mapa Visual 360° de Carrocería + Panel Neumáticos y Doble Batería */}
                {onUpdateBodyAndVisualState && (
                  <div className="mt-6 pt-5 border-t border-slate-100 space-y-4">
                    <BodyDamageMap
                      damages={selectedAmb.bodyDamages || []}
                      onChange={(updated) =>
                        onUpdateBodyAndVisualState(selectedAmb.id, {
                          bodyDamages: updated,
                        })
                      }
                    />
                    <TiresAndBatteriesPanel
                      tires={selectedAmb.tires}
                      batteries={selectedAmb.batteries}
                      onUpdateTires={(tires) =>
                        onUpdateBodyAndVisualState(selectedAmb.id, { tires })
                      }
                      onUpdateBatteries={(batteries) =>
                        onUpdateBodyAndVisualState(selectedAmb.id, { batteries })
                      }
                    />
                  </div>
                )}

                {/* Historial Integral / Línea Temporal del Vehículo (Incidencias, Órdenes Externas, Preventivos, Documentos y Movimientos de Stock) */}
                <div className="mt-6 pt-5 border-t border-slate-100 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <History className="w-4 h-4 text-blue-600" />
                      Historial / Línea Temporal de {selectedAmb.code} ({selectedAmb.plate})
                    </h3>

                    <div className="flex flex-wrap items-center gap-1 text-[11px]">
                      {(
                        [
                          { id: 'all', label: 'Todo' },
                          { id: 'orders', label: 'Órdenes Externas' },
                          { id: 'incidents', label: 'Incidencias' },
                          { id: 'preventive', label: 'Preventivos' },
                          { id: 'documents', label: 'Documentos' },
                          { id: 'stock', label: 'Movimientos Stock' },
                        ] as const
                      ).map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setHistoryFilter(f.id)}
                          className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                            historyFilter === f.id
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {(() => {
                    type TimelineEvent = {
                      id: string;
                      date: string;
                      category:
                        | 'orders'
                        | 'incidents'
                        | 'preventive'
                        | 'documents'
                        | 'stock';
                      badge: string;
                      badgeClass: string;
                      title: string;
                      subtitle: string;
                      icon: React.ReactNode;
                    };

                    const events: TimelineEvent[] = [];

                    // 1. Órdenes de Reparación Externas
                    ambWorkOrders.forEach((wo) => {
                      const ws = workshops.find((w) => w.id === wo.workshopId);
                      events.push({
                        id: `tl-wo-${wo.id}`,
                        date: wo.entryDate || wo.createdAt,
                        category: 'orders',
                        badge: `Orden ${wo.status}`,
                        badgeClass: 'bg-amber-100 text-amber-800',
                        title: `${wo.code} — ${wo.title}`,
                        subtitle: `Taller Externo: ${
                          ws?.name || 'Taller Asignado'
                        } • ${wo.mileageAtEntry.toLocaleString()} km • Repuestos suministrados: ${wo.partsUsed.reduce(
                          (s, p) => s + p.quantity,
                          0
                        )} uds.${wo.warranty ? ` • Garantía: ${wo.warranty}` : ''}`,
                        icon: <Wrench className="w-3.5 h-3.5 text-amber-600" />,
                      });
                    });

                    // 2. Incidencias / Checklists
                    checklists
                      .filter((c) => c.ambulanceId === selectedAmb.id)
                      .forEach((chk) => {
                        const faults = chk.items.filter(
                          (i) => i.status !== 'OK'
                        ).length;
                        events.push({
                          id: `tl-chk-${chk.id}`,
                          date: chk.date,
                          category: 'incidents',
                          badge: `Incidencia (${chk.overallUrgency})`,
                          badgeClass: 'bg-rose-100 text-rose-800',
                          title: chk.generalObservations,
                          subtitle: `Reporta: ${chk.inspectorName} • ${chk.mileageAtInspection.toLocaleString()} km • ${faults} anomalías detectadas • ${chk.workshopStatus}`,
                          icon: (
                            <ClipboardCheck className="w-3.5 h-3.5 text-rose-600" />
                          ),
                        });
                      });

                    // 3. Mantenimiento Preventivo
                    preventiveSchedules
                      .filter((p) => p.ambulanceId === selectedAmb.id)
                      .forEach((sched) => {
                        events.push({
                          id: `tl-prev-${sched.id}`,
                          date: sched.lastDoneDate,
                          category: 'preventive',
                          badge: `Preventivo (${sched.category})`,
                          badgeClass: 'bg-blue-100 text-blue-800',
                          title: sched.title,
                          subtitle: `Último realizado: ${sched.lastDoneDate}${
                            sched.lastDoneKm
                              ? ` (${sched.lastDoneKm.toLocaleString()} km)`
                              : ''
                          } → Próximo: ${sched.nextDueDate || ''}${
                            sched.nextDueKm
                              ? ` / ${sched.nextDueKm.toLocaleString()} km`
                              : ''
                          }`,
                          icon: (
                            <CalendarClock className="w-3.5 h-3.5 text-blue-600" />
                          ),
                        });
                      });

                    // 4. Documentación y Vencimientos
                    ensureAmbulanceDocuments(selectedAmb).forEach((doc) => {
                      events.push({
                        id: `tl-doc-${doc.id}`,
                        date: doc.issueDate,
                        category: 'documents',
                        badge: `Documento: ${doc.type}`,
                        badgeClass: 'bg-emerald-100 text-emerald-800',
                        title: `${doc.type} (${doc.number})`,
                        subtitle: `Emisión: ${doc.issueDate} • Vencimiento: ${doc.expiryDate}`,
                        icon: (
                          <FileText className="w-3.5 h-3.5 text-emerald-600" />
                        ),
                      });
                    });

                    // 5. Movimientos de Stock vinculados al vehículo
                    stockMovements
                      .filter(
                        (m) =>
                          m.targetReference.includes(selectedAmb.code) ||
                          m.targetReference.includes(selectedAmb.plate)
                      )
                      .forEach((mov) => {
                        events.push({
                          id: `tl-mov-${mov.id}`,
                          date: mov.date.split(' ')[0],
                          category: 'stock',
                          badge: mov.type,
                          badgeClass: 'bg-purple-100 text-purple-800',
                          title: `${mov.partName} (${mov.sku}) — ${
                            mov.quantityChange > 0
                              ? `+${mov.quantityChange}`
                              : mov.quantityChange
                          } uds.`,
                          subtitle: `Destino: ${mov.targetReference} • Usuario: ${mov.performedBy}${
                            mov.notes ? ` • Nota: ${mov.notes}` : ''
                          }`,
                          icon: (
                            <Package className="w-3.5 h-3.5 text-purple-600" />
                          ),
                        });
                      });

                    const filteredEvents = events
                      .filter(
                        (ev) =>
                          historyFilter === 'all' ||
                          ev.category === historyFilter
                      )
                      .sort((a, b) => b.date.localeCompare(a.date));

                    if (filteredEvents.length === 0) {
                      return (
                        <p className="text-xs text-slate-500 py-4 text-center">
                          No hay eventos registrados en esta categoría para{' '}
                          {selectedAmb.code}.
                        </p>
                      );
                    }

                    return (
                      <div className="relative pl-5 border-l-2 border-slate-200 space-y-3 max-h-96 overflow-y-auto pr-1">
                        {filteredEvents.map((ev) => (
                          <div
                            key={ev.id}
                            className="relative p-3 rounded-xl border border-slate-200 bg-slate-50/60 text-xs"
                          >
                            <span className="absolute -left-[25px] top-3.5 w-3 h-3 rounded-full bg-white border-2 border-blue-600" />
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                              <div className="flex items-center gap-1.5">
                                {ev.icon}
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${ev.badgeClass}`}
                                >
                                  {ev.badge}
                                </span>
                              </div>
                              <span className="font-mono text-[11px] text-slate-500 font-semibold">
                                {ev.date}
                              </span>
                            </div>
                            <p className="font-bold text-slate-900">
                              {ev.title}
                            </p>
                            <p className="text-slate-600 text-[11px] mt-0.5">
                              {ev.subtitle}
                            </p>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Vista Previa de Archivo de Documento */}
      {previewDocFile && (
        <div
          onClick={() => setPreviewDocFile(null)}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-2xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl"
          >
            <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between text-xs font-bold">
              <span>{previewDocFile.title}</span>
              <button
                type="button"
                onClick={() => setPreviewDocFile(null)}
                className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700"
              >
                Cerrar
              </button>
            </div>
            <div className="p-4 bg-slate-100 flex items-center justify-center">
              {previewDocFile.url.startsWith('data:image/') ? (
                <img
                  src={previewDocFile.url}
                  alt={previewDocFile.title}
                  className="max-h-[70vh] object-contain rounded-lg border border-slate-300"
                />
              ) : (
                <iframe
                  src={previewDocFile.url}
                  title={previewDocFile.title}
                  className="w-full h-[70vh] rounded-lg border border-slate-300 bg-white"
                />
              )}
            </div>
          </div>
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
              Esta acción dará de baja la ambulancia de la flota activa y{' '}
              <strong className="text-rose-700">
                eliminará también en cascada sus checklists, órdenes de reparación y
                mantenimientos preventivos asociados
              </strong>
              .
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
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              Añadir Nueva Unidad (Ambulancia) a la Flota
            </h3>
            <form onSubmit={handleCreate} noValidate className="space-y-4 text-xs">
              {addError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-bold">
                  ⚠️ {addError}
                </div>
              )}
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
