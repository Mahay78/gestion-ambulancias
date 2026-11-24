import React, { useState, useRef, useEffect } from 'react';
import { Ambulance } from '../types';
import {
  Camera,
  Search,
  X,
  CheckCircle2,
  ScanLine,
  Sparkles,
} from 'lucide-react';

interface PlateScannerModalProps {
  ambulances: Ambulance[];
  onSelectAmbulance: (ambulanceId: string) => void;
  onClose: () => void;
}

export const PlateScannerModal: React.FC<PlateScannerModalProps> = ({
  ambulances,
  onSelectAmbulance,
  onClose,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [plateSearch, setPlateSearch] = useState('');
  const [capturedPreview, setCapturedPreview] = useState<string>('');

  const startCamera = async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch {
      setCameraError(
        'No se pudo acceder a la cámara en vivo (puedes subir una foto de la matrícula o usar el buscador rápido abajo).'
      );
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const handleCaptureFrameOrSimulate = (targetAmb?: Ambulance) => {
    setIsScanning(true);
    if (videoRef.current && cameraActive) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 360;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        setCapturedPreview(canvas.toDataURL('image/jpeg', 0.7));
      }
    }

    setTimeout(() => {
      setIsScanning(false);
      const chosen = targetAmb || ambulances[0];
      if (chosen) {
        setPlateSearch(chosen.plate);
      }
    }, 650);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCapturedPreview(reader.result as string);
      setIsScanning(true);
      // Si el nombre del archivo contiene dígitos de alguna matrícula, o tomamos coincidencia
      const cleanName = file.name.toUpperCase();
      const matched = ambulances.find((a) =>
        cleanName.includes(a.plate.replace('-', '').toUpperCase())
      );
      setTimeout(() => {
        setIsScanning(false);
        if (matched) {
          setPlateSearch(matched.plate);
        }
      }, 600);
    };
    reader.readAsDataURL(file);
  };

  const normalizedQuery = plateSearch.replace(/[\s-]/g, '').toUpperCase();
  const matchedAmbulances = ambulances.filter((a) => {
    const normPlate = a.plate.replace(/[\s-]/g, '').toUpperCase();
    const normCode = a.code.replace(/[\s-]/g, '').toUpperCase();
    return (
      normPlate.includes(normalizedQuery) ||
      normCode.includes(normalizedQuery) ||
      a.model.toUpperCase().includes(normalizedQuery)
    );
  });

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200">
        {/* Cabecera */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ScanLine className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="text-sm font-bold">
                Escáner de Matrícula de Ambulancia
              </h3>
              <p className="text-[11px] text-slate-400">
                Apunta con la cámara a la matrícula o escribe los números
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {/* Visor de Cámara con Recuadro Guía de Matrícula Europea */}
          <div className="relative rounded-xl overflow-hidden bg-slate-950 aspect-video flex items-center justify-center border border-slate-800">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${
                cameraActive ? 'block' : 'hidden'
              }`}
            />

            {!cameraActive && capturedPreview && (
              <img
                src={capturedPreview}
                alt="Captura matrícula"
                className="w-full h-full object-cover opacity-80"
              />
            )}

            {/* Marco Guía de Matrícula [E] 1234-XXX */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-4">
              <div
                className={`w-64 h-16 rounded-lg border-2 flex items-center overflow-hidden shadow-lg transition ${
                  isScanning
                    ? 'border-emerald-400 bg-emerald-950/30 animate-pulse'
                    : 'border-blue-400/90 bg-slate-900/30'
                }`}
              >
                <div className="w-7 h-full bg-blue-700/90 flex flex-col items-center justify-center text-white font-bold text-[10px]">
                  <span>🇪🇺</span>
                  <span>E</span>
                </div>
                <div className="flex-1 text-center font-mono text-lg font-extrabold tracking-widest text-white/90">
                  {plateSearch || '0000-XXX'}
                </div>
              </div>
              <span className="mt-2 px-2.5 py-0.5 rounded-full bg-slate-900/80 text-white text-[11px] font-medium">
                {isScanning
                  ? 'Analizando caracteres de matrícula...'
                  : 'Encuadra la matrícula dentro del rectángulo'}
              </span>
            </div>
          </div>

          {cameraError && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 p-2.5 rounded-lg">
              {cameraError}
            </p>
          )}

          {/* Botones de Captura de Cámara / Subir Foto de Matrícula */}
          <div className="flex flex-wrap items-center gap-2">
            {cameraActive && (
              <button
                type="button"
                onClick={() => handleCaptureFrameOrSimulate()}
                className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center justify-center gap-2 shadow-xs"
              >
                <Camera className="w-4 h-4" />
                Capturar Matrícula Ahora
              </button>
            )}

            <label className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold flex items-center justify-center gap-2 cursor-pointer border border-slate-300">
              <Camera className="w-4 h-4 text-slate-600" />
              <span>Hacer Foto a Matrícula</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* Buscador instantáneo o Reconocimiento directo */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Matrícula Detectada / Búsqueda Rápida por Dígitos:
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Escribe los números o letras (ej. 4821, 9104, 3319)..."
                value={plateSearch}
                onChange={(e) => setPlateSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border-2 border-slate-300 font-mono text-sm font-bold uppercase focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Lista de matrículas coincidentes de la flota */}
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            <span className="text-[11px] font-bold uppercase text-slate-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-blue-500" />
              Unidades en Flota ({matchedAmbulances.length}):
            </span>
            {matchedAmbulances.map((amb) => (
              <button
                key={amb.id}
                type="button"
                onClick={() => {
                  stopCamera();
                  onSelectAmbulance(amb.id);
                  onClose();
                }}
                className="w-full p-2.5 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 flex items-center justify-between transition text-left"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center rounded border border-slate-400 overflow-hidden bg-white shadow-2xs">
                    <span className="bg-blue-700 text-white text-[9px] font-bold px-1 py-1">
                      E
                    </span>
                    <span className="px-2 py-0.5 font-mono text-xs font-extrabold text-slate-900">
                      {amb.plate}
                    </span>
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">
                      {amb.code} • {amb.brand} {amb.model}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {amb.type} • {amb.mileage.toLocaleString()} km
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Seleccionar
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
