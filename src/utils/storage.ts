import {
  estimateBrowserStorageQuota,
  idbGet,
  idbSet,
} from './indexedDbStorage';

export const STORAGE_KEY = 'ambufleet_mechanics_v1';
export const AUTO_BACKUP_KEY = `${STORAGE_KEY}_auto_backup_snapshot`;
const MAX_LOCAL_STORAGE_BYTES = 5 * 1024 * 1024; // ~5 MB fallback en localStorage; IndexedDB amplía a cientos de MB/GB

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

export const getStorageUsageStatsAsync = async (): Promise<StorageUsageStats> => {
  const est = await estimateBrowserStorageQuota();
  if (est && est.quotaBytes > MAX_LOCAL_STORAGE_BYTES) {
    return {
      usedBytes: est.usedBytes,
      maxBytes: est.quotaBytes,
      usagePercent: est.usagePercent,
      isWarning: est.usagePercent >= 75,
      isCritical: est.usagePercent >= 90,
    };
  }
  return getStorageUsageStats();
};

export const safeLoadFromStorage = <T,>(key: string, fallback: T): T => {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return fallback;
    const parsed = JSON.parse(saved);
    if (Array.isArray(fallback)) {
      if (!Array.isArray(parsed)) return fallback;
      return parsed.filter((item) => item && typeof item === 'object') as T;
    }
    if (fallback !== null && typeof fallback === 'object') {
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return fallback;
      }
    }
    return parsed as T;
  } catch {
    return fallback;
  }
};

export const safeSaveToStorage = (
  key: string,
  value: unknown,
  onQuotaExceeded?: () => void
): boolean => {
  // Guardar siempre en IndexedDB (alta capacidad: cientos de MB / GB)
  idbSet(key, value).then((ok) => {
    if (!ok && onQuotaExceeded) {
      onQuotaExceeded();
    }
  });

  // Espejo síncrono en localStorage mientras quepa en sus 5 MB
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // Si localStorage llena sus 5 MB, IndexedDB sigue guardando todo sin perder datos
    return true;
  }
};

export const saveAutoBackupSnapshot = <T,>(payload: T, reason = 'Guardado automático'): void => {
  const snapshot: AutoBackupSnapshot<T> = {
    version: 2,
    timestamp: new Date().toISOString(),
    reason,
    payload,
  };
  void idbSet(AUTO_BACKUP_KEY, snapshot);
  try {
    localStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify(snapshot));
  } catch {
    // IndexedDB ya almacenó el snapshot aunque localStorage esté al límite
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

export const loadAutoBackupSnapshotAsync = async <T,>(): Promise<AutoBackupSnapshot<T> | null> => {
  const fromIdb = await idbGet<AutoBackupSnapshot<T>>(AUTO_BACKUP_KEY);
  if (fromIdb) return fromIdb;
  return loadAutoBackupSnapshot<T>();
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
