/**
 * Alarma sonora y vibración sin archivos externos (Web Audio API)
 * para avisar inmediatamente cuando llegan partes desde las unidades.
 */

let sharedAudioCtx: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new Ctx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
};

export const playIncomingUnitAlarm = (isUrgent = false): void => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Tono urgente: 3 pitidos rápidos agudos; tono normal: 2 pitidos bitonales suaves
    const pattern = isUrgent
      ? [
          { start: 0, dur: 0.16, freq: 980 },
          { start: 0.22, dur: 0.16, freq: 1180 },
          { start: 0.44, dur: 0.22, freq: 980 },
          { start: 0.72, dur: 0.22, freq: 1180 },
        ]
      : [
          { start: 0, dur: 0.15, freq: 660 },
          { start: 0.2, dur: 0.22, freq: 880 },
        ];

    pattern.forEach(({ start, dur, freq }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = isUrgent ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now + start);

      gain.gain.setValueAtTime(0.001, now + start);
      gain.gain.exponentialRampToValueAtTime(0.28, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.02);
    });
  } catch {
    // El navegador puede bloquear audio antes de interacción del usuario
  }
};

export const vibrateMobileAlarm = (isUrgent = false): void => {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(isUrgent ? [300, 120, 300, 120, 400] : [220, 100, 220]);
    }
  } catch {
    // Ignorar en dispositivos sin soporte
  }
};
