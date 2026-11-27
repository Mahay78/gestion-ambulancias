import React, { useMemo, useState } from 'react';
import {
  Ambulance,
  ChecklistItem,
  ChecklistItemStatus,
  ClosedReportRecord,
  ExternalWorkshop,
  FleetChecklist,
  MissingVehiclePartReport,
  WorkOrder,
} from '../types';
import { detectActiveWarranties } from '../utils/warrantyDetector';
import { DEFAULT_CHECKLIST_TEMPLATE } from '../initialData';
import { SignaturePad } from './SignaturePad';
import { PlateScannerModal } from './PlateScannerModal';
import { VoiceDictationButton } from './VoiceDictationButton';
import {
  shareChecklistViaWhatsApp,
  printChecklistReport,
} from '../utils/shareAndPrint';
import { compressImageFile } from '../utils/imageCompression';
import {
  ClipboardCheck,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Package,
  Send,
  FileText,
  Plus,
  Camera,
  ScanLine,
  Trash2,
  Image as ImageIcon,
  MessageCircle,
  Printer,
  Database,
  Download,
  Search,
  Lock,
} from 'lucide-react';

interface ChecklistViewProps {
  ambulances: Ambulance[];
  checklists: FleetChecklist[];
  workOrders?: WorkOrder[];
  workshops?: ExternalWorkshop[];
  closedReports?: ClosedReportRecord[];
  onSubmitChecklist: (
    checklist: Omit<FleetChecklist, 'id'>,
    autoCreateWorkOrder: boolean,
    updatedOnboardQtys: Record<string, number>
  ) => void;
  onCreateWorkOrderFromChecklist: (checklist: FleetChecklist) => void;
  onCloseChecklistReport?: (
    checklistId: string,
    resolution: string,
    markAmbulanceAvailable: boolean
  ) => void;
}

export const ChecklistView: React.FC<ChecklistViewProps> = ({
  ambulances,
  checklists,
  workOrders = [],
  workshops = [],
  closedReports = [],
  onSubmitChecklist,
  onCreateWorkOrderFromChecklist,
  onCloseChecklistReport,
}) => {
  const [activeMode, setActiveMode] = useState<'new' | 'history' | 'database'>('new');
  const [closingChecklist, setClosingChecklist] = useState<FleetChecklist | null>(null);
  const [closingResolutionText, setClosingResolutionText] = useState<string>('');
  const [markAvailableOnClose, setMarkAvailableOnClose] = useState<boolean>(true);
  const [dbSearch, setDbSearch] = useState<string>('');
  const [dbAmbFilter, setDbAmbFilter] = useState<string>('Todas');
  const [dbFromDate, setDbFromDate] = useState<string>('');
  const [dbToDate, setDbToDate] = useState<string>('');
  const [selectedAmbId, setSelectedAmbId] = useState<string>(
    ambulances[0]?.id || 'amb-1'
  );
  const [inspectorName, setInspectorName] = useState<string>(
    'Carlos Mendoza (Responsable de Flota)'
  );
  const [overallUrgency, setOverallUrgency] = useState<
    FleetChecklist['overallUrgency']
  >('Prioritaria');
  const [generalObservations, setGeneralObservations] = useState<string>('');
  const [autoGenerateOT, setAutoGenerateOT] = useState<boolean>(true);
  const [generalPhotos, setGeneralPhotos] = useState<string[]>([]);
  const [inspectorSignature, setInspectorSignature] = useState<string>('');
  const [showPlateScanner, setShowPlateScanner] = useState<boolean>(false);
  const [previewImageModal, setPreviewImageModal] = useState<string | null>(null);

  const selectedAmb =
    ambulances.find((a) => a.id === selectedAmbId) || ambulances[0];
  const [mileageInput, setMileageInput] = useState<number>(
    selectedAmb?.mileage || 100000
  );

  // Estado de los 19 puntos del checklist
  const [items, setItems] = useState<ChecklistItem[]>(() =>
    DEFAULT_CHECKLIST_TEMPLATE.map((t) => ({
      ...t,
      status: 'OK',
      comment: '',
      photoUrl: undefined,
    }))
  );

  // Estado de la auditoría de stock de piezas del vehículo durante el checklist
  const [onboardCounts, setOnboardCounts] = useState<Record<string, number>>(
    () => {
      const initial: Record<string, number> = {};
      selectedAmb?.onboardParts.forEach((p) => {
        initial[p.partId] = p.currentQty;
      });
      return initial;
    }
  );

  const handleAmbChange = (newAmbId: string) => {
    setSelectedAmbId(newAmbId);
    const amb = ambulances.find((a) => a.id === newAmbId);
    if (amb) {
      setMileageInput(amb.mileage);
      const counts: Record<string, number> = {};
      amb.onboardParts.forEach((p) => {
        counts[p.partId] = p.currentQty;
      });
      setOnboardCounts(counts);
    }
  };

  const updateItemStatus = (id: string, status: ChecklistItemStatus) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status } : it)));
  };

  const updateItemComment = (id: string, comment: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, comment } : it))
    );
  };

  const handleItemPhotoUpload = async (
    id: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImageFile(file);
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, photoUrl: compressed } : it))
    );
  };

  const removeItemPhoto = (id: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, photoUrl: undefined } : it))
    );
  };

  const handleGeneralPhotoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const uploaded: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const compressed = await compressImageFile(files[i]);
      uploaded.push(compressed);
    }
    setGeneralPhotos((prev) => [...prev, ...uploaded]);
  };

  const sections = Array.from(new Set(items.map((i) => i.section)));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAmb) return;

    const missingParts: MissingVehiclePartReport[] = selectedAmb.onboardParts
      .map((part): MissingVehiclePartReport | null => {
        const verifiedQty =
          onboardCounts[part.partId] !== undefined
            ? onboardCounts[part.partId]
            : part.currentQty;
        const diff = part.requiredQty - verifiedQty;
        if (diff > 0) {
          return {
            partId: part.partId,
            partName: part.partName,
            missingQty: diff,
            actionRequired: 'Reponer en vehículo',
          };
        }
        return null;
      })
      .filter((x): x is MissingVehiclePartReport => x !== null);

    const hasFaultsOrMissing =
      items.some((i) => i.status !== 'OK') || missingParts.length > 0;

    // Recopilar tanto las fotos de puntos específicos como las fotos generales
    const itemPhotos = items
      .map((i) => i.photoUrl)
      .filter((url): url is string => Boolean(url));
    const allPhotos = [...generalPhotos, ...itemPhotos];

    onSubmitChecklist(
      {
        ambulanceId: selectedAmb.id,
        date: new Date().toISOString().split('T')[0],
        inspectorName,
        mileageAtInspection: mileageInput,
        overallUrgency,
        items,
        missingParts,
        generalObservations:
          generalObservations.trim() ||
          (hasFaultsOrMissing
            ? 'Inspección del responsable de flota con incidencias mecánicas/stock para taller.'
            : 'Inspección periódica sin anomalías.'),
        workshopStatus: autoGenerateOT
          ? 'Orden Externa Creada'
          : hasFaultsOrMissing
          ? 'Pendiente de Asignar Taller'
          : 'Archivada / OK',
        photos: allPhotos,
        inspectorSignature: inspectorSignature || undefined,
      },
      autoGenerateOT,
      onboardCounts
    );

    // Reset items
    setItems(
      DEFAULT_CHECKLIST_TEMPLATE.map((t) => ({
        ...t,
        status: 'OK',
        comment: '',
        photoUrl: undefined,
      }))
    );
    setGeneralObservations('');
    setGeneralPhotos([]);
    setInspectorSignature('');
    setActiveMode('history');
  };

  const faultCount = items.filter((i) => i.status === 'Avería').length;
  const obsCount = items.filter((i) => i.status === 'Observación').length;

  const filteredClosedReports = useMemo(() => {
    const q = dbSearch.trim().toLowerCase();
    return closedReports.filter((r) => {
      if (dbAmbFilter !== 'Todas' && r.ambulanceId !== dbAmbFilter) return false;
      if (dbFromDate && r.closedAt < dbFromDate) return false;
      if (dbToDate && r.closedAt > dbToDate) return false;
      if (!q) return true;
      return (
        r.ambulanceCode.toLowerCase().includes(q) ||
        r.plate.toLowerCase().includes(q) ||
        r.reporterName.toLowerCase().includes(q) ||
        r.summary.toLowerCase().includes(q) ||
        r.resolution.toLowerCase().includes(q) ||
        (r.linkedWorkOrderCode || '').toLowerCase().includes(q)
      );
    });
  }, [closedReports, dbSearch, dbAmbFilter, dbFromDate, dbToDate]);

  const handleExportClosedCsv = () => {
    const escapeCell = (val: string | number | undefined) => {
      const s = String(val ?? '').replace(/"/g, '""');
      return `"${s}"`;
    };
    const headers = [
      'ID',
      'Fecha Cierre',
      'Fecha Parte',
      'Unidad',
      'Matrícula',
      'Kilómetros',
      'Urgencia',
      'Reportado por',
      'Cerrado por',
      'Tipo Cierre',
      'Orden Taller',
      'Taller',
      'Resumen / Avería',
      'Anomalías',
      'Resolución',
    ];
    const rows = filteredClosedReports.map((r) =>
      [
        r.id,
        r.closedAt,
        r.reportDate,
        r.ambulanceCode,
        r.plate,
        r.mileage,
        r.urgency,
        r.reporterName,
        r.closedBy,
        r.closureType,
        r.linkedWorkOrderCode || '',
        r.workshopName || '',
        r.summary,
        r.anomalies.join(' | '),
        r.resolution,
      ]
        .map(escapeCell)
        .join(';')
    );
    const csvContent = '\uFEFF' + [headers.map(escapeCell).join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `base_datos_partes_cerrados_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Selector de pestaña interna: Nueva Checklist vs Historial de Partes a Taller */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-blue-600" />
            Checklist a Pie de Ambulancia → Fotos, Firma Digital y Stock
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Escanea la matrícula, fotografía las averías con tu móvil o tablet,
            revisa el stock del vehículo y firma el parte para el taller.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPlateScanner(true)}
            className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
          >
            <ScanLine className="w-4 h-4" />
            Escanear Matrícula
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('new')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activeMode === 'new'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Plus className="w-4 h-4" />
            Nueva Checklist
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('history')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activeMode === 'history'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            Partes Enviados ({checklists.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('database')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activeMode === 'database'
                ? 'bg-indigo-700 text-white shadow-sm'
                : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100 border border-indigo-200'
            }`}
          >
            <Database className="w-4 h-4" />
            Base de Datos ({closedReports.length})
          </button>
        </div>
      </div>

      {activeMode === 'new' ? (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Cabecera del Formulario de Inspección */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                1. Identificación del Vehículo (Por Matrícula) y Responsable
              </h3>
              <button
                type="button"
                onClick={() => setShowPlateScanner(true)}
                className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold flex items-center gap-1.5"
              >
                <ScanLine className="w-3.5 h-3.5" />
                Detectar por Matrícula con Cámara
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Ambulancia Inspeccionada
                </label>
                <select
                  value={selectedAmbId}
                  onChange={(e) => handleAmbChange(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 font-semibold bg-slate-50"
                >
                  {ambulances.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.plate} — {a.code} ({a.brand} {a.model})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Kilometraje Registrado
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  value={mileageInput}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setMileageInput(isNaN(val) ? (selectedAmb?.mileage || 0) : Math.max(0, val));
                  }}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 font-semibold"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Responsable de Flota
                </label>
                <input
                  type="text"
                  required
                  value={inspectorName}
                  onChange={(e) => setInspectorName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Nivel de Urgencia para Taller
                </label>
                <select
                  value={overallUrgency}
                  onChange={(e) =>
                    setOverallUrgency(
                      e.target.value as FleetChecklist['overallUrgency']
                    )
                  }
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 font-semibold"
                >
                  <option value="Normal">Normal (Revisión Programable)</option>
                  <option value="Prioritaria">
                    Prioritaria (Entrada a Taller)
                  </option>
                  <option value="Inmovilización Inmediata">
                    Inmovilización Inmediata (Crítica)
                  </option>
                </select>
              </div>
            </div>

            {selectedAmb &&
              (() => {
                const warranties = detectActiveWarranties(
                  selectedAmb.id,
                  mileageInput || selectedAmb.mileage,
                  workOrders,
                  workshops
                );
                if (warranties.length === 0) return null;
                const latest = warranties[0];
                return (
                  <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-300 text-xs flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-amber-900">
                      <strong>Garantía vigente en {selectedAmb.code}:</strong> La orden{' '}
                      <strong>{latest.workOrder.code}</strong> ({latest.workOrder.title}) en{' '}
                      <strong>{latest.workshop?.name || 'taller externo'}</strong> tiene
                      garantía activa ({latest.warrantyText}, {latest.daysRemaining} días
                      restantes). Si detectas reincidencia, reclama sin cargo.
                    </div>
                  </div>
                );
              })()}
          </div>

          {/* 2. Verificación del Stock de Piezas a Bordo del Vehículo */}
          {selectedAmb && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Package className="w-4 h-4 text-blue-600" />
                    2. Control de Stock de Piezas y Repuestos del Vehículo (
                    {selectedAmb.code} - {selectedAmb.plate})
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Indica las unidades presentes hoy en la ambulancia. Cualquier
                    faltante se incluirá automáticamente en el informe al taller.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {selectedAmb.onboardParts.map((part) => {
                  const currentVal =
                    onboardCounts[part.partId] !== undefined
                      ? onboardCounts[part.partId]
                      : part.currentQty;
                  const isMissing = currentVal < part.requiredQty;

                  return (
                    <div
                      key={part.partId}
                      className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                        isMissing
                          ? 'bg-rose-50/70 border-rose-300'
                          : 'bg-slate-50/70 border-slate-200'
                      }`}
                    >
                      <div className="text-xs">
                        <p className="font-bold text-slate-800">{part.partName}</p>
                        <p className="text-slate-500 mt-0.5">
                          Dotación exigida: <strong>{part.requiredQty} uds.</strong>
                        </p>
                        {isMissing && (
                          <span className="inline-block mt-1 text-[11px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded">
                            Solicitar +{part.requiredQty - currentVal} al taller
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setOnboardCounts({
                              ...onboardCounts,
                              [part.partId]: Math.max(0, currentVal - 1),
                            })
                          }
                          className="w-8 h-8 rounded-lg bg-white border border-slate-300 font-bold text-slate-700 hover:bg-slate-100"
                        >
                          -
                        </button>
                        <span className="w-8 text-center text-sm font-extrabold text-slate-900">
                          {currentVal}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setOnboardCounts({
                              ...onboardCounts,
                              [part.partId]: currentVal + 1,
                            })
                          }
                          className="w-8 h-8 rounded-lg bg-white border border-slate-300 font-bold text-slate-700 hover:bg-slate-100"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. Puntos de Inspección Mecánica por Secciones + Botón de Cámara por Punto */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  3. Puntos de Revisión Mecánica y Fotografías de Averías
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pulsa el icono de cámara en cualquier punto para adjuntar una foto
                  directa con el móvil o tablet.
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs font-semibold">
                <span className="text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md">
                  {items.length - faultCount - obsCount} OK
                </span>
                <span className="text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md">
                  {obsCount} Observaciones
                </span>
                <span className="text-rose-700 bg-rose-50 px-2.5 py-1 rounded-md">
                  {faultCount} Averías para Taller
                </span>
              </div>
            </div>

            {sections.map((section) => (
              <div
                key={section}
                className="border border-slate-200 rounded-xl overflow-hidden"
              >
                <div className="bg-slate-100/80 px-4 py-2.5 border-b border-slate-200 font-bold text-xs text-slate-800 uppercase tracking-wide flex items-center justify-between gap-2">
                  <span>{section}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setItems((prev) =>
                        prev.map((it) =>
                          it.section === section ? { ...it, status: 'OK' } : it
                        )
                      )
                    }
                    className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-bold normal-case transition"
                  >
                    ✓ Marcar sección OK
                  </button>
                </div>
                <div className="divide-y divide-slate-200">
                  {items
                    .filter((i) => i.section === section)
                    .map((item) => (
                      <div
                        key={item.id}
                        className={`p-3.5 space-y-2.5 text-xs ${
                          item.status === 'Avería'
                            ? 'bg-rose-50/50'
                            : item.status === 'Observación'
                            ? 'bg-amber-50/40'
                            : 'bg-white'
                        }`}
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                          <div className="font-medium text-slate-800 md:w-4/12">
                            {item.label}
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => updateItemStatus(item.id, 'OK')}
                              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition ${
                                item.status === 'OK'
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> OK
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                updateItemStatus(item.id, 'Observación')
                              }
                              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition ${
                                item.status === 'Observación'
                                  ? 'bg-amber-500 text-white'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              <AlertTriangle className="w-3.5 h-3.5" /> Observación
                            </button>
                            <button
                              type="button"
                              onClick={() => updateItemStatus(item.id, 'Avería')}
                              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition ${
                                item.status === 'Avería'
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              <XCircle className="w-3.5 h-3.5" /> Avería Taller
                            </button>

                            {/* Botón Cámara para adjuntar foto en este punto */}
                            <label
                              title="Hacer foto de esta avería con cámara"
                              className={`px-2.5 py-1.5 rounded-lg font-semibold flex items-center gap-1 cursor-pointer border transition ${
                                item.photoUrl
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                              }`}
                            >
                              <Camera className="w-3.5 h-3.5" />
                              <span>{item.photoUrl ? 'Foto OK' : 'Foto'}</span>
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={(e) => handleItemPhotoUpload(item.id, e)}
                                className="hidden"
                              />
                            </label>
                          </div>

                          <div className="md:w-4/12 flex items-center gap-1.5">
                            <input
                              type="text"
                              placeholder="Nota o síntoma para el mecánico..."
                              value={item.comment}
                              onChange={(e) =>
                                updateItemComment(item.id, e.target.value)
                              }
                              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                            />
                            <VoiceDictationButton
                              label="Voz"
                              onTranscript={(text) =>
                                updateItemComment(
                                  item.id,
                                  item.comment ? `${item.comment}. ${text}` : text
                                )
                              }
                            />
                          </div>
                        </div>

                        {/* Miniatura de la foto adjunta en este punto */}
                        {item.photoUrl && (
                          <div className="flex items-center gap-3 pt-1">
                            <img
                              src={item.photoUrl}
                              alt={item.label}
                              onClick={() =>
                                setPreviewImageModal(item.photoUrl || null)
                              }
                              className="w-20 h-14 object-cover rounded-lg border border-slate-300 cursor-pointer hover:opacity-90"
                            />
                            <div className="text-[11px] text-slate-600">
                              <p className="font-bold text-slate-800">
                                Fotografía de evidencia adjunta
                              </p>
                              <button
                                type="button"
                                onClick={() => removeItemPhoto(item.id)}
                                className="text-rose-600 font-semibold hover:underline flex items-center gap-1 mt-0.5"
                              >
                                <Trash2 className="w-3 h-3" /> Quitar foto
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>

          {/* 4. Galería Fotográfica Adicional, Observaciones y Firma Digital en Pantalla */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              4. Fotos Generales, Dictamen y Firma Digital del Responsable de Flota
            </h3>

            {/* Subida de fotos generales de la ambulancia */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-blue-600" />
                    Fotografías Generales para el Taller (Cuadro de instrumentos,
                    carrocería, neumáticos, fugas)
                  </span>
                </div>
                <label className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer">
                  <Camera className="w-3.5 h-3.5" />
                  <span>Abrir Cámara / Adjuntar Fotos</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    capture="environment"
                    onChange={handleGeneralPhotoUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {generalPhotos.length > 0 && (
                <div className="flex flex-wrap gap-3 pt-1">
                  {generalPhotos.map((photo, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={photo}
                        alt={`Evidencia ${index + 1}`}
                        onClick={() => setPreviewImageModal(photo)}
                        className="w-24 h-20 object-cover rounded-lg border border-slate-300 cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setGeneralPhotos((prev) =>
                            prev.filter((_, idx) => idx !== index)
                          )
                        }
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] font-bold shadow"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-700">
                  Observaciones Generales e Instrucciones para el Jefe de Taller
                </label>
                <VoiceDictationButton
                  label="Dictar Observaciones por Voz"
                  onTranscript={(text) =>
                    setGeneralObservations((prev) =>
                      prev ? `${prev}. ${text}` : text
                    )
                  }
                />
              </div>
              <textarea
                rows={3}
                placeholder="Escribe o dicta por voz las instrucciones detalladas para el Jefe de Taller (ruidos detectados, comportamiento en ruta, urgencia de disponibilidad de la ambulancia, etc.)..."
                value={generalObservations}
                onChange={(e) => setGeneralObservations(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 text-xs"
              />
            </div>

            {/* Firma Digital en Pantalla del Responsable de Flota */}
            <SignaturePad
              label={`Firma Digital de Conformidad y Entrega a Taller — ${inspectorName}`}
              subtitle="Firma sobre el recuadro táctil para certificar la revisión y autorizar la intervención del taller."
              value={inspectorSignature}
              onChange={setInspectorSignature}
            />

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoGenerateOT}
                  onChange={(e) => setAutoGenerateOT(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600"
                />
                Generar Orden de Trabajo (OT) automáticamente con las fotos y firma,
                y pasar la ambulancia a "En Taller"
              </label>

              <button
                type="submit"
                className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition"
              >
                <Send className="w-4 h-4" />
                Firmar y Enviar Checklist al Taller
              </button>
            </div>
          </div>
        </form>
      ) : activeMode === 'history' ? (
        /* Historial de Checklists enviados a Taller */
        <div className="space-y-4">
          {checklists.map((chk) => {
            const amb = ambulances.find((a) => a.id === chk.ambulanceId);
            const anomalies = chk.items.filter((i) => i.status !== 'OK');

            return (
              <div
                key={chk.id}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded bg-slate-900 text-white text-xs font-bold">
                        {amb?.code} ({amb?.plate})
                      </span>
                      <span className="text-sm font-bold text-slate-900">
                        {amb?.brand} {amb?.model}
                      </span>
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                          chk.overallUrgency === 'Inmovilización Inmediata'
                            ? 'bg-rose-100 text-rose-700'
                            : chk.overallUrgency === 'Prioritaria'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        Urgencia: {chk.overallUrgency}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Fecha: <strong>{chk.date}</strong> • Odómetro:{' '}
                      <strong>{chk.mileageAtInspection.toLocaleString()} km</strong>{' '}
                      • Inspeccionado por: <strong>{chk.inspectorName}</strong>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => shareChecklistViaWhatsApp(chk, amb)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      WhatsApp Taller
                    </button>
                    <button
                      type="button"
                      onClick={() => printChecklistReport(chk, amb)}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      PDF / Imprimir
                    </button>
                    {chk.workshopStatus === 'Pendiente de Asignar Taller' ? (
                      <>
                        <button
                          onClick={() => onCreateWorkOrderFromChecklist(chk)}
                          className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5"
                        >
                          <Wrench className="w-3.5 h-3.5" />
                          Crear Orden Externa
                        </button>
                        {onCloseChecklistReport && (
                          <button
                            type="button"
                            onClick={() => {
                              setClosingChecklist(chk);
                              setClosingResolutionText('');
                              setMarkAvailableOnClose(true);
                            }}
                            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5"
                          >
                            <Lock className="w-3.5 h-3.5" />
                            Cerrar Parte
                          </button>
                        )}
                      </>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold inline-flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" />
                          {chk.workshopStatus}
                          {chk.closedAt ? ` (${chk.closedAt})` : ''}
                        </span>
                        {chk.workshopStatus === 'Orden Externa Creada' &&
                          onCloseChecklistReport && (
                            <button
                              type="button"
                              onClick={() => {
                                setClosingChecklist(chk);
                                setClosingResolutionText('');
                                setMarkAvailableOnClose(true);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5"
                            >
                              <Lock className="w-3.5 h-3.5" />
                              Cerrar Parte
                            </button>
                          )}
                      </div>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200/70">
                  <strong>Observaciones del Responsable de Flota:</strong>{' '}
                  {chk.generalObservations}
                </p>

                {chk.workshopStatus === 'Cerrada / Resuelta' && chk.closingResolution && (
                  <p className="text-xs text-indigo-900 bg-indigo-50 p-3 rounded-lg border border-indigo-200">
                    <strong>Resolución de Cierre ({chk.closedAt} • {chk.closedBy}):</strong>{' '}
                    {chk.closingResolution}
                  </p>
                )}

                {/* Anomalías Mecánicas Reportadas */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-xs font-bold uppercase text-slate-500 mb-2">
                      Puntos Mecánicos con Incidencia ({anomalies.length})
                    </h4>
                    {anomalies.length === 0 ? (
                      <p className="text-xs text-emerald-700 font-medium">
                        Todos los puntos mecánicos marcados como OK.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {anomalies.map((an) => (
                          <div
                            key={an.id}
                            className={`p-2.5 rounded-lg border text-xs ${
                              an.status === 'Avería'
                                ? 'bg-rose-50 border-rose-200 text-rose-900'
                                : 'bg-amber-50 border-amber-200 text-amber-900'
                            }`}
                          >
                            <div className="flex items-center justify-between font-bold">
                              <span>{an.label}</span>
                              <span className="uppercase text-[10px] px-2 py-0.5 rounded bg-white/80">
                                {an.status}
                              </span>
                            </div>
                            {an.comment && (
                              <p className="mt-1 text-slate-700">
                                Nota: {an.comment}
                              </p>
                            )}
                            {an.photoUrl && (
                              <img
                                src={an.photoUrl}
                                alt={an.label}
                                onClick={() =>
                                  setPreviewImageModal(an.photoUrl || null)
                                }
                                className="mt-2 w-24 h-16 object-cover rounded border border-slate-300 cursor-pointer"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Faltantes de Stock de Piezas en el Vehículo */}
                  <div>
                    <h4 className="text-xs font-bold uppercase text-slate-500 mb-2">
                      Piezas a Reponer en el Vehículo ({chk.missingParts.length})
                    </h4>
                    {chk.missingParts.length === 0 ? (
                      <p className="text-xs text-emerald-700 font-medium">
                        Stock de piezas a bordo del vehículo completo.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {chk.missingParts.map((mp) => (
                          <div
                            key={mp.partId}
                            className="p-2.5 rounded-lg border border-purple-200 bg-purple-50/60 text-xs flex items-center justify-between"
                          >
                            <div>
                              <p className="font-bold text-slate-900">
                                {mp.partName}
                              </p>
                              <p className="text-purple-700 font-medium">
                                Acción: {mp.actionRequired}
                              </p>
                            </div>
                            <span className="px-2.5 py-1 rounded bg-purple-600 text-white font-bold">
                              Faltan {mp.missingQty} uds.
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Fotos Adjuntas y Firma Digital del Responsable de Flota */}
                {((chk.photos && chk.photos.length > 0) ||
                  chk.inspectorSignature) && (
                  <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
                    {chk.photos && chk.photos.length > 0 && (
                      <div>
                        <span className="text-[11px] font-bold uppercase text-slate-400 block mb-1.5">
                          Evidencias Fotográficas ({chk.photos.length})
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {chk.photos.map((ph, idx) => (
                            <img
                              key={idx}
                              src={ph}
                              alt={`Foto ${idx + 1}`}
                              onClick={() => setPreviewImageModal(ph)}
                              className="w-20 h-14 object-cover rounded-lg border border-slate-300 cursor-pointer hover:opacity-90"
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {chk.inspectorSignature && (
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">
                          Firmado por {chk.inspectorName}
                        </span>
                        <img
                          src={chk.inspectorSignature}
                          alt="Firma responsable flota"
                          className="h-12 object-contain mt-1"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Base de Datos de Partes Cerrados (Firestore + Local + Exportación CSV/Excel) */
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Database className="w-4 h-4 text-indigo-600" />
                  Base de Datos de Partes Cerrados
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Registro histórico guardado en Firebase Firestore (<code>ambufleet_closed_reports</code>), copia local y Google Sheets (si el webhook está activo).
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportClosedCsv}
                disabled={filteredClosedReports.length === 0}
                className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
              >
                <Download className="w-4 h-4" />
                Exportar CSV / Excel ({filteredClosedReports.length})
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={dbSearch}
                  onChange={(e) => setDbSearch(e.target.value)}
                  placeholder="Buscar matrícula, avería, resolución..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-xs"
                />
              </div>
              <select
                value={dbAmbFilter}
                onChange={(e) => setDbAmbFilter(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
              >
                <option value="Todas">Todas las unidades</option>
                {ambulances.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.plate}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={dbFromDate}
                onChange={(e) => setDbFromDate(e.target.value)}
                title="Fecha cierre desde"
                className="px-3 py-2 rounded-lg border border-slate-300 text-xs"
              />
              <input
                type="date"
                value={dbToDate}
                onChange={(e) => setDbToDate(e.target.value)}
                title="Fecha cierre hasta"
                className="px-3 py-2 rounded-lg border border-slate-300 text-xs"
              />
            </div>

            {filteredClosedReports.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                No hay partes cerrados registrados con estos filtros. Pulsa <strong>"Cerrar Parte"</strong> en un parte enviado o cierra una orden de taller para registrarlo automáticamente.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                      <th className="py-2.5 px-3">Cierre</th>
                      <th className="py-2.5 px-3">Unidad</th>
                      <th className="py-2.5 px-3">Origen</th>
                      <th className="py-2.5 px-3">Resumen / Avería</th>
                      <th className="py-2.5 px-3">Resolución</th>
                      <th className="py-2.5 px-3">Cerrado por</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredClosedReports.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 whitespace-nowrap font-medium text-slate-800">
                          {r.closedAt}
                          <div className="text-[10px] text-slate-400">
                            Parte: {r.reportDate}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-bold text-[10px]">
                            {r.ambulanceCode}
                          </span>
                          <div className="text-[11px] text-slate-600 mt-0.5">
                            {r.plate} • {r.mileage.toLocaleString()} km
                          </div>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              r.closureType === 'Orden de Taller'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-indigo-100 text-indigo-800'
                            }`}
                          >
                            {r.closureType}
                          </span>
                          {r.linkedWorkOrderCode && (
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              {r.linkedWorkOrderCode} {r.workshopName ? `• ${r.workshopName}` : ''}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 max-w-xs">
                          <p className="text-slate-800 font-medium line-clamp-2">
                            {r.summary}
                          </p>
                          <span className="text-[10px] text-slate-400">
                            Reportó: {r.reporterName}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 max-w-xs text-slate-700">
                          {r.resolution}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                          {r.closedBy}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Cerrar Parte Directamente */}
      {closingChecklist && onCloseChecklistReport && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Lock className="w-4 h-4 text-indigo-600" />
              Cerrar Parte y Guardar en Base de Datos
            </h3>
            <p className="text-xs text-slate-600">
              {closingChecklist.generalObservations}
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Resolución / Motivo de cierre
              </label>
              <textarea
                rows={3}
                value={closingResolutionText}
                onChange={(e) => setClosingResolutionText(e.target.value)}
                placeholder="Ej: Dotación repuesta en campa, bombilla sustituida, falsa alarma..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={markAvailableOnClose}
                onChange={(e) => setMarkAvailableOnClose(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600"
              />
              Marcar ambulancia como <strong>Disponible</strong> (si no está en otra orden de taller)
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setClosingChecklist(null)}
                className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onCloseChecklistReport(
                    closingChecklist.id,
                    closingResolutionText.trim() || 'Resuelto y cerrado.',
                    markAvailableOnClose
                  );
                  setClosingChecklist(null);
                }}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                Confirmar Cierre
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Escáner de Matrícula */}
      {showPlateScanner && (
        <PlateScannerModal
          ambulances={ambulances}
          onSelectAmbulance={(ambId) => {
            handleAmbChange(ambId);
            setActiveMode('new');
          }}
          onClose={() => setShowPlateScanner(false)}
        />
      )}

      {/* Modal Vista Previa de Fotografía */}
      {previewImageModal && (
        <div
          onClick={() => setPreviewImageModal(null)}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50"
        >
          <div className="max-w-2xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl">
            <img
              src={previewImageModal}
              alt="Evidencia ampliada"
              className="w-full max-h-[75vh] object-contain bg-slate-900"
            />
            <div className="p-3 bg-slate-900 text-white flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewImageModal(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold"
              >
                Cerrar Vista Previa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
