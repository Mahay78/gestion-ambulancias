import React, { useState } from 'react';
import { Mic, MicOff } from 'lucide-react';

interface VoiceDictationButtonProps {
  onTranscript: (text: string) => void;
  label?: string;
}

export const VoiceDictationButton: React.FC<VoiceDictationButtonProps> = ({
  onTranscript,
  label = 'Dictar por Voz',
}) => {
  const [isListening, setIsListening] = useState(false);
  const [unsupported, setUnsupported] = useState(false);

  const handleToggleVoice = () => {
    const SpeechRecognitionAPI =
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setUnsupported(true);
      alert(
        'El dictado por voz no está disponible en este navegador. Prueba con Chrome o Safari en tu móvil/tablet.'
      );
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const recognition = new (SpeechRecognitionAPI as any)();
      recognition.lang = 'es-ES';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        if (transcript) {
          onTranscript(transcript);
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  if (unsupported) return null;

  return (
    <button
      type="button"
      onClick={handleToggleVoice}
      title="Dictar texto usando el micrófono del móvil o tablet"
      className={`px-2.5 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition border ${
        isListening
          ? 'bg-rose-600 text-white border-rose-600 animate-pulse shadow-xs'
          : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200'
      }`}
    >
      {isListening ? (
        <>
          <MicOff className="w-3.5 h-3.5" />
          <span>Escuchando... (habla ahora)</span>
        </>
      ) : (
        <>
          <Mic className="w-3.5 h-3.5" />
          <span>{label}</span>
        </>
      )}
    </button>
  );
};
