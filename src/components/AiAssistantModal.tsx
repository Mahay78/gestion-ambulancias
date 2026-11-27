import React, { useState } from 'react';
import {
  FleetContextData,
  askFleetAiAssistant,
  getSavedGeminiFreeKey,
  saveGeminiFreeKey,
} from '../utils/aiAssistant';
import { compressImageFile } from '../utils/imageCompression';
import { VoiceDictationButton } from './VoiceDictationButton';
import {
  Sparkles,
  X,
  Send,
  Camera,
  KeyRound,
  Bot,
  Trash2,
} from 'lucide-react';

interface AiAssistantModalProps {
  fleetContext: FleetContextData;
  onClose: () => void;
}

interface ChatMsg {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  provider?: 'gemini-free' | 'local-free';
  image?: string;
}

const QUICK_PROMPTS = [
  'Resumen de la flota hoy',
  '¿Qué documentos vencen pronto?',
  '¿Qué órdenes externas hay abiertas?',
  '¿Qué repuestos están bajo mínimos?',
];

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({
  fleetContext,
  onClose,
}) => {
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: 'welcome',
      role: 'assistant',
      provider: 'local-free',
      text: '¡Hola! Soy el Asistente IA de **Ambu-lzflota** (100% gratuito). Pregúntame por cualquier ambulancia, matrícula, vencimiento de ITV/Seguro, órdenes en taller o stock del almacén.',
    },
  ]);
  const [input, setInput] = useState('');
  const [attachedImage, setAttachedImage] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [showKeyConfig, setShowKeyConfig] = useState(false);
  const [geminiKey, setGeminiKey] = useState(() => getSavedGeminiFreeKey());
  const [keySavedMsg, setKeySavedMsg] = useState('');

  const handleSend = async (promptText?: string) => {
    const q = (promptText ?? input).trim();
    if (!q && !attachedImage) return;

    const userMsg: ChatMsg = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: q || 'Analizar esta imagen',
      image: attachedImage || undefined,
    };
    setMessages((prev) => [...prev, userMsg]);
    if (!promptText) setInput('');
    const imgToSend = attachedImage;
    setAttachedImage('');
    setLoading(true);

    const res = await askFleetAiAssistant(
      userMsg.text,
      fleetContext,
      imgToSend || undefined
    );

    setMessages((prev) => [
      ...prev,
      {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: res.text,
        provider: res.provider,
      },
    ]);
    setLoading(false);
  };

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 900, 0.72);
      setAttachedImage(compressed);
    } catch {
      // ignorar
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full h-[85vh] sm:h-[600px] flex flex-col overflow-hidden">
        {/* Cabecera */}
        <div className="px-4 py-3.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold">Asistente IA Ambu-lzflota</h3>
              <p className="text-[11px] text-slate-300">
                {geminiKey
                  ? 'Conectado a Gemini (Gratis) + Motor Local'
                  : 'Motor Inteligente Local (100% Gratis • Offline)'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowKeyConfig(!showKeyConfig)}
              title="Configurar clave gratuita de Google Gemini (opcional)"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200"
            >
              <KeyRound className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Configuración opcional de API Key gratuita de Gemini */}
        {showKeyConfig && (
          <div className="p-3 bg-indigo-50 border-b border-indigo-200 text-xs space-y-2">
            <p className="text-indigo-900 font-semibold">
              Opcional: añade una API Key gratuita de{' '}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-bold"
              >
                Google AI Studio
              </a>{' '}
              para activar Gemini 2.5 Flash y análisis de fotos (sin tarjeta). Si lo
              dejas vacío, funciona el motor local gratis.
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                value={geminiKey}
                onChange={(e) => {
                  setGeminiKey(e.target.value);
                  setKeySavedMsg('');
                }}
                placeholder="AIza..."
                className="flex-1 px-3 py-1.5 rounded-lg border border-indigo-300 bg-white font-mono"
              />
              <button
                type="button"
                onClick={() => {
                  saveGeminiFreeKey(geminiKey);
                  setKeySavedMsg('✅ Guardada');
                }}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-bold"
              >
                Guardar
              </button>
            </div>
            {keySavedMsg && (
              <p className="text-emerald-700 font-bold">{keySavedMsg}</p>
            )}
          </div>
        )}

        {/* Sugerencias rápidas */}
        <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-slate-50">
          {QUICK_PROMPTS.map((qp) => (
            <button
              key={qp}
              type="button"
              onClick={() => handleSend(qp)}
              className="px-2.5 py-1 rounded-full bg-white border border-slate-200 hover:border-blue-300 text-[11px] font-bold text-slate-700 shrink-0"
            >
              {qp}
            </button>
          ))}
        </div>

        {/* Mensajes */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50 text-xs">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${
                m.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 space-y-1.5 shadow-xs ${
                  m.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-800'
                }`}
              >
                {m.role === 'assistant' && (
                  <div className="flex items-center gap-1 text-[10px] font-bold text-indigo-600">
                    <Bot className="w-3 h-3" />
                    {m.provider === 'gemini-free'
                      ? 'Gemini Gratis'
                      : 'IA Local Gratis'}
                  </div>
                )}
                {m.image && (
                  <img
                    src={m.image}
                    alt="Adjunto"
                    className="w-32 h-24 object-cover rounded-lg border border-white/30"
                  />
                )}
                <div className="whitespace-pre-wrap leading-relaxed">
                  {m.text}
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="text-[11px] text-slate-500 font-semibold animate-pulse">
              Analizando datos de la flota...
            </div>
          )}
        </div>

        {/* Entrada de texto + voz + foto */}
        <div className="p-3 bg-white border-t border-slate-200 space-y-2">
          {attachedImage && (
            <div className="flex items-center gap-2 text-xs bg-slate-100 p-1.5 rounded-lg">
              <img
                src={attachedImage}
                alt="Vista previa"
                className="w-10 h-10 object-cover rounded"
              />
              <span className="flex-1 text-slate-600 font-semibold">
                Foto lista para analizar
              </span>
              <button
                type="button"
                onClick={() => setAttachedImage('')}
                className="p-1 text-rose-600"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-1.5"
          >
            <label
              title="Adjuntar foto (requiere API Key gratuita de Gemini para Visión)"
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer shrink-0"
            >
              <Camera className="w-4 h-4" />
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImagePick}
                className="hidden"
              />
            </label>
            <VoiceDictationButton
              onTranscript={(txt) =>
                setInput((prev) => (prev ? `${prev} ${txt}` : txt))
              }
            />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pregunta sobre AMB-04, ITV, stock, talleres..."
              className="flex-1 px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 text-xs"
            />
            <button
              type="submit"
              disabled={loading || (!input.trim() && !attachedImage)}
              className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
