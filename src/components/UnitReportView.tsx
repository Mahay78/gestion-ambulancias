import React, { useEffect, useMemo, useState } from 'react';
import { INITIAL_AMBULANCES } from '../initialData';
import { compressImageFile } from '../utils/imageCompression';
import { getLocalDateString } from '../utils/dateUtils';
import {
  DEFAULT_FIREBASE_CONFIG,
  PublicPlateEntry,
  UnitBreakdownReport,
  fetchPublicPlates,
  submitUnitBreakdownReport,
} from '../utils/firebaseSync';
import { VoiceDictationButton } from './VoiceDictationButton';
import {
  Activity,
  Camera,
  CheckCircle2,
  Send,
  Trash2,
  AlertTriangle,
  ArrowLeft,
  Car,
} from 'lucide-react';

interface UnitReportViewProps {
  projectId?: string;
  apiKey?: string;
  onExitToLogin: () => void;
  onLocalFallbackSubmit?: (report: UnitBreakdownReport) => void;
}

const normalizePlate = (s: string): string =>
  s.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

export const UnitReportView: React.FC<UnitReportViewProps> = ({
  projectId = DEFAULT_FIREBASE_CONFIG.projectId,
  apiKey = DEFAULT_FIREBASE_CONFIG.apiKey,
  onExitToLogin,
  onLocalFallbackSubmit,
}) => {
  const [platesList, setPlatesList] = useState<PublicPlateEntry[]>(() =>
    INITIAL_AMBULANCES.map((a) => ({
      id: a.id,
      code: a.code,
      plate: a.plate,
      brand: a.brand,
      model: a.model,
      mileage: a.mileage,
    }))
  );

  const [plateInput, setPlateInput] = useState('');
  const [selectedPlateEntry, setSelectedPlateEntry] =
    useState<PublicPlateEntry | null>(null);
  const [reporterName, setReporterName] = useState('');
  const [mileage, setMileage] = useState<string>('');
  const [urgency, setUrgency] =
    useState<UnitBreakdownReport['urgency']>('Prioritaria');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [submittedReport, setSubmittedReport] =
    useState<UnitBreakdownReport | null>(null);

  useEffect(() => {
    fetchPublicPlates(projectId, apiKey).then((remotePlates) => {
      if (remotePlates && remotePlates.length > 0) {
        setPlatesList(remotePlates);
      }
    });
  }, [projectId, apiKey]);

  const matchingPlates = useMemo(() => {
    const q = normalizePlate(plateInput);
    if (!q) return [];
    return platesList
      .filter(
        (p) =>
          normalizePlate(p.plate).includes(q) ||
          normalizePlate(p.code).includes(q)
      )
      .slice(0, 6);
  }, [plateInput, platesList]);

  const handlePlateInputChange = (val: string) => {
    setPlateInput(val.toUpperCase());
    const norm = normalizePlate(val);
    const exact = platesList.find((p) => normalizePlate(p.plate) === norm);
    if (exact) {
      setSelectedPlateEntry(exact);
      if (!mileage) setMileage(String(exact.mileage));
    } else {
      setSelectedPlateEntry(null);
    }
  };

  const handleSelectSuggestion = (entry: PublicPlateEntry) => {
    setSelectedPlateEntry(entry);
    setPlateInput(entry.plate);
    setMileage(String(entry.mileage));
  };

  const handlePhotoCapture = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setErrorMsg('');
    try {
      const nextPhotos: string[] = [];
      for (let i = 0; i < Math.min(files.length, 4 - photos.length); i++) {
        const compressed = await compressImageFile(files[i], 900, 0.72);
        nextPhotos.push(compressed);
      }
      setPhotos((prev) => [...prev, ...nextPhotos].slice(0, 4));
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudo procesar la foto seleccionada.'
      );
    } finally {
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const cleanPlate = plateInput.trim().toUpperCase();
    if (!cleanPlate) {
      setErrorMsg('Introduce la matrícula del vehículo.');
      return;
    }
    if (!reporterName.trim()) {
      setErrorMsg('Indica tu nombre para saber quién reporta.');
      return;
    }
    if (!description.trim()) {
      setErrorMsg('Describe brevemente la avería detectada.');
      return;
    }

    const parsedKm = parseInt(mileage, 10);
    const finalKm = !isNaN(parsedKm) && parsedKm >= 0
      ? parsedKm
      : selectedPlateEntry?.mileage || 0;

    const report: UnitBreakdownReport = {
      id: `unit-rep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ambulanceId: selectedPlateEntry?.id,
      ambulanceCode: selectedPlateEntry?.code,
      plate: selectedPlateEntry?.plate || cleanPlate,
      reporterName: reporterName.trim(),
      mileage: finalKm,
      urgency,
      description: description.trim(),
      photos,
      date: getLocalDateString(),
      createdAtIso: new Date().toISOString(),
      status: 'pending',
    };

    setIsSending(true);
    const res = await submitUnitBreakdownReport(report, projectId, apiKey);
    setIsSending(false);

    if (res.ok) {
      if (onLocalFallbackSubmit) onLocalFallbackSubmit(report);
      setSubmittedReport(report);
    } else {
      setErrorMsg(
        res.error ||
          'Error de conexión al enviar. Verifica cobertura de datos.'
      );
    }
  };

  const handleResetForm = () => {
    setSubmittedReport(null);
    setPlateInput('');
    setSelectedPlateEntry(null);
    setMileage('');
    setUrgency('Prioritaria');
    setDescription('');
    setPhotos([]);
    setErrorMsg('');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-between p-4 safe-top safe-bottom">
      <div className="max-w-md w-full mx-auto space-y-4">
        <div className="flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-600 flex items-center justify-center shadow-sm">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight leading-none">
                Ambu-<span className="text-rose-400">lzflota</span>
              </h1>
              <p className="text-[11px] text-slate-400">
                Parte Rápido de Avería (Unidad)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onExitToLogin}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 border border-slate-700"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Acceso Flota
          </button>
        </div>

        {submittedReport ? (
          <div className="bg-white rounded-2xl shadow-2xl p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">
                ¡Avería enviada al Encargado!
              </h2>
              <p className="text-xs text-slate-600 mt-1">
                Vehículo{' '}
                <strong>
                  {submittedReport.ambulanceCode
                    ? `${submittedReport.ambulanceCode} (${submittedReport.plate})`
                    : submittedReport.plate}
                </strong>{' '}
                • Urgencia: <strong>{submittedReport.urgency}</strong>
              </p>
              <p className="text-[11px] text-slate-500 mt-2">
                El parte y {submittedReport.photos.length} foto(s) ya están en la
                bandeja del Encargado de Flota.
              </p>
            </div>
            <button
              type="button"
              onClick={handleResetForm}
              className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold"
            >
              Enviar otro parte de avería
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl shadow-2xl p-5 space-y-4 text-xs"
          >
            <div>
              <label className="font-extrabold text-slate-800 block mb-1.5 flex items-center gap-1.5">
                <Car className="w-4 h-4 text-rose-600" />
                Matrícula del coche
              </label>
              <input
                type="text"
                required
                autoFocus
                value={plateInput}
                onChange={(e) => handlePlateInputChange(e.target.value)}
                placeholder="Ej. 4821 o 4821-LMN"
                className="w-full px-3.5 py-3 rounded-xl border-2 border-slate-300 bg-slate-50 text-base font-extrabold tracking-wider text-slate-900 uppercase focus:border-blue-600 focus:outline-none"
              />

              {selectedPlateEntry ? (
                <div className="mt-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between">
                  <span className="font-bold">
                    ✅ {selectedPlateEntry.code} — {selectedPlateEntry.plate}
                  </span>
                  <span className="text-[11px] text-emerald-700">
                    {selectedPlateEntry.brand} {selectedPlateEntry.model}
                  </span>
                </div>
              ) : (
                matchingPlates.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {matchingPlates.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handleSelectSuggestion(m)}
                        className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 font-bold text-[11px]"
                      >
                        {m.plate} ({m.code})
                      </button>
                    ))}
                  </div>
                )
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Tu nombre
                </label>
                <input
                  type="text"
                  required
                  value={reporterName}
                  onChange={(e) => setReporterName(e.target.value)}
                  placeholder="Ej. Juan Pérez"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 font-semibold"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Kilómetros actuales
                </label>
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={mileage}
                  onChange={(e) => setMileage(e.target.value)}
                  placeholder="Ej. 142500"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1.5">
                Gravedad / ¿Puede seguir circulando?
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { id: 'Normal', label: 'Leve / Sigue' },
                    { id: 'Prioritaria', label: 'Urgente' },
                    { id: 'Inmovilización Inmediata', label: 'Inmovilizada' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setUrgency(opt.id)}
                    className={`py-2 px-2 rounded-xl font-bold border text-[11px] transition ${
                      urgency === opt.id
                        ? opt.id === 'Inmovilización Inmediata'
                          ? 'bg-rose-600 text-white border-rose-700'
                          : opt.id === 'Prioritaria'
                          ? 'bg-amber-500 text-white border-amber-600'
                          : 'bg-blue-600 text-white border-blue-700'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-700">
                  ¿Qué avería ha salido?
                </label>
                <VoiceDictationButton
                  onTranscript={(txt) =>
                    setDescription((prev) => (prev ? `${prev} ${txt}` : txt))
                  }
                />
              </div>
              <textarea
                required
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe el fallo, ruido o testigo encendido..."
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50"
              />
            </div>

            <div className="space-y-2">
              <label className="font-bold text-slate-700 block">
                Foto de la avería (opcional, máx. 4)
              </label>
              <label className="w-full py-3 px-4 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/70 hover:bg-blue-100 text-blue-800 font-bold flex items-center justify-center gap-2 cursor-pointer">
                <Camera className="w-5 h-5" />
                Sacar Foto con Cámara / Galería
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  onChange={handlePhotoCapture}
                  className="hidden"
                />
              </label>

              {photos.length > 0 && (
                <div className="grid grid-cols-4 gap-2 pt-1">
                  {photos.map((src, idx) => (
                    <div
                      key={idx}
                      className="relative rounded-lg overflow-hidden border border-slate-200 aspect-square"
                    >
                      <img
                        src={src}
                        alt={`Foto ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setPhotos((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="absolute top-1 right-1 p-1 rounded-full bg-rose-600 text-white shadow"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSending}
              className="w-full py-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-extrabold flex items-center justify-center gap-2 shadow-md"
            >
              <Send className="w-4 h-4" />
              {isSending ? 'Enviando a Flota...' : 'Enviar Avería a Flota'}
            </button>
          </form>
        )}
      </div>

      <p className="text-center text-[11px] text-slate-500 pt-4">
        Acceso exclusivo de unidad para comunicación rápida de averías
      </p>
    </div>
  );
};
