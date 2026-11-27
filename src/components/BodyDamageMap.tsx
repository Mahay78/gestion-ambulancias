import React, { useState } from 'react';
import { BodyDamageMark, BodyDamageType, BodyView } from '../types';
import { ShieldAlert, Plus, CheckCircle2, Trash2, Car } from 'lucide-react';

interface BodyDamageMapProps {
  damages: BodyDamageMark[];
  onChange: (updated: BodyDamageMark[]) => void;
  readOnly?: boolean;
}

const VIEWS: { id: BodyView; label: string }[] = [
  { id: 'frontal', label: 'Frontal' },
  { id: 'trasera', label: 'Trasera' },
  { id: 'lateral_izq', label: 'Lateral Izq.' },
  { id: 'lateral_der', label: 'Lateral Der.' },
  { id: 'techo', label: 'Techo / Prioritario' },
];

const DAMAGE_TYPES: BodyDamageType[] = [
  'Roce',
  'Golpe',
  'Luna / Cristal',
  'Óptica / Prioritario',
  'Otro',
];

const DAMAGE_COLORS: Record<BodyDamageType, string> = {
  Roce: 'bg-amber-500 border-amber-700',
  Golpe: 'bg-rose-600 border-rose-800',
  'Luna / Cristal': 'bg-sky-500 border-sky-700',
  'Óptica / Prioritario': 'bg-orange-500 border-orange-700',
  Otro: 'bg-purple-600 border-purple-800',
};

export const BodyDamageMap: React.FC<BodyDamageMapProps> = ({
  damages,
  onChange,
  readOnly = false,
}) => {
  const [activeView, setActiveView] = useState<BodyView>('frontal');
  const [damageType, setDamageType] = useState<BodyDamageType>('Roce');
  const [moment, setMoment] = useState<BodyDamageMark['moment']>('Campa');
  const [note, setNote] = useState('');

  const viewDamages = damages.filter((d) => d.view === activeView);
  const activeCount = damages.filter((d) => !d.repaired).length;

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (readOnly) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xPercent = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const yPercent = Math.round(((e.clientY - rect.top) / rect.height) * 100);

    const newMark: BodyDamageMark = {
      id: `dmg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      view: activeView,
      xPercent: Math.max(4, Math.min(96, xPercent)),
      yPercent: Math.max(6, Math.min(94, yPercent)),
      type: damageType,
      moment,
      note: note.trim() || `${damageType} en ${VIEWS.find((v) => v.id === activeView)?.label}`,
      date: new Date().toISOString().split('T')[0],
      repaired: false,
    };

    onChange([newMark, ...damages]);
    setNote('');
  };

  const toggleRepaired = (id: string) => {
    onChange(
      damages.map((d) => (d.id === id ? { ...d, repaired: !d.repaired } : d))
    );
  };

  const removeMark = (id: string) => {
    onChange(damages.filter((d) => d.id !== id));
  };

  const renderSilhouette = (view: BodyView) => {
    switch (view) {
      case 'frontal':
        return (
          <g stroke="#334155" strokeWidth="2.5" fill="#f8fafc">
            {/* Techo y puente prioritario */}
            <rect x="95" y="18" width="110" height="16" rx="6" fill="#dbeafe" stroke="#2563eb" />
            <rect x="135" y="20" width="30" height="12" rx="3" fill="#eff6ff" stroke="#3b82f6" />
            {/* Cabina */}
            <path d="M75 40 L225 40 L240 100 L240 160 Q240 172 225 172 L75 172 Q60 172 60 160 L60 100 Z" />
            {/* Parabrisas */}
            <path d="M82 48 L218 48 L228 95 L72 95 Z" fill="#e0f2fe" />
            {/* Faros */}
            <rect x="68" y="115" width="32" height="18" rx="4" fill="#fef08a" />
            <rect x="200" y="115" width="32" height="18" rx="4" fill="#fef08a" />
            {/* Parrilla y Matrícula */}
            <rect x="112" y="118" width="76" height="24" rx="4" fill="#e2e8f0" />
            <rect x="125" y="150" width="50" height="12" rx="2" fill="#ffffff" />
            {/* Retrovisores */}
            <rect x="42" y="75" width="16" height="28" rx="4" fill="#cbd5e1" />
            <rect x="242" y="75" width="16" height="28" rx="4" fill="#cbd5e1" />
          </g>
        );
      case 'trasera':
        return (
          <g stroke="#334155" strokeWidth="2.5" fill="#f8fafc">
            {/* Prioritarios traseros */}
            <rect x="75" y="20" width="32" height="12" rx="4" fill="#dbeafe" stroke="#2563eb" />
            <rect x="193" y="20" width="32" height="12" rx="4" fill="#dbeafe" stroke="#2563eb" />
            {/* Portón / Puertas */}
            <rect x="65" y="34" width="170" height="138" rx="10" />
            <line x1="150" y1="34" x2="150" y2="150" strokeDasharray="4 3" />
            {/* Lunas traseras */}
            <rect x="78" y="48" width="62" height="44" rx="4" fill="#e0f2fe" />
            <rect x="160" y="48" width="62" height="44" rx="4" fill="#e0f2fe" />
            {/* Pilotos */}
            <rect x="72" y="115" width="18" height="30" rx="3" fill="#fecaca" stroke="#dc2626" />
            <rect x="210" y="115" width="18" height="30" rx="3" fill="#fecaca" stroke="#dc2626" />
            {/* Peldaño */}
            <rect x="75" y="156" width="150" height="12" rx="3" fill="#cbd5e1" />
          </g>
        );
      case 'lateral_izq':
      case 'lateral_der': {
        const flip = view === 'lateral_der';
        return (
          <g
            stroke="#334155"
            strokeWidth="2.5"
            fill="#f8fafc"
            transform={flip ? 'translate(300,0) scale(-1,1)' : undefined}
          >
            {/* Puente prioritario */}
            <rect x="78" y="22" width="38" height="10" rx="4" fill="#dbeafe" stroke="#2563eb" />
            <rect x="236" y="24" width="24" height="8" rx="3" fill="#dbeafe" stroke="#2563eb" />
            {/* Silueta furgón ambulancia */}
            <path d="M30 140 L30 98 L65 50 L95 34 L268 34 Q276 34 276 44 L276 140 Z" />
            {/* Ventana cabina */}
            <path d="M68 56 L96 42 L116 42 L116 86 L55 86 Z" fill="#e0f2fe" />
            {/* Ventana célula sanitaria */}
            <rect x="134" y="46" width="110" height="38" rx="5" fill="#e0f2fe" />
            {/* Franja sanitaria */}
            <rect x="34" y="96" width="240" height="12" fill="#fee2e2" stroke="none" />
            {/* Ruedas */}
            <circle cx="80" cy="144" r="22" fill="#334155" />
            <circle cx="80" cy="144" r="10" fill="#cbd5e1" />
            <circle cx="222" cy="144" r="22" fill="#334155" />
            <circle cx="222" cy="144" r="10" fill="#cbd5e1" />
          </g>
        );
      }
      case 'techo':
        return (
          <g stroke="#334155" strokeWidth="2.5" fill="#f8fafc">
            <rect x="40" y="34" width="220" height="120" rx="18" />
            {/* Puente LED delantero */}
            <rect x="65" y="44" width="20" height="100" rx="6" fill="#dbeafe" stroke="#2563eb" />
            {/* Aire acondicionado célula */}
            <rect x="115" y="58" width="56" height="72" rx="8" fill="#e2e8f0" />
            {/* Claraboya / Extractor */}
            <rect x="195" y="68" width="40" height="52" rx="6" fill="#e0f2fe" />
            {/* Rotativo trasero */}
            <rect x="246" y="46" width="10" height="96" rx="4" fill="#dbeafe" stroke="#2563eb" />
          </g>
        );
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Car className="w-4 h-4 text-rose-600" />
          <div>
            <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide">
              Mapa Visual 360° de Carrocería y Lunas
            </h4>
            <p className="text-[11px] text-slate-500">
              Haz clic sobre el esquema para marcar golpes, roces o lunas ({activeCount} activos)
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {VIEWS.map((v) => {
            const count = damages.filter((d) => d.view === v.id && !d.repaired).length;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setActiveView(v.id)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1 ${
                  activeView === v.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {v.label}
                {count > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px]">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {!readOnly && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div>
            <label className="font-bold text-slate-600 block mb-1">Tipo de daño</label>
            <select
              value={damageType}
              onChange={(e) => setDamageType(e.target.value as BodyDamageType)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold"
            >
              {DAMAGE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="font-bold text-slate-600 block mb-1">Momento</label>
            <select
              value={moment}
              onChange={(e) =>
                setMoment(e.target.value as BodyDamageMark['moment'])
              }
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold"
            >
              <option value="Campa">Revisión en Campa</option>
              <option value="Antes de taller">Antes de entrar a taller</option>
              <option value="Después de taller">Al recoger de taller</option>
            </select>
          </div>
          <div>
            <label className="font-bold text-slate-600 block mb-1">
              Nota rápida (opcional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej. Roce paragolpes dcho..."
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
            />
          </div>
        </div>
      )}

      <div className="relative bg-slate-100 rounded-xl border border-slate-200 p-2 flex items-center justify-center overflow-hidden">
        <div className="relative w-full max-w-[420px]">
          <svg
            viewBox="0 0 300 185"
            onClick={handleSvgClick}
            className={`w-full h-auto select-none ${
              readOnly ? 'cursor-default' : 'cursor-crosshair'
            }`}
          >
            {renderSilhouette(activeView)}
          </svg>

          {viewDamages.map((dmg, idx) => (
            <div
              key={dmg.id}
              style={{ left: `${dmg.xPercent}%`, top: `${dmg.yPercent}%` }}
              title={`${dmg.type} (${dmg.moment}): ${dmg.note}`}
              className={`absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 text-white text-[10px] font-extrabold flex items-center justify-center shadow-md ${
                dmg.repaired
                  ? 'bg-emerald-500 border-emerald-700 opacity-75'
                  : DAMAGE_COLORS[dmg.type]
              }`}
            >
              {idx + 1}
            </div>
          ))}
        </div>
      </div>

      {damages.length > 0 ? (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {damages.map((dmg) => (
            <div
              key={dmg.id}
              className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs ${
                dmg.repaired
                  ? 'bg-emerald-50/60 border-emerald-200 text-slate-500'
                  : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold text-white ${
                      dmg.repaired ? 'bg-emerald-600' : 'bg-rose-600'
                    }`}
                  >
                    {dmg.repaired ? 'Reparado' : dmg.type}
                  </span>
                  <span className="font-bold">
                    {VIEWS.find((v) => v.id === dmg.view)?.label}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    • {dmg.moment} • {dmg.date}
                  </span>
                </div>
                <p className={`text-[11px] truncate ${dmg.repaired ? 'line-through' : ''}`}>
                  {dmg.note}
                </p>
              </div>
              {!readOnly && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleRepaired(dmg.id)}
                    title={dmg.repaired ? 'Marcar como activo' : 'Marcar como reparado'}
                    className="p-1.5 rounded-lg hover:bg-emerald-100 text-emerald-700"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeMark(dmg.id)}
                    title="Eliminar marca"
                    className="p-1.5 rounded-lg hover:bg-rose-100 text-rose-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-3 text-xs text-slate-500 flex items-center justify-center gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          Sin daños registrados en carrocería. Toca el esquema para añadir uno.
        </div>
      )}

      {activeCount > 0 && (
        <div className="flex items-center gap-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600" />
          <span>
            Hay <strong>{activeCount}</strong> marca(s) de carrocería/lunas activas pendientes de subsanar.
          </span>
        </div>
      )}
    </div>
  );
};
