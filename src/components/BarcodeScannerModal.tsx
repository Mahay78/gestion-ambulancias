import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { QrCode, X, Camera, Keyboard } from 'lucide-react';

interface BarcodeScannerModalProps {
  onDetected: (code: string) => void;
  onClose: () => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  onDetected,
  onClose,
}) => {
  const [manualCode, setManualCode] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [scanning, setScanning] = useState(true);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const regionId = 'ambufleet-barcode-reader';

  useEffect(() => {
    let mounted = true;
    const startScanner = async () => {
      try {
        const html5Qr = new Html5Qrcode(regionId);
        scannerRef.current = html5Qr;
        await html5Qr.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 150 } },
          (decodedText) => {
            if (!mounted) return;
            mounted = false;
            html5Qr
              .stop()
              .catch(() => {})
              .finally(() => {
                onDetected(decodedText.trim());
              });
          },
          () => {
            // ignorar frames sin lectura
          }
        );
      } catch (err) {
        if (mounted) {
          setScanning(false);
          setCameraError(
            err instanceof Error
              ? err.message
              : 'No se pudo acceder a la cámara. Usa la entrada manual por SKU/código.'
          );
        }
      }
    };

    startScanner();

    return () => {
      mounted = false;
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [onDetected]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    onDetected(manualCode.trim());
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Escáner de Código de Barras / QR
              </h3>
              <p className="text-[11px] text-slate-500">
                Apunta al código de barras o QR del repuesto en almacén
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="rounded-xl overflow-hidden bg-slate-900 border border-slate-300 relative min-h-[220px] flex items-center justify-center">
            <div id={regionId} className="w-full" />
            {!scanning && cameraError && (
              <div className="p-4 text-center text-xs text-amber-200 space-y-2">
                <Camera className="w-8 h-8 mx-auto text-amber-400" />
                <p className="font-bold">Cámara no disponible</p>
                <p className="text-[11px] text-slate-300">{cameraError}</p>
              </div>
            )}
          </div>

          <form onSubmit={handleManualSubmit} className="space-y-2 text-xs">
            <label className="font-bold text-slate-700 flex items-center gap-1.5">
              <Keyboard className="w-3.5 h-3.5 text-slate-500" />
              O introduce / pega el SKU o código leído:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Ej. FLT-ACE-SPR"
                className="flex-1 px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 font-bold text-slate-900 uppercase"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold"
              >
                Buscar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
