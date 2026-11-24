import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, AlertCircle } from 'lucide-react';

interface VoiceDictationButtonProps {
  onTranscript: (text: string) => void;
  label?: string;
}

export const VoiceDictationButton: React.FC<VoiceDictationButtonProps> = ({
  onTranscript,
  label = 'Dictar por Voz',
}) => {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const onTranscriptRef = useRef(onTranscript);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const handleToggleVoice = () => {
    setErrorMsg(null);

    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
      setInterimText('');
      return;
    }

    // Verificar contexto seguro (HTTPS o localhost) necesario en móviles
    if (
      !window.isSecureContext &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
      setErrorMsg(
        'En el móvil, el micrófono requiere HTTPS. Abre la app desde https://mahay78.github.io/gestion-ambulancias/'
      );
      return;
    }

    const SpeechRecognitionAPI =
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setErrorMsg(
        'Tu navegador no soporta dictado por voz. Usa Google Chrome, Edge o Safari.'
      );
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const recognition = new (SpeechRecognitionAPI as any)();
      recognitionRef.current = recognition;
      recognition.lang = 'es-ES';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setInterimText('Escuchando...');
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        let finalChunk = '';
        let interimChunk = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalChunk += result[0].transcript;
          } else {
            interimChunk += result[0].transcript;
          }
        }

        if (interimChunk) {
          setInterimText(interimChunk);
        }

        if (finalChunk.trim()) {
          const formatted =
            finalChunk.trim().charAt(0).toUpperCase() +
            finalChunk.trim().slice(1);
          onTranscriptRef.current(formatted);
          setInterimText('');
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (event: any) => {
        setIsListening(false);
        setInterimText('');
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setErrorMsg(
            'Permiso de micrófono denegado. Activa el permiso de micrófono en el candado de la barra de direcciones.'
          );
        } else if (event.error === 'no-speech') {
          setErrorMsg('No se detectó voz. Pulsa y habla cerca del micrófono.');
        } else if (event.error !== 'aborted') {
          setErrorMsg(`Error de voz (${event.error}). Inténtalo de nuevo.`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimText('');
      };

      recognition.start();
    } catch {
      setIsListening(false);
      setInterimText('');
      setErrorMsg('No se pudo iniciar el micrófono.');
    }
  };

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <div className="inline-flex items-center gap-1.5">
        {isListening && interimText && (
          <span className="text-[11px] font-medium text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md max-w-[190px] truncate">
            🎙️ "{interimText}"
          </span>
        )}
        <button
          type="button"
          onClick={handleToggleVoice}
          title={
            isListening
              ? 'Pulsa para detener el dictado'
              : 'Dictar texto por voz en español'
          }
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition border shrink-0 ${
            isListening
              ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600 animate-pulse shadow-xs'
              : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200'
          }`}
        >
          {isListening ? (
            <>
              <Square className="w-3 h-3 fill-current" />
              <span>Detener</span>
            </>
          ) : (
            <>
              <Mic className="w-3.5 h-3.5" />
              <span>{label}</span>
            </>
          )}
        </button>
      </div>

      {errorMsg && (
        <span className="text-[11px] text-rose-600 font-medium flex items-center gap-1 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
          <AlertCircle className="w-3 h-3 shrink-0" />
          {errorMsg}
        </span>
      )}
    </div>
  );
};
