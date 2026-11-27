import React from 'react';
import { DualBatteryStatus, TirePosition, TireStatus } from '../types';
import { getLocalDateString } from '../utils/dateUtils';
import { BatteryCharging, Disc, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface TiresAndBatteriesPanelProps {
  tires?: TireStatus[];
  batteries?: DualBatteryStatus;
  onUpdateTires: (tires: TireStatus[]) => void;
  onUpdateBatteries: (batteries: DualBatteryStatus) => void;
}

const DEFAULT_TIRES: TireStatus[] = [
  { position: 'FL', label: 'Delantero Izq.', treadDepthMm: 6.2, pressureBar: 4.5, condition: 'OK', lastCheckDate: 'Sin revisar' },
  { position: 'FR', label: 'Delantero Der.', treadDepthMm: 6.0, pressureBar: 4.5, condition: 'OK', lastCheckDate: 'Sin revisar' },
  { position: 'RL', label: 'Trasero Izq.', treadDepthMm: 5.8, pressureBar: 4.8, condition: 'OK', lastCheckDate: 'Sin revisar' },
  { position: 'RR', label: 'Trasero Der.', treadDepthMm: 5.7, pressureBar: 4.8, condition: 'OK', lastCheckDate: 'Sin revisar' },
  { position: 'SPARE', label: 'Repuesto', treadDepthMm: 7.0, pressureBar: 4.8, condition: 'OK', lastCheckDate: 'Sin revisar' },
];

const DEFAULT_BATTERIES: DualBatteryStatus = {
  starterVoltage: 12.7,
  starterStatus: 'OK',
  auxVoltage: 12.8,
  auxStatus: 'OK',
  auxType: 'AGM 105Ah Célula Sanitaria',
  lastCheckDate: 'Sin revisar',
};

const computeTireCondition = (mm: number): TireStatus['condition'] => {
  if (mm < 3) return 'Crítico (<3mm)';
  if (mm < 4) return 'Desgaste';
  return 'OK';
};

const computeStarterStatus = (v: number): 'OK' | 'Baja (<12.3V)' | 'Crítica' => {
  if (v < 11.9) return 'Crítica';
  if (v < 12.3) return 'Baja (<12.3V)';
  return 'OK';
};

const computeAuxStatus = (v: number): 'OK' | 'Baja (<12.2V)' | 'Crítica' => {
  if (v < 11.9) return 'Crítica';
  if (v < 12.2) return 'Baja (<12.2V)';
  return 'OK';
};

export const TiresAndBatteriesPanel: React.FC<TiresAndBatteriesPanelProps> = ({
  tires,
  batteries,
  onUpdateTires,
  onUpdateBatteries,
}) => {
  const currentTires = tires && tires.length === 5 ? tires : DEFAULT_TIRES;
  const currentBatteries = batteries || DEFAULT_BATTERIES;

  const handleTireChange = (
    pos: TirePosition,
    field: 'treadDepthMm' | 'pressureBar',
    rawVal: string
  ) => {
    const val = parseFloat(rawVal);
    if (isNaN(val)) return;
    const today = getLocalDateString();
    const updated = currentTires.map((t) => {
      if (t.position !== pos) return t;
      const next = {
        ...t,
        [field]: val,
        lastCheckDate: today,
      };
      next.condition = computeTireCondition(next.treadDepthMm);
      return next;
    });
    onUpdateTires(updated);
  };

  const handleBatteryVoltage = (field: 'starterVoltage' | 'auxVoltage', rawVal: string) => {
    const val = parseFloat(rawVal);
    if (isNaN(val)) return;
    const today = getLocalDateString();
    const next: DualBatteryStatus = {
      ...currentBatteries,
      [field]: val,
      lastCheckDate: today,
    };
    next.starterStatus = computeStarterStatus(next.starterVoltage);
    next.auxStatus = computeAuxStatus(next.auxVoltage);
    onUpdateBatteries(next);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Neumáticos */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Disc className="w-4 h-4 text-slate-800" />
            <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide">
              Neumáticos (4 Ruedas + Repuesto)
            </h4>
          </div>
          <span className="text-[10px] font-bold text-slate-500">
            Mín. legal 1.6mm • Alerta &lt; 3mm
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {currentTires.map((tire) => {
            const isCrit = tire.treadDepthMm < 3;
            const isWarn = !isCrit && tire.treadDepthMm < 4;
            return (
              <div
                key={tire.position}
                className={`p-2.5 rounded-xl border text-xs space-y-2 ${
                  isCrit
                    ? 'bg-rose-50 border-rose-300'
                    : isWarn
                    ? 'bg-amber-50 border-amber-300'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-900">{tire.label}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      isCrit
                        ? 'bg-rose-600 text-white'
                        : isWarn
                        ? 'bg-amber-500 text-white'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {tire.condition}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block">
                      Dibujo (mm)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="15"
                      value={tire.treadDepthMm}
                      onChange={(e) =>
                        handleTireChange(tire.position, 'treadDepthMm', e.target.value)
                      }
                      className="w-full mt-0.5 px-2 py-1 rounded-lg border border-slate-300 bg-white font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block">
                      Presión (bar)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="8"
                      value={tire.pressureBar}
                      onChange={(e) =>
                        handleTireChange(tire.position, 'pressureBar', e.target.value)
                      }
                      className="w-full mt-0.5 px-2 py-1 rounded-lg border border-slate-300 bg-white font-bold text-slate-900"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Doble Batería */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BatteryCharging className="w-4 h-4 text-blue-600" />
            <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide">
              Doble Batería (Motor + Célula Sanitaria)
            </h4>
          </div>
          <span className="text-[10px] font-bold text-slate-500">
            Últ. rev: {currentBatteries.lastCheckDate}
          </span>
        </div>

        <div className="space-y-3 text-xs">
          {/* Arranque */}
          <div
            className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
              currentBatteries.starterStatus === 'OK'
                ? 'bg-slate-50 border-slate-200'
                : 'bg-rose-50 border-rose-300'
            }`}
          >
            <div>
              <p className="font-extrabold text-slate-900">Batería de Arranque (Motor)</p>
              <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                {currentBatteries.starterStatus === 'OK' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                )}
                Estado: <strong>{currentBatteries.starterStatus}</strong>
              </p>
            </div>
            <div className="w-28">
              <label className="text-[10px] font-bold text-slate-500 block">
                Tensión (V)
              </label>
              <input
                type="number"
                step="0.1"
                min="9"
                max="15"
                value={currentBatteries.starterVoltage}
                onChange={(e) =>
                  handleBatteryVoltage('starterVoltage', e.target.value)
                }
                className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-extrabold text-slate-900"
              />
            </div>
          </div>

          {/* Auxiliar AGM */}
          <div
            className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
              currentBatteries.auxStatus === 'OK'
                ? 'bg-blue-50/50 border-blue-200'
                : 'bg-rose-50 border-rose-300'
            }`}
          >
            <div>
              <p className="font-extrabold text-slate-900">
                Batería Auxiliar Célula Sanitaria
              </p>
              <p className="text-[11px] text-slate-600">{currentBatteries.auxType}</p>
              <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                {currentBatteries.auxStatus === 'OK' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                )}
                Estado: <strong>{currentBatteries.auxStatus}</strong>
              </p>
            </div>
            <div className="w-28">
              <label className="text-[10px] font-bold text-slate-500 block">
                Tensión (V)
              </label>
              <input
                type="number"
                step="0.1"
                min="9"
                max="15"
                value={currentBatteries.auxVoltage}
                onChange={(e) =>
                  handleBatteryVoltage('auxVoltage', e.target.value)
                }
                className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-extrabold text-slate-900"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
