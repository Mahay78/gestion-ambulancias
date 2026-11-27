import { STORAGE_KEY } from './storage';

const DRIVE_WEBHOOK_KEY = `${STORAGE_KEY}_gdrive_webhook_url`;

export const getDriveWebhookUrl = (): string => {
  try {
    return localStorage.getItem(DRIVE_WEBHOOK_KEY) || '';
  } catch {
    return '';
  }
};

export const saveDriveWebhookUrl = (url: string): void => {
  try {
    const clean = url.trim();
    if (clean) {
      localStorage.setItem(DRIVE_WEBHOOK_KEY, clean);
    } else {
      localStorage.removeItem(DRIVE_WEBHOOK_KEY);
    }
  } catch {
    // ignorar
  }
};

export interface DriveUploadResult {
  ok: boolean;
  fileUrl?: string;
  fileId?: string;
  error?: string;
}

/**
 * Sube un archivo (foto base64, PDF base64 o JSON) al Google Drive de flotaambulz@gmail.com
 * mediante Google Apps Script (usa text/plain para evitar preflight CORS en navegador).
 */
export const uploadToGoogleDrive = async (params: {
  fileName: string;
  mimeType: string;
  base64Content: string;
  subfolder?: string;
}): Promise<DriveUploadResult> => {
  const webhookUrl = getDriveWebhookUrl();
  if (!webhookUrl) {
    return {
      ok: false,
      error: 'Configura primero la URL del Web App de Google Apps Script en Backup.',
    };
  }

  try {
    const cleanBase64 = params.base64Content.includes(',')
      ? params.base64Content.split(',')[1]
      : params.base64Content;

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        fileName: params.fileName,
        mimeType: params.mimeType,
        base64: cleanBase64,
        subfolder: params.subfolder || 'General',
      }),
    });

    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status} al subir a Google Drive.` };
    }

    const data = (await res.json()) as {
      ok?: boolean;
      fileUrl?: string;
      fileId?: string;
      error?: string;
    };
    if (data.ok) {
      return { ok: true, fileUrl: data.fileUrl, fileId: data.fileId };
    }
    return { ok: false, error: data.error || 'Error en Google Apps Script.' };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : 'Error de red al conectar con Google Drive.',
    };
  }
};

export const backupFleetJsonToGoogleDrive = async (
  payload: Record<string, unknown>,
  dateStr: string
): Promise<DriveUploadResult> => {
  const jsonString = JSON.stringify(payload, null, 2);
  const bytes = new TextEncoder().encode(jsonString);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);

  return uploadToGoogleDrive({
    fileName: `ambu-lzflota_backup_${dateStr}.json`,
    mimeType: 'application/json',
    base64Content: base64,
    subfolder: 'Backups',
  });
};
