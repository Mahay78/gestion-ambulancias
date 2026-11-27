import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import {
  Auth,
  User,
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  setDoc,
} from 'firebase/firestore';

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

export const FLEET_COLLECTION_KEYS = [
  'ambulances',
  'workshops',
  'preventiveSchedules',
  'checklists',
  'workOrders',
  'spareParts',
  'stockMovements',
] as const;

export type FleetCollectionKey = (typeof FLEET_COLLECTION_KEYS)[number];

// Identificador único de esta pestaña/dispositivo para evitar eco en onSnapshot
export const LOCAL_CLIENT_ID =
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

let cachedApp: FirebaseApp | null = null;
let cachedDb: Firestore | null = null;
let cachedAuth: Auth | null = null;

export const getFirebaseServices = (
  projectId = DEFAULT_FIREBASE_CONFIG.projectId,
  apiKey = DEFAULT_FIREBASE_CONFIG.apiKey
): { app: FirebaseApp; db: Firestore; auth: Auth } => {
  const existing = getApps().find((a) => a.name === `ambufleet-${projectId}`);
  if (existing && cachedApp === existing && cachedDb && cachedAuth) {
    return { app: cachedApp, db: cachedDb, auth: cachedAuth };
  }

  const app =
    existing ||
    initializeApp(
      {
        ...DEFAULT_FIREBASE_CONFIG,
        projectId,
        apiKey,
      },
      `ambufleet-${projectId}`
    );

  let db: Firestore;
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    db = getFirestore(app);
  }

  const auth = getAuth(app);
  cachedApp = app;
  cachedDb = db;
  cachedAuth = auth;
  return { app, db, auth };
};

export const signInFirebaseWithEmail = async (
  email: string,
  password: string,
  projectId = DEFAULT_FIREBASE_CONFIG.projectId,
  apiKey = DEFAULT_FIREBASE_CONFIG.apiKey
): Promise<{ ok: boolean; user?: User; error?: string }> => {
  try {
    const { auth } = getFirebaseServices(projectId, apiKey);
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    return { ok: true, user: cred.user };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : 'Error al autenticar con Firebase Auth.',
    };
  }
};

export const ensureFirebaseAuthSession = async (
  projectId = DEFAULT_FIREBASE_CONFIG.projectId,
  apiKey = DEFAULT_FIREBASE_CONFIG.apiKey
): Promise<{ ok: boolean; user?: User; error?: string }> => {
  try {
    const { auth } = getFirebaseServices(projectId, apiKey);
    if (auth.currentUser) {
      return { ok: true, user: auth.currentUser };
    }
    const cred = await signInAnonymously(auth);
    return { ok: true, user: cred.user };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : 'Activa Autenticación Anónima o Email/Contraseña en Firebase Console.',
    };
  }
};

export const signOutFirebase = async (
  projectId = DEFAULT_FIREBASE_CONFIG.projectId,
  apiKey = DEFAULT_FIREBASE_CONFIG.apiKey
): Promise<void> => {
  try {
    const { auth } = getFirebaseServices(projectId, apiKey);
    if (auth.currentUser) {
      await signOut(auth);
    }
  } catch {
    // ignorar
  }
};

export const onFirebaseAuthChanged = (
  cb: (user: User | null) => void,
  projectId = DEFAULT_FIREBASE_CONFIG.projectId,
  apiKey = DEFAULT_FIREBASE_CONFIG.apiKey
): (() => void) => {
  const { auth } = getFirebaseServices(projectId, apiKey);
  return onAuthStateChanged(auth, cb);
};

/**
 * Sube el estado dividido en documentos independientes dentro de `ambufleet_sync`
 * para evitar el límite de 1 MB de un único documento y permitir sincronización granular.
 */
export const pushFleetStateToFirebase = async (
  payload: FirebaseFleetPayload,
  projectId = DEFAULT_FIREBASE_CONFIG.projectId,
  apiKey = DEFAULT_FIREBASE_CONFIG.apiKey
): Promise<{ ok: boolean; timestamp: string; error?: string }> => {
  try {
    const { db } = getFirebaseServices(projectId, apiKey);
    await ensureFirebaseAuthSession(projectId, apiKey);

    await Promise.all(
      FLEET_COLLECTION_KEYS.map((key) =>
        setDoc(doc(db, 'ambufleet_sync', key), {
          items: payload[key],
          updatedAt: payload.updatedAt,
          updatedByRole: payload.updatedByRole,
          clientId: LOCAL_CLIENT_ID,
        })
      )
    );

    await setDoc(doc(db, 'ambufleet_sync', 'meta'), {
      updatedAt: payload.updatedAt,
      updatedByRole: payload.updatedByRole,
      clientId: LOCAL_CLIENT_ID,
      schemaVersion: 2,
    });

    return { ok: true, timestamp: payload.updatedAt };
  } catch (err) {
    return {
      ok: false,
      timestamp: payload.updatedAt,
      error:
        err instanceof Error
          ? err.message
          : 'Error al sincronizar con Cloud Firestore.',
    };
  }
};

/**
 * Descarga las colecciones desde `ambufleet_sync/*` (con fallback al documento legacy `fleet_state`).
 */
export const pullFleetStateFromFirebase = async (
  projectId = DEFAULT_FIREBASE_CONFIG.projectId,
  apiKey = DEFAULT_FIREBASE_CONFIG.apiKey
): Promise<{
  ok: boolean;
  data?: FirebaseFleetPayload;
  error?: string;
}> => {
  try {
    const { db } = getFirebaseServices(projectId, apiKey);
    await ensureFirebaseAuthSession(projectId, apiKey);

    const snap = await getDocs(collection(db, 'ambufleet_sync'));
    const docsMap = new Map<string, Record<string, unknown>>();
    snap.forEach((d) => docsMap.set(d.id, d.data() as Record<string, unknown>));

    if (docsMap.has('ambulances')) {
      const meta = docsMap.get('meta') || {};
      const payload: FirebaseFleetPayload = {
        updatedAt: String(meta.updatedAt || new Date().toISOString()),
        updatedByRole: String(meta.updatedByRole || 'Encargado'),
        ambulances: (docsMap.get('ambulances')?.items as unknown[]) || [],
        workshops: (docsMap.get('workshops')?.items as unknown[]) || [],
        preventiveSchedules:
          (docsMap.get('preventiveSchedules')?.items as unknown[]) || [],
        checklists: (docsMap.get('checklists')?.items as unknown[]) || [],
        workOrders: (docsMap.get('workOrders')?.items as unknown[]) || [],
        spareParts: (docsMap.get('spareParts')?.items as unknown[]) || [],
        stockMovements:
          (docsMap.get('stockMovements')?.items as unknown[]) || [],
      };
      return { ok: true, data: payload };
    }

    // Fallback a documento legacy `fleet_state`
    const legacySnap = await getDoc(doc(db, 'ambufleet_sync', 'fleet_state'));
    if (legacySnap.exists()) {
      const rawJson = legacySnap.data()?.jsonPayload;
      if (typeof rawJson === 'string') {
        const parsed = JSON.parse(rawJson) as FirebaseFleetPayload;
        return { ok: true, data: parsed };
      }
    }

    return {
      ok: false,
      error:
        'Aún no hay datos guardados en la nube de Firebase. Pulsa "Subir Datos Actuales a Firebase" para inicializarla.',
    };
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

/**
 * Suscripción en tiempo real (onSnapshot) a cambios remotos en `ambufleet_sync`.
 */
export const subscribeFleetRealtime = (
  onRemoteUpdate: (data: Partial<FirebaseFleetPayload>, updatedAt: string) => void,
  onError?: (err: string) => void,
  projectId = DEFAULT_FIREBASE_CONFIG.projectId,
  apiKey = DEFAULT_FIREBASE_CONFIG.apiKey
): (() => void) => {
  const { db } = getFirebaseServices(projectId, apiKey);
  const colRef = collection(db, 'ambufleet_sync');

  return onSnapshot(
    colRef,
    (snapshot) => {
      if (snapshot.empty) return;
      const partial: Partial<FirebaseFleetPayload> = {};
      let hasRemoteChange = false;
      let latestUpdatedAt = '';

      snapshot.forEach((docSnap) => {
        const id = docSnap.id;
        const data = docSnap.data() as Record<string, unknown>;
        if (data.clientId === LOCAL_CLIENT_ID) return;

        if ((FLEET_COLLECTION_KEYS as readonly string[]).includes(id)) {
          const key = id as FleetCollectionKey;
          if (Array.isArray(data.items)) {
            partial[key] = data.items;
            hasRemoteChange = true;
            if (typeof data.updatedAt === 'string' && data.updatedAt > latestUpdatedAt) {
              latestUpdatedAt = data.updatedAt;
            }
          }
        }
      });

      if (hasRemoteChange) {
        onRemoteUpdate(partial, latestUpdatedAt || new Date().toISOString());
      }
    },
    (error) => {
      if (onError) {
        onError(error.message || 'Error en suscripción en tiempo real de Firestore.');
      }
    }
  );
};
