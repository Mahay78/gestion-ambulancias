import { Ambulance } from '../types';
import { collectAllDocumentAlerts } from './expiryAlerts';
import { STORAGE_KEY } from './storage';

const LAST_NOTIFY_DATE_KEY = `${STORAGE_KEY}_last_expiry_notify_date`;

export const isNotificationSupported = (): boolean => {
  return typeof window !== 'undefined' && 'Notification' in window;
};

export const getNotificationPermission = (): NotificationPermission | 'unsupported' => {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
};

export const requestNotificationPermission = async (): Promise<NotificationPermission | 'unsupported'> => {
  if (!isNotificationSupported()) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
};

export const showLocalNotification = async (
  title: string,
  body: string,
  tag = 'ambufleet-expiry-alert'
): Promise<boolean> => {
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return false;
  }
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, {
          body,
          icon: './icon.svg',
          badge: './icon.svg',
          tag,
        });
        return true;
      }
    }
    new Notification(title, {
      body,
      icon: './icon.svg',
      tag,
    });
    return true;
  } catch {
    return false;
  }
};

/**
 * Envía una notificación local PWA (como máximo 1 vez al día de forma automática,
 * o siempre si force=true) cuando hay documentos en <=15 días, <=7 días o vencidos.
 */
export const checkAndNotifyCriticalExpiries = async (
  ambulances: Ambulance[],
  force = false
): Promise<{ sent: boolean; criticalCount: number; summary: string }> => {
  const alerts = collectAllDocumentAlerts(ambulances);
  const critical = alerts.filter(
    (a) => a.level === 'expired' || a.level === 'days7' || a.level === 'days15'
  );

  if (critical.length === 0) {
    return {
      sent: false,
      criticalCount: 0,
      summary: 'Todos los documentos están fuera de la franja crítica (≤ 15 días).',
    };
  }

  const todayStr = new Date().toISOString().split('T')[0];
  try {
    if (!force && localStorage.getItem(LAST_NOTIFY_DATE_KEY) === todayStr) {
      return {
        sent: false,
        criticalCount: critical.length,
        summary: 'Ya se mostró el aviso diario hoy.',
      };
    }
  } catch {
    // ignorar error de localStorage
  }

  const expiredCount = critical.filter((a) => a.level === 'expired').length;
  const days7Count = critical.filter((a) => a.level === 'days7').length;
  const days15Count = critical.filter((a) => a.level === 'days15').length;

  const topPreview = critical
    .slice(0, 3)
    .map((a) => `${a.ambulanceCode} (${a.document.type})`)
    .join(', ');

  const title = `Ambu-lz: ${critical.length} vencimiento(s) crítico(s)`;
  const body = `Vencidos: ${expiredCount} | ≤7d: ${days7Count} | ≤15d: ${days15Count}. Revisa: ${topPreview}${critical.length > 3 ? '...' : ''}`;

  const sent = await showLocalNotification(title, body);
  if (sent) {
    try {
      localStorage.setItem(LAST_NOTIFY_DATE_KEY, todayStr);
    } catch {
      // ignorar
    }
  }

  return { sent, criticalCount: critical.length, summary: body };
};
