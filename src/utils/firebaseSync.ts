export const DEFAULT_FIREBASE_CONFIG = {
  projectId: 'gestion-ambulancias-flota',
  appId: '1:201020766723:web:c227815d7a87b4fba32c36',
  storageBucket: 'gestion-ambulancias-flota.firebasestorage.app',
  apiKey: 'AIzaSyCULiQnlrBZqqcB7D_WrA9LyayoHZMh9zU',
  authDomain: 'gestion-ambulancias-flota.firebaseapp.com',
  messagingSenderId: '201020766723',
  hostingUrl: 'https://gestion-ambulancias-flota.web.app',
};

export interface FirebaseFleetPayload {
  updatedAt: string;
  updatedByRole: string;
  ambulances: unknown[];
  workshops: unknown[];
  preventiveSchedules: unknown[];
  checklists: unknown[];
  workOrders: unknown[];
  spareParts: unknown[];
  stockMovements: unknown[];
}

const getFirestoreDocumentUrl = (projectId: string, apiKey: string): string => {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    projectId
  )}/databases/(default)/documents/ambufleet_sync/fleet_state?key=${encodeURIComponent(
    apiKey
  )}`;
};

export const pushFleetStateToFirebase = async (
  payload: FirebaseFleetPayload,
  projectId = DEFAULT_FIREBASE_CONFIG.projectId,
  apiKey = DEFAULT_FIREBASE_CONFIG.apiKey
): Promise<{ ok: boolean; timestamp: string; error?: string }> => {
  try {
    const url = getFirestoreDocumentUrl(projectId, apiKey);
    const body = {
      fields: {
        updatedAt: { stringValue: payload.updatedAt },
        updatedByRole: { stringValue: payload.updatedByRole },
        jsonPayload: { stringValue: JSON.stringify(payload) },
      },
    };

    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const msg =
        errData?.error?.message ||
        `HTTP ${res.status}: Activa Cloud Firestore en la consola de Firebase (Compilación -> Firestore Database -> Crear base de datos).`;
      return { ok: false, timestamp: payload.updatedAt, error: msg };
    }

    return { ok: true, timestamp: payload.updatedAt };
  } catch (err) {
    return {
      ok: false,
      timestamp: payload.updatedAt,
      error:
        err instanceof Error
          ? err.message
          : 'Sin conexión a internet para sincronizar con Firebase.',
    };
  }
};

export const pullFleetStateFromFirebase = async (
  projectId = DEFAULT_FIREBASE_CONFIG.projectId,
  apiKey = DEFAULT_FIREBASE_CONFIG.apiKey
): Promise<{
  ok: boolean;
  data?: FirebaseFleetPayload;
  error?: string;
}> => {
  try {
    const url = getFirestoreDocumentUrl(projectId, apiKey);
    const res = await fetch(url, { method: 'GET' });

    if (res.status === 404) {
      return {
        ok: false,
        error:
          'Aún no hay datos guardados en la nube de Firebase. Pulsa "Subir Datos Actuales a Firebase" para inicializarla.',
      };
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const msg =
        errData?.error?.message ||
        `HTTP ${res.status}: Verifica que Firestore esté habilitado en el proyecto ${projectId}.`;
      return { ok: false, error: msg };
    }

    const doc = await res.json();
    const rawJson = doc?.fields?.jsonPayload?.stringValue;
    if (!rawJson) {
      return { ok: false, error: 'El documento en Firebase está vacío.' };
    }

    const parsed = JSON.parse(rawJson) as FirebaseFleetPayload;
    return { ok: true, data: parsed };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : 'Error de red al conectar con Firebase.',
    };
  }
};
