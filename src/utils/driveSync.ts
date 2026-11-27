import { STORAGE_KEY } from './storage';

const DRIVE_WEBHOOK_KEY = `${STORAGE_KEY}_gdrive_webhook_url`;
const DRIVE_FOLDER_URL_KEY = `${STORAGE_KEY}_gdrive_root_folder_url`;
const DRIVE_SECRET_TOKEN_KEY = `${STORAGE_KEY}_gdrive_secret_token`;
export const DEFAULT_DRIVE_WEBHOOK_URL =
  'https://script.google.com/macros/s/AKfycbzYi-86Y8JoWRCAAqr_54iXAODd-fhoIb3BWT2NhtYwemYIpyk9Cqb-loFr9V72VledSA/exec';

export const getDriveSecretToken = (): string => {
  try {
    return localStorage.getItem(DRIVE_SECRET_TOKEN_KEY) || '';
  } catch {
    return '';
  }
};

export const saveDriveSecretToken = (token: string): void => {
  try {
    const clean = token.trim();
    if (clean) {
      localStorage.setItem(DRIVE_SECRET_TOKEN_KEY, clean);
    } else {
      localStorage.removeItem(DRIVE_SECRET_TOKEN_KEY);
    }
  } catch {
    // ignorar
  }
};

export const getSavedDriveFolderUrl = (): string => {
  try {
    return (
      localStorage.getItem(DRIVE_FOLDER_URL_KEY) ||
      'https://drive.google.com/drive/search?q=Ambu-lzflota'
    );
  } catch {
    return 'https://drive.google.com/drive/search?q=Ambu-lzflota';
  }
};

const saveDriveFolderUrl = (url?: string): void => {
  if (!url) return;
  try {
    localStorage.setItem(DRIVE_FOLDER_URL_KEY, url);
  } catch {
    // ignorar
  }
};

export const getDriveWebhookUrl = (): string => {
  try {
    return localStorage.getItem(DRIVE_WEBHOOK_KEY) || DEFAULT_DRIVE_WEBHOOK_URL;
  } catch {
    return DEFAULT_DRIVE_WEBHOOK_URL;
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
        token: getDriveSecretToken(),
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
      rootFolderUrl?: string;
      error?: string;
    };
    if (data.rootFolderUrl) {
      saveDriveFolderUrl(data.rootFolderUrl);
    }
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

export const uploadDataUrlToUnitFolder = (
  unitFolderName: string,
  fileName: string,
  dataUrl: string
): void => {
  if (!dataUrl || !dataUrl.startsWith('data:')) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  const mimeMatch = dataUrl.match(/^data:([^;]+);base64,/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';

  void uploadToGoogleDrive({
    fileName,
    mimeType,
    base64Content: dataUrl,
    subfolder: unitFolderName,
  });
};

export const sendEmailViaLinkedGmail = async (params: {
  to: string;
  subject: string;
  body: string;
  htmlBody?: string;
}): Promise<{ ok: boolean; sentFrom?: string; error?: string }> => {
  const webhookUrl = getDriveWebhookUrl();
  if (!webhookUrl) {
    return { ok: false, error: 'No hay URL de Google Apps Script configurada.' };
  }
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        token: getDriveSecretToken(),
        action: 'send_email',
        to: params.to.trim(),
        subject: params.subject,
        body: params.body,
        htmlBody: params.htmlBody,
      }),
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status} al enviar correo.` };
    }
    const data = (await res.json()) as {
      ok?: boolean;
      sentFrom?: string;
      rootFolderUrl?: string;
      error?: string;
    };
    if (data.rootFolderUrl) {
      saveDriveFolderUrl(data.rootFolderUrl);
    }
    if (data.ok) {
      return { ok: true, sentFrom: data.sentFrom || 'flotaambulz@gmail.com' };
    }
    return { ok: false, error: data.error || 'Error enviando el correo desde Apps Script.' };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : 'Error de red al conectar con flotaambulz@gmail.com.',
    };
  }
};

export const openGoogleDriveFolder = async (): Promise<void> => {
  const cached = getSavedDriveFolderUrl();
  const win = window.open(cached, '_blank', 'noopener,noreferrer');
  const webhookUrl = getDriveWebhookUrl();
  if (!webhookUrl) return;
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token: getDriveSecretToken(), action: 'get_folder' }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { ok?: boolean; rootFolderUrl?: string };
    if (data.ok && data.rootFolderUrl) {
      saveDriveFolderUrl(data.rootFolderUrl);
      if (win && data.rootFolderUrl !== cached) {
        win.location.href = data.rootFolderUrl;
      }
    }
  } catch {
    // ignorar
  }
};

export const appendClosedReportToGoogleSheet = async (record: {
  id: string;
  closedAt: string;
  reportDate: string;
  ambulanceCode: string;
  plate: string;
  mileage: number;
  urgency: string;
  reporterName: string;
  closedBy: string;
  closureType: string;
  linkedWorkOrderCode?: string;
  workshopName?: string;
  summary: string;
  anomalies: string[];
  resolution: string;
}): Promise<{ ok: boolean; sheetUrl?: string; error?: string }> => {
  const webhookUrl = getDriveWebhookUrl();
  if (!webhookUrl) {
    return { ok: false, error: 'Webhook de Google Drive no configurado.' };
  }
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'append_closed_report',
        record,
      }),
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status} al registrar en Google Sheets.` };
    }
    const data = (await res.json()) as {
      ok?: boolean;
      sheetUrl?: string;
      error?: string;
    };
    return { ok: Boolean(data.ok), sheetUrl: data.sheetUrl, error: data.error };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Error de red con Google Sheets.',
    };
  }
};
