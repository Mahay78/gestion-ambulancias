export const STORAGE_KEY = 'ambufleet_mechanics_v1';
const AUTO_BACKUP_KEY = `${STORAGE_KEY}_auto_backup_snapshot`;
const MAX_LOCAL_STORAGE_BYTES = 5 * 1024 * 1024; // ~5 MB estándar en navegadores

export interface AutoBackupSnapshot<T = Record<string, unknown>> {
  version: number;
  timestamp: string;
  reason: string;
  payload: T;
}

export interface StorageUsageStats {
  usedBytes: number;
  maxBytes: number;
  usagePercent: number;
  isWarning: boolean; // >= 70%
  isCritical: boolean; // >= 85%
}

export interface CloudSyncConfig {
  enabled: boolean;
  provider: 'firebase' | 'supabase';
  firebaseProjectId: string;
  firebaseApiKey: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  lastSyncedAt?: string;
}

export const getStorageUsageStats = (): StorageUsageStats => {
  try {
    let totalChars = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) {
        const v = localStorage.getItem(k) || '';
        totalChars += k.length + v.length;
      }
    }
    // UTF-16 aproximado en bytes
    const usedBytes = totalChars * 2;
    const usagePercent = Math.min(
      100,
      Math.round((usedBytes / MAX_LOCAL_STORAGE_BYTES) * 100)
    );
    return {
      usedBytes,
      maxBytes: MAX_LOCAL_STORAGE_BYTES,
      usagePercent,
      isWarning: usagePercent >= 70,
      isCritical: usagePercent >= 85,
    };
  } catch {
    return {
      usedBytes: 0,
      maxBytes: MAX_LOCAL_STORAGE_BYTES,
      usagePercent: 0,
      isWarning: false,
      isCritical: false,
    };
  }
};

export const safeLoadFromStorage = <T,>(key: string, fallback: T): T => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? (JSON.parse(saved) as T) : fallback;
  } catch {
    return fallback;
  }
};

export const safeSaveToStorage = (
  key: string,
  value: unknown,
  onQuotaExceeded?: () => void
): boolean => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    console.warn(
      `[AmbuFleet] Cuota de almacenamiento local alcanzada al guardar ${key}.`
    );
    if (onQuotaExceeded) onQuotaExceeded();
    return false;
  }
};

export const saveAutoBackupSnapshot = <T,>(payload: T, reason = 'Guardado automático'): void => {
  try {
    const snapshot: AutoBackupSnapshot<T> = {
      version: 2,
      timestamp: new Date().toISOString(),
      reason,
      payload,
    };
    localStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify(snapshot));
  } catch {
    // Si la cuota está al límite, no sobrescribimos el snapshot existente con un error
  }
};

export const loadAutoBackupSnapshot = <T,>(): AutoBackupSnapshot<T> | null => {
  try {
    const raw = localStorage.getItem(AUTO_BACKUP_KEY);
    return raw ? (JSON.parse(raw) as AutoBackupSnapshot<T>) : null;
  } catch {
    return null;
  }
};

export const getCloudSyncConfig = (): CloudSyncConfig => {
  const envUrl = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_SUPABASE_URL || '';
  const envKey = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_SUPABASE_ANON_KEY || '';
  const saved = safeLoadFromStorage<Partial<CloudSyncConfig>>(
    `${STORAGE_KEY}_cloud_sync`,
    {}
  );
  return {
    enabled: saved.enabled ?? true,
    provider: saved.provider || 'firebase',
    firebaseProjectId: saved.firebaseProjectId || 'gestion-ambulancias-flota',
    firebaseApiKey:
      saved.firebaseApiKey || 'AIzaSyCULiQnlrBZqqcB7D_WrA9LyayoHZMh9zU',
    supabaseUrl: saved.supabaseUrl || envUrl,
    supabaseAnonKey: saved.supabaseAnonKey || envKey,
    lastSyncedAt: saved.lastSyncedAt,
  };
};

export const saveCloudSyncConfig = (config: CloudSyncConfig): void => {
  safeSaveToStorage(`${STORAGE_KEY}_cloud_sync`, config);
};

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};
