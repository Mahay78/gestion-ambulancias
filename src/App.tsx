import React, { useState, useEffect, useRef } from 'react';
import {
  Ambulance,
  AmbulanceStatus,
  ExternalWorkshop,
  FleetChecklist,
  PreventiveSchedule,
  SparePart,
  StockMovement,
  StockMovementType,
  UserRole,
  VehicleDocument,
  WorkOrder,
  WorkOrderStatus,
} from './types';
import {
  INITIAL_AMBULANCES,
  INITIAL_CHECKLISTS,
  INITIAL_EXTERNAL_WORKSHOPS,
  INITIAL_PREVENTIVE_SCHEDULES,
  INITIAL_SPARE_PARTS,
  INITIAL_STOCK_MOVEMENTS,
  INITIAL_WORK_ORDERS,
} from './initialData';
import { DashboardView } from './components/DashboardView';
import { FleetView } from './components/FleetView';
import { PreventiveView } from './components/PreventiveView';
import { ChecklistView } from './components/ChecklistView';
import { WorkOrdersView } from './components/WorkOrdersView';
import { WorkshopsView } from './components/WorkshopsView';
import { PartsInventoryView } from './components/PartsInventoryView';
import { exportFleetAndStockToCSV } from './utils/shareAndPrint';
import {
  STORAGE_KEY,
  safeLoadFromStorage,
  safeSaveToStorage,
  getStorageUsageStats,
  getStorageUsageStatsAsync,
  saveAutoBackupSnapshot,
  loadAutoBackupSnapshotAsync,
  getCloudSyncConfig,
  saveCloudSyncConfig,
  formatBytes,
} from './utils/storage';
import {
  idbGet,
  requestPersistentStorage,
} from './utils/indexedDbStorage';
import {
  DEFAULT_FIREBASE_CONFIG,
  FleetCollectionKey,
  UnitBreakdownReport,
  pushFleetStateToFirebase,
  pullFleetStateFromFirebase,
  subscribeFleetRealtime,
  ensureFirebaseAuthSession,
  signInFirebaseWithEmail,
  signOutFirebase,
  publishPublicPlates,
  subscribePendingUnitReports,
  markUnitReportImported,
} from './utils/firebaseSync';
import { UnitReportView } from './components/UnitReportView';
import { addMonthsLocal, getLocalDateString } from './utils/dateUtils';
import {
  verifyLocalAccessPassword,
  verifyManagerPin,
  updateManagerPin,
} from './utils/security';
import { checkAndNotifyCriticalExpiries } from './utils/notifications';
import { ensureAmbulanceDocuments } from './utils/expiryAlerts';
import {
  LayoutDashboard,
  Truck,
  CalendarClock,
  ClipboardCheck,
  Wrench,
  Building2,
  Package,
  RotateCcw,
  Activity,
  Download,
  Upload,
  FileSpreadsheet,
  X,
  Wifi,
  WifiOff,
  HardDrive,
  AlertTriangle,
  History,
  Cloud,
  UserCheck,
  Lock,
  LogOut,
  Eye,
  EyeOff,
  Menu,
} from 'lucide-react';

type ActiveTab =
  | 'dashboard'
  | 'fleet'
  | 'preventive'
  | 'checklist'
  | 'workorders'
  | 'workshops'
  | 'parts';

const normalizeAmbulanceStatus = (st: string): AmbulanceStatus => {
  if (st === 'Disponible' || st === 'Activa') return 'Disponible';
  if (st === 'En taller' || st === 'En Taller') return 'En taller';
  return 'Fuera de servicio';
};

const normalizeWorkOrderStatus = (st: string): WorkOrderStatus => {
  if (st === 'Reportada' || st === 'Pendiente') return 'Reportada';
  if (st === 'Asignada' || st === 'En Diagnóstico' || st === 'Esperando Repuestos')
    return 'Asignada';
  if (st === 'En taller' || st === 'En Reparación') return 'En taller';
  if (st === 'Reparada') return 'Reparada';
  return 'Cerrada';
};

const hydrateAmbulancesWithFullFleet = (saved: Ambulance[]): Ambulance[] => {
  return saved.map((a) => ({
    ...a,
    status: normalizeAmbulanceStatus(a.status),
    documents: ensureAmbulanceDocuments(a),
  }));
};

const hydrateWorkOrders = (saved: WorkOrder[]): WorkOrder[] => {
  return saved.map((wo) => ({
    ...wo,
    code: wo.code.replace(/^OT-/, 'OR-'),
    workshopId: wo.workshopId || 'ws-1',
    status: normalizeWorkOrderStatus(wo.status),
    entryDate: wo.entryDate || wo.createdAt,
    workshopReport: wo.workshopReport || '',
    warranty: wo.warranty || '6 meses en reparación',
    partsUsed: (wo.partsUsed || []).map((p) => ({
      partId: p.partId,
      partName: p.partName,
      sku: p.sku,
      quantity: p.quantity,
      deductedFromStock: p.deductedFromStock,
    })),
  }));
};

const hydrateSpareParts = (saved: SparePart[]): SparePart[] => {
  return saved.map((sp) => ({
    id: sp.id,
    sku: sp.sku,
    name: sp.name,
    category: sp.category,
    compatibleModels: sp.compatibleModels,
    stockQuantity: sp.stockQuantity,
    minStockAlert: sp.minStockAlert,
    warehouseLocation: sp.warehouseLocation || 'Almacén Central',
    supplier: sp.supplier,
    supplierContact: sp.supplierContact || 'Contacto proveedor',
    isVehicleOnboardStandard: sp.isVehicleOnboardStandard,
  }));
};

const getNextWorkOrderCode = (existingOrders: WorkOrder[]): string => {
  const currentYear = new Date().getFullYear();
  const yearPrefix = `OR-${currentYear}-`;
  const maxNum = existingOrders.reduce((max, wo) => {
    if (!wo.code.startsWith(yearPrefix)) return max;
    const match = wo.code.match(/(\d+)$/);
    const num = match ? parseInt(match[1], 10) : 0;
    return num > max ? num : max;
  }, 0);
  return `${yearPrefix}${String(maxNum + 1).padStart(3, '0')}`;
};

const AUTH_SESSION_KEY = `${STORAGE_KEY}_authenticated`;

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return (
        sessionStorage.getItem(AUTH_SESSION_KEY) === 'true' ||
        localStorage.getItem(AUTH_SESSION_KEY) === 'true'
      );
    } catch {
      return false;
    }
  });
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberDevice, setRememberDevice] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string>('');
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [currentRole, setCurrentRole] = useState<UserRole>(() =>
    safeLoadFromStorage<UserRole>(`${STORAGE_KEY}_role`, 'Encargado')
  );
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [storageStats, setStorageStats] = useState(() => getStorageUsageStats());
  const [quotaAlert, setQuotaAlert] = useState<boolean>(false);
  const [cloudConfig, setCloudConfig] = useState(() => getCloudSyncConfig());
  const [firebaseStatusMsg, setFirebaseStatusMsg] = useState<string>('');
  const [isSyncingFirebase, setIsSyncingFirebase] = useState<boolean>(false);
  const [realtimeLive, setRealtimeLive] = useState<boolean>(false);
  const [qrSelectedAmbId, setQrSelectedAmbId] = useState<string | undefined>(undefined);
  const [showPinModal, setShowPinModal] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const [newPinInput, setNewPinInput] = useState<string>('');
  const [pinSavedMsg, setPinSavedMsg] = useState<string>('');
  const [useFirebaseEmailLogin, setUseFirebaseEmailLogin] = useState<boolean>(false);
  const [firebaseEmail, setFirebaseEmail] = useState<string>('');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [isUnitReportMode, setIsUnitReportMode] = useState<boolean>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('modo') === 'parte';
    } catch {
      return false;
    }
  });
  const isApplyingRemoteRef = useRef<boolean>(false);
  const hasHydratedRef = useRef<boolean>(false);
  const dirtyKeysRef = useRef<Set<FleetCollectionKey>>(new Set());
  const prevSyncSnapshotRef = useRef<{
    ambulances: Ambulance[];
    workshops: ExternalWorkshop[];
    preventiveSchedules: PreventiveSchedule[];
    checklists: FleetChecklist[];
    workOrders: WorkOrder[];
    spareParts: SparePart[];
    stockMovements: StockMovement[];
  } | null>(null);
  const [authFailedAttempts, setAuthFailedAttempts] = useState<number>(0);
  const [authLockUntil, setAuthLockUntil] = useState<number>(0);
  const [pinFailedAttempts, setPinFailedAttempts] = useState<number>(0);
  const [pinLockUntil, setPinLockUntil] = useState<number>(0);

  const [ambulances, setAmbulances] = useState<Ambulance[]>(() =>
    hydrateAmbulancesWithFullFleet(
      safeLoadFromStorage(`${STORAGE_KEY}_ambulances`, INITIAL_AMBULANCES)
    )
  );

  const [workshops, setWorkshops] = useState<ExternalWorkshop[]>(() =>
    safeLoadFromStorage(
      `${STORAGE_KEY}_workshops`,
      INITIAL_EXTERNAL_WORKSHOPS
    )
  );

  const [preventiveSchedules, setPreventiveSchedules] = useState<
    PreventiveSchedule[]
  >(() =>
    safeLoadFromStorage(
      `${STORAGE_KEY}_preventive`,
      INITIAL_PREVENTIVE_SCHEDULES
    )
  );

  const [checklists, setChecklists] = useState<FleetChecklist[]>(() =>
    safeLoadFromStorage(`${STORAGE_KEY}_checklists`, INITIAL_CHECKLISTS)
  );

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>(() =>
    hydrateWorkOrders(
      safeLoadFromStorage(`${STORAGE_KEY}_workorders`, INITIAL_WORK_ORDERS)
    )
  );

  const [spareParts, setSpareParts] = useState<SparePart[]>(() =>
    hydrateSpareParts(
      safeLoadFromStorage(`${STORAGE_KEY}_parts`, INITIAL_SPARE_PARTS)
    )
  );

  const [stockMovements, setStockMovements] = useState<StockMovement[]>(() =>
    safeLoadFromStorage(`${STORAGE_KEY}_movements`, INITIAL_STOCK_MOVEMENTS)
  );

  // Detector de estado Online / Offline (PWA)
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Deep link desde etiquetas QR (?amb=AMB-01)
  useEffect(() => {
    if (!isAuthenticated) return;
    const applyQrParam = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const ambCode = params.get('amb');
        if (ambCode) {
          const found = ambulances.find(
            (a) => a.code.toLowerCase() === ambCode.trim().toLowerCase()
          );
          if (found) {
            setQrSelectedAmbId(found.id);
            setActiveTab('fleet');
          }
        }
      } catch {
        // ignorar
      }
    };
    applyQrParam();
    window.addEventListener('popstate', applyQrParam);
    return () => window.removeEventListener('popstate', applyQrParam);
  }, [isAuthenticated, ambulances]);

  // Notificación diaria PWA si existen vencimientos críticos (<=15d, <=7d o vencidos)
  useEffect(() => {
    if (!isAuthenticated) return;
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      checkAndNotifyCriticalExpiries(ambulances, false);
    }
  }, [isAuthenticated, ambulances]);

  // Suscripción en tiempo real a Firestore (onSnapshot)
  useEffect(() => {
    if (!isAuthenticated || !cloudConfig.enabled || !isOnline) {
      setRealtimeLive(false);
      return;
    }

    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    const startRealtime = async () => {
      const pid =
        cloudConfig.firebaseProjectId || DEFAULT_FIREBASE_CONFIG.projectId;
      const key = cloudConfig.firebaseApiKey || DEFAULT_FIREBASE_CONFIG.apiKey;
      await ensureFirebaseAuthSession(pid, key);
      if (cancelled) return;

      unsubscribe = subscribeFleetRealtime(
        (partial, updatedAt) => {
          isApplyingRemoteRef.current = true;
          if (partial.ambulances) {
            setAmbulances(
              hydrateAmbulancesWithFullFleet(partial.ambulances as Ambulance[])
            );
          }
          if (partial.workshops) {
            setWorkshops(partial.workshops as ExternalWorkshop[]);
          }
          if (partial.preventiveSchedules) {
            setPreventiveSchedules(
              partial.preventiveSchedules as PreventiveSchedule[]
            );
          }
          if (partial.checklists) {
            setChecklists(partial.checklists as FleetChecklist[]);
          }
          if (partial.workOrders) {
            setWorkOrders(hydrateWorkOrders(partial.workOrders as WorkOrder[]));
          }
          if (partial.spareParts) {
            setSpareParts(hydrateSpareParts(partial.spareParts as SparePart[]));
          }
          if (partial.stockMovements) {
            setStockMovements(partial.stockMovements as StockMovement[]);
          }
          setRealtimeLive(true);
          setFirebaseStatusMsg(
            `🔄 Cambio remoto sincronizado (${new Date(updatedAt).toLocaleTimeString('es-ES')})`
          );
          queueMicrotask(() => {
            isApplyingRemoteRef.current = false;
          });
        },
        (err) => {
          setRealtimeLive(false);
          setFirebaseStatusMsg(`⚠️ Sync en tiempo real: ${err}`);
        },
        pid,
        key
      );
      setRealtimeLive(true);
    };

    startRealtime();

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [isAuthenticated, cloudConfig.enabled, cloudConfig.firebaseProjectId, cloudConfig.firebaseApiKey, isOnline]);

  // Escuchar partes rápidos enviados desde los móviles de las unidades (por matrícula)
  useEffect(() => {
    if (!isAuthenticated || !cloudConfig.enabled || !isOnline) return;
    const pid =
      cloudConfig.firebaseProjectId || DEFAULT_FIREBASE_CONFIG.projectId;
    const key = cloudConfig.firebaseApiKey || DEFAULT_FIREBASE_CONFIG.apiKey;

    const unsubReports = subscribePendingUnitReports(
      (reports: UnitBreakdownReport[]) => {
        setChecklists((prev) => {
          const existingIds = new Set(prev.map((c) => c.id));
          const incoming: FleetChecklist[] = [];
          for (const rep of reports) {
            if (existingIds.has(rep.id)) {
              markUnitReportImported(rep.id, pid, key);
              continue;
            }
            const matchedAmb =
              ambulances.find((a) => a.id === rep.ambulanceId) ||
              ambulances.find(
                (a) =>
                  a.plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() ===
                  rep.plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
              );

            incoming.push({
              id: rep.id,
              ambulanceId: matchedAmb?.id || ambulances[0]?.id || 'amb-1',
              date: rep.date || getLocalDateString(),
              inspectorName: `${rep.reporterName} (Unidad ${rep.plate})`,
              mileageAtInspection: rep.mileage || matchedAmb?.mileage || 0,
              overallUrgency: rep.urgency,
              items: [
                {
                  id: `unit-item-${rep.id}`,
                  section: 'Motor y Niveles',
                  label: `Avería reportada desde unidad (${rep.plate})`,
                  status: 'Avería',
                  comment: rep.description,
                },
              ],
              missingParts: [],
              generalObservations: `[PARTE UNIDAD • ${rep.plate}] ${rep.description}`,
              workshopStatus: 'Pendiente de Asignar Taller',
              photos: rep.photos || [],
            });
            markUnitReportImported(rep.id, pid, key);
          }
          if (incoming.length === 0) return prev;
          setFirebaseStatusMsg(
            `🚨 Recibido(s) ${incoming.length} parte(s) de avería desde unidad.`
          );
          return [...incoming, ...prev];
        });
      },
      pid,
      key
    );

    return () => unsubReports();
  }, [isAuthenticated, cloudConfig.enabled, cloudConfig.firebaseProjectId, cloudConfig.firebaseApiKey, isOnline, ambulances]);

  // Publicar catálogo mínimo de matrículas para el acceso rápido de unidades
  useEffect(() => {
    if (!isAuthenticated || !cloudConfig.enabled || !isOnline) return;
    const pid =
      cloudConfig.firebaseProjectId || DEFAULT_FIREBASE_CONFIG.projectId;
    const key = cloudConfig.firebaseApiKey || DEFAULT_FIREBASE_CONFIG.apiKey;
    publishPublicPlates(
      ambulances.map((a) => ({
        id: a.id,
        code: a.code,
        plate: a.plate,
        brand: a.brand,
        model: a.model,
        mileage: a.mileage,
      })),
      pid,
      key
    );
  }, [isAuthenticated, cloudConfig.enabled, cloudConfig.firebaseProjectId, cloudConfig.firebaseApiKey, isOnline, ambulances]);

  // Auto-push con debounce a Firebase solo para colecciones modificadas
  useEffect(() => {
    if (!prevSyncSnapshotRef.current) {
      prevSyncSnapshotRef.current = {
        ambulances,
        workshops,
        preventiveSchedules,
        checklists,
        workOrders,
        spareParts,
        stockMovements,
      };
    }

    if (!isAuthenticated || !cloudConfig.enabled || !isOnline) return;
    if (!hasHydratedRef.current) {
      hasHydratedRef.current = true;
      return;
    }

    const prevSnap = prevSyncSnapshotRef.current;
    if (isApplyingRemoteRef.current) {
      prevSyncSnapshotRef.current = {
        ambulances,
        workshops,
        preventiveSchedules,
        checklists,
        workOrders,
        spareParts,
        stockMovements,
      };
      return;
    }

    if (prevSnap.ambulances !== ambulances) dirtyKeysRef.current.add('ambulances');
    if (prevSnap.workshops !== workshops) dirtyKeysRef.current.add('workshops');
    if (prevSnap.preventiveSchedules !== preventiveSchedules)
      dirtyKeysRef.current.add('preventiveSchedules');
    if (prevSnap.checklists !== checklists) dirtyKeysRef.current.add('checklists');
    if (prevSnap.workOrders !== workOrders) dirtyKeysRef.current.add('workOrders');
    if (prevSnap.spareParts !== spareParts) dirtyKeysRef.current.add('spareParts');
    if (prevSnap.stockMovements !== stockMovements)
      dirtyKeysRef.current.add('stockMovements');

    prevSyncSnapshotRef.current = {
      ambulances,
      workshops,
      preventiveSchedules,
      checklists,
      workOrders,
      spareParts,
      stockMovements,
    };

    if (dirtyKeysRef.current.size === 0) return;

    const timer = setTimeout(() => {
      const keysToPush = Array.from(dirtyKeysRef.current);
      if (keysToPush.length === 0) return;
      dirtyKeysRef.current.clear();
      const nowIso = new Date().toISOString();
      pushFleetStateToFirebase(
        {
          updatedAt: nowIso,
          updatedByRole: currentRole,
          ambulances,
          workshops,
          preventiveSchedules,
          checklists,
          workOrders,
          spareParts,
          stockMovements,
        },
        cloudConfig.firebaseProjectId || DEFAULT_FIREBASE_CONFIG.projectId,
        cloudConfig.firebaseApiKey || DEFAULT_FIREBASE_CONFIG.apiKey,
        keysToPush
      ).then((res) => {
        if (res.ok) {
          setRealtimeLive(true);
        }
      });
    }, 2000);

    return () => clearTimeout(timer);
  }, [
    isAuthenticated,
    cloudConfig.enabled,
    isOnline,
    ambulances,
    workshops,
    preventiveSchedules,
    checklists,
    workOrders,
    spareParts,
    stockMovements,
  ]);

  // Persistencia automática, control de cuota y snapshot de backup automático en LocalStorage
  useEffect(() => {
    safeSaveToStorage(`${STORAGE_KEY}_role`, currentRole);
  }, [currentRole]);

  useEffect(() => {
    safeSaveToStorage(`${STORAGE_KEY}_ambulances`, ambulances, () => setQuotaAlert(true));
  }, [ambulances]);

  useEffect(() => {
    safeSaveToStorage(`${STORAGE_KEY}_workshops`, workshops, () => setQuotaAlert(true));
  }, [workshops]);

  useEffect(() => {
    safeSaveToStorage(`${STORAGE_KEY}_preventive`, preventiveSchedules, () => setQuotaAlert(true));
  }, [preventiveSchedules]);

  useEffect(() => {
    safeSaveToStorage(`${STORAGE_KEY}_checklists`, checklists, () => setQuotaAlert(true));
  }, [checklists]);

  useEffect(() => {
    safeSaveToStorage(`${STORAGE_KEY}_workorders`, workOrders, () => setQuotaAlert(true));
  }, [workOrders]);

  useEffect(() => {
    safeSaveToStorage(`${STORAGE_KEY}_parts`, spareParts, () => setQuotaAlert(true));
  }, [spareParts]);

  useEffect(() => {
    safeSaveToStorage(`${STORAGE_KEY}_movements`, stockMovements, () => setQuotaAlert(true));
  }, [stockMovements]);

  useEffect(() => {
    saveAutoBackupSnapshot(
      {
        ambulances,
        workshops,
        preventiveSchedules,
        checklists,
        workOrders,
        spareParts,
        stockMovements,
      },
      'Copia automática tras cambio de datos'
    );
    setStorageStats(getStorageUsageStats());
    getStorageUsageStatsAsync().then((stats) => setStorageStats(stats));
  }, [
    ambulances,
    workshops,
    preventiveSchedules,
    checklists,
    workOrders,
    spareParts,
    stockMovements,
  ]);

  // Solicitar almacenamiento persistente e hidratar desde IndexedDB (alta capacidad > 5 MB)
  useEffect(() => {
    let cancelled = false;
    requestPersistentStorage();
    const hydrateFromIdb = async () => {
      const [idbAmbs, idbWs, idbPrev, idbChk, idbWo, idbParts, idbMovs] =
        await Promise.all([
          idbGet<Ambulance[]>(`${STORAGE_KEY}_ambulances`),
          idbGet<ExternalWorkshop[]>(`${STORAGE_KEY}_workshops`),
          idbGet<PreventiveSchedule[]>(`${STORAGE_KEY}_preventive`),
          idbGet<FleetChecklist[]>(`${STORAGE_KEY}_checklists`),
          idbGet<WorkOrder[]>(`${STORAGE_KEY}_workorders`),
          idbGet<SparePart[]>(`${STORAGE_KEY}_parts`),
          idbGet<StockMovement[]>(`${STORAGE_KEY}_movements`),
        ]);
      if (cancelled) return;
      isApplyingRemoteRef.current = true;
      if (Array.isArray(idbAmbs) && idbAmbs.length > 0) {
        setAmbulances(hydrateAmbulancesWithFullFleet(idbAmbs));
      }
      if (Array.isArray(idbWs) && idbWs.length > 0) setWorkshops(idbWs);
      if (Array.isArray(idbPrev) && idbPrev.length > 0)
        setPreventiveSchedules(idbPrev);
      if (Array.isArray(idbChk) && idbChk.length > 0) setChecklists(idbChk);
      if (Array.isArray(idbWo) && idbWo.length > 0)
        setWorkOrders(hydrateWorkOrders(idbWo));
      if (Array.isArray(idbParts) && idbParts.length > 0)
        setSpareParts(hydrateSpareParts(idbParts));
      if (Array.isArray(idbMovs) && idbMovs.length > 0)
        setStockMovements(idbMovs);
      queueMicrotask(() => {
        isApplyingRemoteRef.current = false;
      });
      const stats = await getStorageUsageStatsAsync();
      if (!cancelled) setStorageStats(stats);
    };
    hydrateFromIdb();
    return () => {
      cancelled = true;
    };
  }, []);

  const recordStockMovement = (
    part: SparePart,
    type: StockMovementType,
    quantityChange: number,
    targetReference: string,
    performedBy: string,
    notes?: string
  ) => {
    const now = new Date();
    const formattedDate = `${now.toISOString().split('T')[0]} ${now
      .toTimeString()
      .slice(0, 5)}`;
    const newMov: StockMovement = {
      id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: formattedDate,
      partId: part.id,
      partName: part.name,
      sku: part.sku,
      type,
      quantityChange,
      targetReference,
      notes,
      performedBy,
    };
    setStockMovements((prev) => [newMov, ...prev]);
  };

  // --- Handlers Flota ---
  const handleAddAmbulance = (newAmb: Omit<Ambulance, 'id'>) => {
    const created: Ambulance = {
      ...newAmb,
      id: `amb-${Date.now()}`,
    };
    setAmbulances((prev) => [...prev, created]);
  };

  const handleDeleteAmbulance = (id: string) => {
    setAmbulances((prev) => prev.filter((a) => a.id !== id));
    setPreventiveSchedules((prev) => prev.filter((p) => p.ambulanceId !== id));
    setChecklists((prev) => prev.filter((c) => c.ambulanceId !== id));
    setWorkOrders((prev) => prev.filter((w) => w.ambulanceId !== id));
  };

  const handleUpdateAmbulanceStatus = (id: string, status: AmbulanceStatus) => {
    setAmbulances((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status } : a))
    );
  };

  const handleUpdateMileage = (id: string, newMileage: number) => {
    setAmbulances((prev) =>
      prev.map((a) => (a.id === id ? { ...a, mileage: newMileage } : a))
    );
  };

  const handleUpdateLegalDates = (
    id: string,
    itvExpiry: string,
    sanitaryCertExpiry: string,
    insuranceExpiry: string
  ) => {
    setAmbulances((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        const docs = ensureAmbulanceDocuments(a).map((doc) => {
          if (doc.type === 'ITV') return { ...doc, expiryDate: itvExpiry };
          if (doc.type === 'Certificado Técnico-Sanitario')
            return { ...doc, expiryDate: sanitaryCertExpiry };
          if (doc.type === 'Seguro') return { ...doc, expiryDate: insuranceExpiry };
          return doc;
        });
        return {
          ...a,
          itvExpiry,
          sanitaryCertExpiry,
          insuranceExpiry,
          documents: docs,
        };
      })
    );
  };

  const handleUpdateVehicleDocument = (
    ambulanceId: string,
    updatedDoc: VehicleDocument
  ) => {
    setAmbulances((prev) =>
      prev.map((a) => {
        if (a.id !== ambulanceId) return a;
        const currentDocs = ensureAmbulanceDocuments(a);
        const nextDocs = currentDocs.map((d) =>
          d.type === updatedDoc.type ? updatedDoc : d
        );
        return {
          ...a,
          itvExpiry:
            updatedDoc.type === 'ITV' ? updatedDoc.expiryDate : a.itvExpiry,
          sanitaryCertExpiry:
            updatedDoc.type === 'Certificado Técnico-Sanitario'
              ? updatedDoc.expiryDate
              : a.sanitaryCertExpiry,
          insuranceExpiry:
            updatedDoc.type === 'Seguro'
              ? updatedDoc.expiryDate
              : a.insuranceExpiry,
          documents: nextDocs,
        };
      })
    );
  };

  const handleUpdateVehiclePartQty = (
    ambulanceId: string,
    partId: string,
    field: 'currentQty' | 'requiredQty',
    delta: number
  ) => {
    setAmbulances((prev) =>
      prev.map((a) => {
        if (a.id !== ambulanceId) return a;
        return {
          ...a,
          onboardParts: a.onboardParts.map((p) => {
            if (p.partId !== partId) return p;
            const minVal = field === 'requiredQty' ? 1 : 0;
            return {
              ...p,
              [field]: Math.max(minVal, p[field] + delta),
            };
          }),
        };
      })
    );
  };

  const handleAddPartToVehicleOnboard = (
    ambulanceId: string,
    partId: string,
    requiredQty: number,
    currentQty: number
  ) => {
    const partInfo = spareParts.find((sp) => sp.id === partId);
    const amb = ambulances.find((a) => a.id === ambulanceId);
    if (!partInfo || !amb) return;

    const safeReq = Math.max(1, Math.floor(requiredQty));
    const safeCur = Math.max(0, Math.floor(currentQty));

    if (safeCur > 0) {
      if (partInfo.stockQuantity < safeCur) {
        alert(
          `Stock insuficiente en almacén para "${partInfo.name}". Disponible: ${partInfo.stockQuantity} uds.`
        );
        return;
      }
      recordStockMovement(
        partInfo,
        'Salida a vehículo',
        -safeCur,
        `${amb.code} (${amb.plate}) • Dotación a bordo`,
        `${currentRole} de Flota`
      );
      setSpareParts((prev) =>
        prev.map((sp) =>
          sp.id === partId
            ? { ...sp, stockQuantity: Math.max(0, sp.stockQuantity - safeCur) }
            : sp
        )
      );
    }

    setAmbulances((prev) =>
      prev.map((a) => {
        if (a.id !== ambulanceId) return a;
        const exists = a.onboardParts.some((p) => p.partId === partId);
        if (exists) {
          return {
            ...a,
            onboardParts: a.onboardParts.map((p) =>
              p.partId === partId
                ? {
                    ...p,
                    requiredQty: p.requiredQty + safeReq,
                    currentQty: p.currentQty + safeCur,
                  }
                : p
            ),
          };
        }
        return {
          ...a,
          onboardParts: [
            ...a.onboardParts,
            {
              partId: partInfo.id,
              partName: partInfo.name,
              requiredQty: safeReq,
              currentQty: safeCur,
            },
          ],
        };
      })
    );
  };

  const handleRemovePartFromVehicleOnboard = (
    ambulanceId: string,
    partId: string
  ) => {
    setAmbulances((prev) =>
      prev.map((a) =>
        a.id === ambulanceId
          ? {
              ...a,
              onboardParts: a.onboardParts.filter((p) => p.partId !== partId),
            }
          : a
      )
    );
  };

  // Reponer pieza de la dotación a bordo de una ambulancia descontando del almacén (validando stock disponible)
  const handleRestockVehiclePart = (ambulanceId: string, partId: string) => {
    const amb = ambulances.find((a) => a.id === ambulanceId);
    if (!amb) return;
    const onboard = amb.onboardParts.find((p) => p.partId === partId);
    if (!onboard) return;
    const needed = onboard.requiredQty - onboard.currentQty;
    if (needed <= 0) return;

    const part = spareParts.find((sp) => sp.id === partId);
    if (!part || part.stockQuantity <= 0) {
      alert(
        `No hay unidades disponibles en el almacén de taller para "${
          part?.name || onboard.partName
        }". Registra primero una entrada de mercancía en Inventario.`
      );
      return;
    }

    const actualToRestock = Math.min(needed, part.stockQuantity);

    recordStockMovement(
      part,
      'Salida a vehículo',
      -actualToRestock,
      `Dotación a bordo ${amb.code} (${amb.plate})`,
      `${currentRole} de Flota`
    );

    setSpareParts((prev) =>
      prev.map((sp) =>
        sp.id === partId
          ? {
              ...sp,
              stockQuantity: Math.max(0, sp.stockQuantity - actualToRestock),
            }
          : sp
      )
    );

    setAmbulances((prev) =>
      prev.map((a) =>
        a.id === ambulanceId
          ? {
              ...a,
              onboardParts: a.onboardParts.map((p) =>
                p.partId === partId
                  ? { ...p, currentQty: p.currentQty + actualToRestock }
                  : p
              ),
            }
          : a
      )
    );
  };

  // --- Handlers Mantenimiento Preventivo ---
  const handleAddSchedule = (sched: Omit<PreventiveSchedule, 'id'>) => {
    setPreventiveSchedules((prev) => [
      ...prev,
      { ...sched, id: `prev-${Date.now()}` },
    ]);
  };

  const handleAddSchedulesBulk = (
    items: Omit<PreventiveSchedule, 'id'>[]
  ) => {
    const baseTs = Date.now();
    setPreventiveSchedules((prev) => [
      ...prev,
      ...items.map((item, idx) => ({
        ...item,
        id: `prev-${baseTs}-${idx}`,
      })),
    ]);
  };

  const handleUpdateSchedule = (updated: PreventiveSchedule) => {
    setPreventiveSchedules((prev) =>
      prev.map((s) => (s.id === updated.id ? updated : s))
    );
  };

  const handleDeleteSchedule = (scheduleId: string) => {
    setPreventiveSchedules((prev) => prev.filter((s) => s.id !== scheduleId));
  };

  const handleCompletePreventive = (scheduleId: string) => {
    const sched = preventiveSchedules.find((s) => s.id === scheduleId);
    if (!sched) return;
    const amb = ambulances.find((a) => a.id === sched.ambulanceId);
    const currentKm = amb?.mileage || sched.lastDoneKm || 100000;
    const today = getLocalDateString();
    const nextDueDate = addMonthsLocal(today, sched.intervalMonths || 6);

    setPreventiveSchedules((prev) =>
      prev.map((s) =>
        s.id === scheduleId
          ? {
              ...s,
              lastDoneKm: currentKm,
              nextDueKm: s.intervalKm ? currentKm + s.intervalKm : undefined,
              lastDoneDate: today,
              nextDueDate,
            }
          : s
      )
    );
  };

  const handleGenerateWorkOrderFromPreventive = (sched: PreventiveSchedule) => {
    const amb = ambulances.find((a) => a.id === sched.ambulanceId);
    if (!amb) return;

    const today = new Date().toISOString().split('T')[0];
    const newWo: WorkOrder = {
      id: `wo-${Date.now()}`,
      code: getNextWorkOrderCode(workOrders),
      ambulanceId: amb.id,
      workshopId: workshops[0]?.id || 'ws-1',
      type: 'Preventivo',
      priority: 'Alta',
      status: 'Asignada',
      title: `Mantenimiento Preventivo: ${sched.title}`,
      description: `Programado desde el plan preventivo (${sched.category}). ${
        sched.notes || ''
      }`,
      reportedBy: 'Plan Preventivo (Encargado de Vehículos)',
      createdAt: today,
      entryDate: today,
      mileageAtEntry: amb.mileage,
      partsUsed: [],
      workshopReport: '',
      warranty: '6 meses en mantenimiento preventivo',
    };

    setWorkOrders((prev) => [newWo, ...prev]);
    setActiveTab('workorders');
  };

  // --- Handlers Checklist / Incidencias ---
  const handleCreateWorkOrderFromChecklist = (chk: FleetChecklist) => {
    const amb = ambulances.find((a) => a.id === chk.ambulanceId);
    if (!amb) return;

    const faultItems = chk.items.filter((i) => i.status !== 'OK');
    const faultSummary = faultItems
      .map((i) => `[${i.status}] ${i.label}${i.comment ? `: ${i.comment}` : ''}`)
      .join(' | ');
    const missingSummary =
      chk.missingParts.length > 0
        ? ` | Piezas a reponer en vehículo: ${chk.missingParts
            .map((m) => `${m.partName} (x${m.missingQty})`)
            .join(', ')}`
        : '';

    const today = new Date().toISOString().split('T')[0];
    const newWoId = `wo-${Date.now()}`;
    const newWo: WorkOrder = {
      id: newWoId,
      code: getNextWorkOrderCode(workOrders),
      ambulanceId: amb.id,
      workshopId: workshops[0]?.id || 'ws-1',
      type: 'Incidencia / Checklist',
      priority:
        chk.overallUrgency === 'Inmovilización Inmediata'
          ? 'Crítica (Urgente)'
          : chk.overallUrgency === 'Prioritaria'
          ? 'Alta'
          : 'Media',
      status: 'En taller',
      title: `Incidencia Flota (${amb.code}): ${
        faultItems.length > 0
          ? faultItems[0].label
          : 'Reposición de Stock y Revisión en Taller Externo'
      }`,
      description: `${chk.generalObservations}. Detalle puntos: ${faultSummary}${missingSummary}`,
      reportedBy: chk.inspectorName,
      createdAt: today,
      entryDate: today,
      mileageAtEntry: chk.mileageAtInspection,
      partsUsed: [],
      workshopReport: '',
      warranty: '6 meses en reparación',
      sourceChecklistId: chk.id,
      photos: chk.photos,
      inspectorSignature: chk.inspectorSignature,
    };

    setWorkOrders((prev) => [newWo, ...prev]);
    setChecklists((prev) =>
      prev.map((c) =>
        c.id === chk.id
          ? {
              ...c,
              workshopStatus: 'Orden Externa Creada',
              linkedWorkOrderId: newWoId,
            }
          : c
      )
    );
    handleUpdateAmbulanceStatus(amb.id, 'En taller');
    setActiveTab('workorders');
  };

  const handleSubmitChecklist = (
    checklistData: Omit<FleetChecklist, 'id'>,
    autoCreateWorkOrder: boolean,
    updatedOnboardQtys: Record<string, number>
  ) => {
    const newChk: FleetChecklist = {
      ...checklistData,
      id: `chk-rep-${Date.now()}`,
    };

    setAmbulances((prev) =>
      prev.map((a) => {
        if (a.id !== checklistData.ambulanceId) return a;
        return {
          ...a,
          mileage: Math.max(a.mileage, checklistData.mileageAtInspection),
          status: autoCreateWorkOrder
            ? 'En taller'
            : checklistData.overallUrgency === 'Inmovilización Inmediata'
            ? 'Fuera de servicio'
            : a.status,
          onboardParts: a.onboardParts.map((p) => ({
            ...p,
            currentQty:
              updatedOnboardQtys[p.partId] !== undefined
                ? updatedOnboardQtys[p.partId]
                : p.currentQty,
          })),
        };
      })
    );

    setChecklists((prev) => [newChk, ...prev]);

    if (autoCreateWorkOrder) {
      handleCreateWorkOrderFromChecklist(newChk);
    }
  };

  // --- Handlers Talleres Externos ---
  const handleAddWorkshop = (wsData: Omit<ExternalWorkshop, 'id'>) => {
    setWorkshops((prev) => [
      ...prev,
      { ...wsData, id: `ws-${Date.now()}` },
    ]);
  };

  const handleUpdateWorkshop = (updated: ExternalWorkshop) => {
    setWorkshops((prev) =>
      prev.map((w) => (w.id === updated.id ? updated : w))
    );
  };

  const handleDeleteWorkshop = (id: string) => {
    setWorkshops((prev) => prev.filter((w) => w.id !== id));
  };

  // --- Handlers Órdenes de Reparación Externas ---
  const handleCreateWorkOrder = (woData: Omit<WorkOrder, 'id' | 'code'>) => {
    const newWo: WorkOrder = {
      ...woData,
      id: `wo-${Date.now()}`,
      code: getNextWorkOrderCode(workOrders),
    };
    setWorkOrders((prev) => [newWo, ...prev]);
    if (woData.status === 'En taller') {
      handleUpdateAmbulanceStatus(woData.ambulanceId, 'En taller');
    }
  };

  const handleUpdateWorkOrderStatus = (woId: string, status: WorkOrderStatus) => {
    const wo = workOrders.find((w) => w.id === woId);
    const today = new Date().toISOString().split('T')[0];

    setWorkOrders((prev) =>
      prev.map((w) =>
        w.id === woId
          ? {
              ...w,
              status,
              exitDate:
                (status === 'Reparada' || status === 'Cerrada') && !w.exitDate
                  ? today
                  : w.exitDate,
              completedAt:
                status === 'Cerrada' ? today : w.completedAt,
            }
          : w
      )
    );

    if (wo) {
      if (status === 'En taller') {
        handleUpdateAmbulanceStatus(wo.ambulanceId, 'En taller');
      } else if (status === 'Cerrada') {
        setAmbulances((prev) =>
          prev.map((a) =>
            a.id === wo.ambulanceId
              ? {
                  ...a,
                  status: 'Disponible',
                  lastServiceDate: today,
                  lastServiceMileage: a.mileage,
                }
              : a
          )
        );
      }
    }
  };

  const handleAddPartToWorkOrder = (
    woId: string,
    partId: string,
    quantity: number
  ) => {
    const part = spareParts.find((p) => p.id === partId);
    const wo = workOrders.find((w) => w.id === woId);
    if (!part || !wo) return;
    if (part.stockQuantity < quantity) {
      alert(
        `Stock insuficiente en almacén para "${part.name}". Disponible: ${part.stockQuantity} uds.`
      );
      return;
    }
    const amb = ambulances.find((a) => a.id === wo.ambulanceId);
    const ws = workshops.find((w) => w.id === wo.workshopId);

    recordStockMovement(
      part,
      'Salida a reparación',
      -quantity,
      `${amb?.code || ''} (${amb?.plate || ''}) • ${wo.code} (${
        ws?.name || 'Taller Externo'
      })`,
      `${currentRole} de Flota`
    );

    setSpareParts((prev) =>
      prev.map((p) =>
        p.id === partId
          ? { ...p, stockQuantity: Math.max(0, p.stockQuantity - quantity) }
          : p
      )
    );

    setWorkOrders((prev) =>
      prev.map((item) =>
        item.id === woId
          ? {
              ...item,
              partsUsed: [
                ...item.partsUsed,
                {
                  partId: part.id,
                  partName: part.name,
                  sku: part.sku,
                  quantity,
                  deductedFromStock: true,
                },
              ],
            }
          : item
      )
    );
  };

  const handleRemovePartFromWorkOrder = (woId: string, partIndex: number) => {
    const wo = workOrders.find((w) => w.id === woId);
    if (!wo) return;
    const removedEntry = wo.partsUsed[partIndex];
    if (!removedEntry) return;

    const part = spareParts.find((p) => p.id === removedEntry.partId);
    const amb = ambulances.find((a) => a.id === wo.ambulanceId);
    if (part && removedEntry.deductedFromStock === true) {
      recordStockMovement(
        part,
        'Ajuste',
        removedEntry.quantity,
        `Devolución desde ${wo.code} (${amb?.code || ''})`,
        `${currentRole} de Flota`
      );
      setSpareParts((prev) =>
        prev.map((p) =>
          p.id === part.id
            ? { ...p, stockQuantity: p.stockQuantity + removedEntry.quantity }
            : p
        )
      );
    }

    setWorkOrders((prev) =>
      prev.map((item) =>
        item.id === woId
          ? {
              ...item,
              partsUsed: item.partsUsed.filter((_, idx) => idx !== partIndex),
            }
          : item
      )
    );
  };

  const handleUpdateWorkOrderDetails = (
    woId: string,
    patch: Partial<
      Pick<
        WorkOrder,
        | 'workshopId'
        | 'entryDate'
        | 'exitDate'
        | 'workshopReport'
        | 'warranty'
        | 'partsDeliverySignature'
        | 'partsDeliveryDate'
        | 'partsReceivedBy'
      >
    >
  ) => {
    setWorkOrders((prev) =>
      prev.map((wo) => (wo.id === woId ? { ...wo, ...patch } : wo))
    );
  };

  const handleUpdateBodyAndVisualState = (
    ambulanceId: string,
    patch: Partial<Pick<Ambulance, 'bodyDamages' | 'tires' | 'batteries'>>
  ) => {
    setAmbulances((prev) =>
      prev.map((a) => (a.id === ambulanceId ? { ...a, ...patch } : a))
    );
  };

  const handleUpdateWorkOrderSignatureAndPhotos = (
    woId: string,
    workshopConformitySignature?: string,
    newPhotoUrl?: string
  ) => {
    setWorkOrders((prev) =>
      prev.map((wo) => {
        if (wo.id !== woId) return wo;
        return {
          ...wo,
          workshopConformitySignature:
            workshopConformitySignature !== undefined
              ? workshopConformitySignature || undefined
              : wo.workshopConformitySignature,
          photos: newPhotoUrl
            ? [...(wo.photos || []), newPhotoUrl]
            : wo.photos,
        };
      })
    );
  };

  // --- Handlers Inventario de Repuestos ---
  const handleAddSparePart = (partData: Omit<SparePart, 'id'>) => {
    setSpareParts((prev) => [
      ...prev,
      { ...partData, id: `part-${Date.now()}` },
    ]);
  };

  const handleUpdatePartStock = (
    partId: string,
    delta: number,
    notes?: string
  ) => {
    const part = spareParts.find((p) => p.id === partId);
    if (!part) return;
    if (delta < 0 && part.stockQuantity < Math.abs(delta)) {
      alert(
        `No hay stock suficiente para restar ${Math.abs(delta)} uds. de "${part.name}" (Stock actual: ${part.stockQuantity}).`
      );
      return;
    }
    const nextQty = Math.max(0, part.stockQuantity + delta);
    const actualDelta = nextQty - part.stockQuantity;
    if (actualDelta === 0) return;

    recordStockMovement(
      part,
      'Ajuste',
      actualDelta,
      `Almacén (${part.warehouseLocation})`,
      `${currentRole} de Flota`,
      notes || 'Ajuste de inventario en almacén'
    );
    setSpareParts((prev) =>
      prev.map((p) =>
        p.id === partId ? { ...p, stockQuantity: nextQty } : p
      )
    );
  };

  const handleRecordCustomMovement = (
    partId: string,
    type: StockMovementType,
    quantity: number,
    destination: string,
    notes: string,
    performedBy: string
  ) => {
    const part = spareParts.find((p) => p.id === partId);
    if (!part) return;
    const isOutbound =
      type === 'Salida a reparación' || type === 'Salida a vehículo';
    if (isOutbound && part.stockQuantity < quantity) {
      alert(
        `Stock insuficiente para "${part.name}". Disponible: ${part.stockQuantity} uds.`
      );
      return;
    }
    const delta = isOutbound ? -Math.abs(quantity) : Math.abs(quantity);
    recordStockMovement(
      part,
      type,
      delta,
      destination,
      performedBy,
      notes || undefined
    );
    setSpareParts((prev) =>
      prev.map((p) =>
        p.id === partId
          ? { ...p, stockQuantity: Math.max(0, p.stockQuantity + delta) }
          : p
      )
    );
  };

  const handleReceiveSupplierOrder = (partId: string, quantityToAdd: number) => {
    const part = spareParts.find((p) => p.id === partId);
    if (!part) return;
    recordStockMovement(
      part,
      'Entrada',
      quantityToAdd,
      `Recepción Proveedor: ${part.supplier}`,
      `${currentRole} de Flota`
    );
    setSpareParts((prev) =>
      prev.map((p) =>
        p.id === partId
          ? { ...p, stockQuantity: p.stockQuantity + quantityToAdd }
          : p
      )
    );
  };

  const handleDownloadJsonBackup = () => {
    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      ambulances,
      workshops,
      preventiveSchedules,
      checklists,
      workOrders,
      spareParts,
      stockMovements,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ambu-lzflota_copia_seguridad_${
      new Date().toISOString().split('T')[0]
    }.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJsonBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
          throw new Error('Estructura inválida');
        }
        const hasValidSection =
          Array.isArray(data.ambulances) ||
          Array.isArray(data.workshops) ||
          Array.isArray(data.workOrders) ||
          Array.isArray(data.spareParts);
        if (!hasValidSection) {
          throw new Error('Sin secciones válidas');
        }

        const confirmed = window.confirm(
          '¿Seguro que deseas restaurar esta copia de seguridad? Se guardará una copia automática del estado actual antes de sobrescribir.'
        );
        if (!confirmed) return;

        saveAutoBackupSnapshot(
          {
            ambulances,
            workshops,
            preventiveSchedules,
            checklists,
            workOrders,
            spareParts,
            stockMovements,
          },
          'Pre-importación manual JSON'
        );

        if (Array.isArray(data.ambulances))
          setAmbulances(hydrateAmbulancesWithFullFleet(data.ambulances));
        if (Array.isArray(data.workshops)) setWorkshops(data.workshops);
        if (Array.isArray(data.preventiveSchedules))
          setPreventiveSchedules(data.preventiveSchedules);
        if (Array.isArray(data.checklists)) setChecklists(data.checklists);
        if (Array.isArray(data.workOrders))
          setWorkOrders(hydrateWorkOrders(data.workOrders));
        if (Array.isArray(data.spareParts))
          setSpareParts(hydrateSpareParts(data.spareParts));
        if (Array.isArray(data.stockMovements))
          setStockMovements(data.stockMovements);
        setShowBackupModal(false);
      } catch {
        alert('El archivo seleccionado no es una copia de seguridad válida.');
      }
    };
    reader.readAsText(file);
  };

  const handleRestoreAutoBackup = async () => {
    const snap = await loadAutoBackupSnapshotAsync<{
      ambulances?: Ambulance[];
      workshops?: ExternalWorkshop[];
      preventiveSchedules?: PreventiveSchedule[];
      checklists?: FleetChecklist[];
      workOrders?: WorkOrder[];
      spareParts?: SparePart[];
      stockMovements?: StockMovement[];
    }>();
    if (!snap || !snap.payload) {
      alert('No se encontró ninguna copia automática en este dispositivo.');
      return;
    }
    const { payload } = snap;
    if (payload.ambulances)
      setAmbulances(hydrateAmbulancesWithFullFleet(payload.ambulances));
    if (payload.workshops) setWorkshops(payload.workshops);
    if (payload.preventiveSchedules)
      setPreventiveSchedules(payload.preventiveSchedules);
    if (payload.checklists) setChecklists(payload.checklists);
    if (payload.workOrders)
      setWorkOrders(hydrateWorkOrders(payload.workOrders));
    if (payload.spareParts)
      setSpareParts(hydrateSpareParts(payload.spareParts));
    if (payload.stockMovements) setStockMovements(payload.stockMovements);
    setShowBackupModal(false);
  };

  const handlePushToFirebase = async () => {
    setIsSyncingFirebase(true);
    setFirebaseStatusMsg('Subiendo datos a Firebase...');
    const nowIso = new Date().toISOString();
    const res = await pushFleetStateToFirebase(
      {
        updatedAt: nowIso,
        updatedByRole: currentRole,
        ambulances,
        workshops,
        preventiveSchedules,
        checklists,
        workOrders,
        spareParts,
        stockMovements,
      },
      cloudConfig.firebaseProjectId || DEFAULT_FIREBASE_CONFIG.projectId,
      cloudConfig.firebaseApiKey || DEFAULT_FIREBASE_CONFIG.apiKey
    );
    setIsSyncingFirebase(false);
    if (res.ok) {
      const next = { ...cloudConfig, lastSyncedAt: nowIso };
      setCloudConfig(next);
      saveCloudSyncConfig(next);
      setFirebaseStatusMsg(
        `✅ Sincronizado con Firebase (${new Date(nowIso).toLocaleTimeString('es-ES')})`
      );
    } else {
      setFirebaseStatusMsg(`⚠️ ${res.error}`);
    }
  };

  const handlePullFromFirebase = async () => {
    setIsSyncingFirebase(true);
    setFirebaseStatusMsg('Descargando estado de flota desde Firebase...');
    const res = await pullFleetStateFromFirebase(
      cloudConfig.firebaseProjectId || DEFAULT_FIREBASE_CONFIG.projectId,
      cloudConfig.firebaseApiKey || DEFAULT_FIREBASE_CONFIG.apiKey
    );
    setIsSyncingFirebase(false);
    if (res.ok && res.data) {
      const d = res.data;
      if (d.ambulances)
        setAmbulances(
          hydrateAmbulancesWithFullFleet(d.ambulances as Ambulance[])
        );
      if (d.workshops) setWorkshops(d.workshops as ExternalWorkshop[]);
      if (d.preventiveSchedules)
        setPreventiveSchedules(d.preventiveSchedules as PreventiveSchedule[]);
      if (d.checklists) setChecklists(d.checklists as FleetChecklist[]);
      if (d.workOrders)
        setWorkOrders(hydrateWorkOrders(d.workOrders as WorkOrder[]));
      if (d.spareParts)
        setSpareParts(hydrateSpareParts(d.spareParts as SparePart[]));
      if (d.stockMovements)
        setStockMovements(d.stockMovements as StockMovement[]);
      const next = { ...cloudConfig, lastSyncedAt: d.updatedAt };
      setCloudConfig(next);
      saveCloudSyncConfig(next);
      setFirebaseStatusMsg(
        `✅ Datos actualizados desde Firebase (subidos por ${d.updatedByRole} el ${new Date(
          d.updatedAt
        ).toLocaleString('es-ES')})`
      );
    } else {
      setFirebaseStatusMsg(`⚠️ ${res.error}`);
    }
  };

  const handleResetDemoData = () => {
    localStorage.removeItem(`${STORAGE_KEY}_ambulances`);
    localStorage.removeItem(`${STORAGE_KEY}_workshops`);
    localStorage.removeItem(`${STORAGE_KEY}_preventive`);
    localStorage.removeItem(`${STORAGE_KEY}_checklists`);
    localStorage.removeItem(`${STORAGE_KEY}_workorders`);
    localStorage.removeItem(`${STORAGE_KEY}_parts`);
    localStorage.removeItem(`${STORAGE_KEY}_movements`);
    setAmbulances(
      INITIAL_AMBULANCES.map((a) => ({
        ...a,
        documents: ensureAmbulanceDocuments(a),
      }))
    );
    setWorkshops(INITIAL_EXTERNAL_WORKSHOPS);
    setPreventiveSchedules(INITIAL_PREVENTIVE_SCHEDULES);
    setChecklists(INITIAL_CHECKLISTS);
    setWorkOrders(INITIAL_WORK_ORDERS);
    setSpareParts(INITIAL_SPARE_PARTS);
    setStockMovements(INITIAL_STOCK_MOVEMENTS);
  };

  const allNavItems: {
    id: ActiveTab;
    label: string;
    shortLabel: string;
    icon: React.ReactNode;
    badge?: number;
    encargadoOnly?: boolean;
  }[] = [
    {
      id: 'dashboard',
      label: 'Panel / Disponibilidad',
      shortLabel: 'Inicio',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: 'fleet',
      label: 'Flota (21) y Documentos',
      shortLabel: 'Flota',
      icon: <Truck className="w-4 h-4" />,
      badge: ambulances.length,
    },
    {
      id: 'checklist',
      label: 'Incidencias y Checklists',
      shortLabel: 'Incidencias',
      icon: <ClipboardCheck className="w-4 h-4" />,
      badge: checklists.filter(
        (c) => c.workshopStatus === 'Pendiente de Asignar Taller'
      ).length,
    },
    {
      id: 'workorders',
      label: 'Órdenes Externas',
      shortLabel: 'Órdenes',
      icon: <Wrench className="w-4 h-4" />,
      badge: workOrders.filter((w) => w.status !== 'Cerrada').length,
      encargadoOnly: true,
    },
    {
      id: 'workshops',
      label: 'Talleres Externos',
      shortLabel: 'Talleres',
      icon: <Building2 className="w-4 h-4" />,
      badge: workshops.length,
      encargadoOnly: true,
    },
    {
      id: 'preventive',
      label: 'Mantenimiento Preventivo',
      shortLabel: 'Preventivo',
      icon: <CalendarClock className="w-4 h-4" />,
      encargadoOnly: true,
    },
    {
      id: 'parts',
      label: 'Stock de Repuestos',
      shortLabel: 'Stock',
      icon: <Package className="w-4 h-4" />,
      badge: spareParts.filter((p) => p.stockQuantity <= p.minStockAlert).length,
    },
  ];

  const navItems =
    currentRole === 'Encargado'
      ? allNavItems
      : allNavItems.filter((item) => !item.encargadoOnly);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = Date.now();
    if (authLockUntil > now) {
      const secs = Math.ceil((authLockUntil - now) / 1000);
      setAuthError(`Demasiados intentos fallidos. Espera ${secs}s.`);
      return;
    }

    let valid = false;
    if (useFirebaseEmailLogin && firebaseEmail.trim()) {
      const res = await signInFirebaseWithEmail(
        firebaseEmail,
        passwordInput,
        cloudConfig.firebaseProjectId || DEFAULT_FIREBASE_CONFIG.projectId,
        cloudConfig.firebaseApiKey || DEFAULT_FIREBASE_CONFIG.apiKey
      );
      if (res.ok) {
        valid = true;
      } else {
        const nextFails = authFailedAttempts + 1;
        setAuthFailedAttempts(nextFails);
        if (nextFails >= 5) {
          setAuthLockUntil(Date.now() + 30000);
          setAuthFailedAttempts(0);
        }
        setAuthError(res.error || 'Error de autenticación en Firebase.');
        return;
      }
    } else {
      valid = await verifyLocalAccessPassword(passwordInput);
      if (valid) {
        await ensureFirebaseAuthSession(
          cloudConfig.firebaseProjectId || DEFAULT_FIREBASE_CONFIG.projectId,
          cloudConfig.firebaseApiKey || DEFAULT_FIREBASE_CONFIG.apiKey
        );
      }
    }

    if (valid) {
      setAuthFailedAttempts(0);
      setAuthLockUntil(0);
      setIsAuthenticated(true);
      setAuthError('');
      setPasswordInput('');
      try {
        sessionStorage.setItem(AUTH_SESSION_KEY, 'true');
        if (rememberDevice) {
          localStorage.setItem(AUTH_SESSION_KEY, 'true');
        }
      } catch {
        // Ignorar errores de storage
      }
    } else {
      const nextFails = authFailedAttempts + 1;
      setAuthFailedAttempts(nextFails);
      if (nextFails >= 5) {
        setAuthLockUntil(Date.now() + 30000);
        setAuthFailedAttempts(0);
        setAuthError('Demasiados intentos fallidos. Bloqueado 30 segundos.');
      } else {
        setAuthError('Contraseña incorrecta. Verifica mayúsculas y números.');
      }
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setPasswordInput('');
    signOutFirebase(
      cloudConfig.firebaseProjectId || DEFAULT_FIREBASE_CONFIG.projectId,
      cloudConfig.firebaseApiKey || DEFAULT_FIREBASE_CONFIG.apiKey
    );
    try {
      sessionStorage.removeItem(AUTH_SESSION_KEY);
      localStorage.removeItem(AUTH_SESSION_KEY);
    } catch {
      // Ignorar errores de storage
    }
  };

  if (isUnitReportMode) {
    return (
      <UnitReportView
        projectId={
          cloudConfig.firebaseProjectId || DEFAULT_FIREBASE_CONFIG.projectId
        }
        apiKey={cloudConfig.firebaseApiKey || DEFAULT_FIREBASE_CONFIG.apiKey}
        onExitToLogin={() => {
          setIsUnitReportMode(false);
          try {
            const url = new URL(window.location.href);
            url.searchParams.delete('modo');
            window.history.replaceState({}, '', url.toString());
          } catch {
            // ignorar
          }
        }}
      />
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-5">
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-rose-600 flex items-center justify-center shadow-md">
              <Activity className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-slate-900">
                Ambu-<span className="text-rose-600">lzflota</span>
              </h1>
              <p className="text-xs text-slate-500">
                Gestión de 21 Ambulancias y Talleres Externos
              </p>
            </div>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
            <div className="flex rounded-xl bg-slate-100 p-1 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => {
                  setUseFirebaseEmailLogin(false);
                  setAuthError('');
                }}
                className={`flex-1 py-1.5 rounded-lg transition ${
                  !useFirebaseEmailLogin
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500'
                }`}
              >
                Clave Flota
              </button>
              <button
                type="button"
                onClick={() => {
                  setUseFirebaseEmailLogin(true);
                  setAuthError('');
                }}
                className={`flex-1 py-1.5 rounded-lg transition ${
                  useFirebaseEmailLogin
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500'
                }`}
              >
                Firebase Auth (Email)
              </button>
            </div>

            {useFirebaseEmailLogin && (
              <div>
                <label className="font-bold text-slate-700 block mb-1.5">
                  Correo Electrónico (Firebase)
                </label>
                <input
                  type="email"
                  required
                  value={firebaseEmail}
                  onChange={(e) => setFirebaseEmail(e.target.value)}
                  placeholder="encargado@flota.es"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            )}

            <div>
              <label className="font-bold text-slate-700 block mb-1.5 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-blue-600" />
                Contraseña de Acceso
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoFocus
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    if (authError) setAuthError('');
                  }}
                  placeholder="Introduce la contraseña..."
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-2.5 p-1 text-slate-400 hover:text-slate-700"
                  title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              {authError && (
                <p className="text-rose-600 font-bold mt-1.5">{authError}</p>
              )}
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1.5">
                Entrar con el Rol
              </label>
              <select
                value={currentRole}
                onChange={(e) => setCurrentRole(e.target.value as UserRole)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 font-bold text-slate-900"
              >
                <option value="Encargado">
                  Encargado de Vehículos (Acceso Completo)
                </option>
                <option value="Operador">
                  Operador (Flota, Incidencias, Stock y Checklists)
                </option>
              </select>
            </div>

            <label className="flex items-center gap-2 text-slate-600 font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
                className="rounded text-blue-600"
              />
              Recordar acceso en este móvil / tablet
            </label>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition"
            >
              Entrar a Ambu-lzflota
            </button>
          </form>

          <div className="pt-3 border-t border-slate-200 text-center space-y-2">
            <p className="text-[11px] text-slate-500 font-semibold">
              ¿Estás en una ambulancia y quieres avisar de una avería?
            </p>
            <button
              type="button"
              onClick={() => setIsUnitReportMode(true)}
              className="w-full py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center justify-center gap-1.5"
            >
              <AlertTriangle className="w-4 h-4" />
              Parte Rápido Unidad (Por Matrícula)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col lg:pl-64 pb-8">
      {/* Sidebar Fijo en Escritorio (lg+) */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:left-0 bg-slate-900 text-white border-r border-slate-800 z-40 shadow-xl">
        <div className="px-4 py-4 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-600 flex items-center justify-center shadow-sm shrink-0">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-extrabold tracking-tight truncate">
              Ambu-<span className="text-rose-400">lzflota</span>
            </h1>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">
              21 Ambulancias • Flota
            </p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between gap-2 transition ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md shadow-blue-950/40 ring-1 ring-blue-400/40'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold shrink-0 ${
                      isActive
                        ? 'bg-white text-blue-700'
                        : 'bg-rose-600 text-white'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800 text-[11px] text-slate-400 space-y-2">
          <button
            type="button"
            onClick={() => {
              const link = `${window.location.origin}${window.location.pathname}?modo=parte`;
              navigator.clipboard?.writeText(link);
              setFirebaseStatusMsg(
                `📋 Enlace de Parte Rápido copiado: ${link}`
              );
              setShowBackupModal(true);
            }}
            className="w-full py-2 px-2.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-800/80 font-bold text-[11px] flex items-center justify-center gap-1.5"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Enlace Parte Unidad
          </button>
          <div className="flex items-center justify-between">
            <span>Rol activo:</span>
            <strong className="text-white">{currentRole}</strong>
          </div>
          <div className="flex items-center justify-between">
            <span>Estado:</span>
            <span className={isOnline ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
              {isOnline ? (realtimeLive ? 'Sync En Vivo' : 'Online PWA') : 'Offline'}
            </span>
          </div>
        </div>
      </aside>

      {/* Drawer Lateral Deslizable en Móvil y Tablet (< lg) */}
      {mobileSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-900/65 backdrop-blur-sm"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <aside className="relative w-72 max-w-[82vw] bg-slate-900 text-white h-full flex flex-col shadow-2xl border-r border-slate-800 z-10">
            <div className="px-4 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-600 flex items-center justify-center shadow-sm">
                  <Activity className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold tracking-tight">
                    Ambu-<span className="text-rose-400">lzflota</span>
                  </h2>
                  <p className="text-[10px] text-slate-400 font-semibold">
                    Menú Principal
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
                className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileSidebarOpen(false);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className={`w-full px-3.5 py-3 rounded-xl text-xs font-bold flex items-center justify-between gap-2 transition ${
                      isActive
                        ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md ring-1 ring-blue-400/40'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      {item.icon}
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold shrink-0 ${
                          isActive
                            ? 'bg-white text-blue-700'
                            : 'bg-rose-600 text-white'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Top Navbar adaptada a Móvil, Tablet y Escritorio */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 safe-top shadow-md">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Abrir menú lateral"
              className="lg:hidden p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="lg:hidden w-8 h-8 rounded-xl bg-rose-600 flex items-center justify-center shadow-sm shrink-0">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="lg:hidden text-sm sm:text-lg font-extrabold tracking-tight truncate">
                  Ambu-<span className="text-rose-400">lzflota</span>
                </h1>
                <span className="hidden lg:inline-block text-xs font-extrabold text-white">
                  {navItems.find((n) => n.id === activeTab)?.label || 'Panel General'}
                </span>
                <span className="hidden md:inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  21 Ambulancias • Talleres Externos
                </span>
              </div>
              <p className="hidden sm:block text-[11px] sm:text-xs text-slate-400 truncate">
                Disponibilidad, vencimientos 30/15/7d, órdenes a talleres externos y stock propio
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Selector de Rol: Encargado (todo) / Operador (flota, incidencias, stock, checklists) */}
            <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs">
              <UserCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <select
                value={currentRole}
                onChange={(e) => {
                  const nextRole = e.target.value as UserRole;
                  if (nextRole === 'Encargado' && currentRole === 'Operador') {
                    setPinInput('');
                    setPinError('');
                    setShowPinModal(true);
                    return;
                  }
                  setCurrentRole(nextRole);
                  if (
                    nextRole === 'Operador' &&
                    (activeTab === 'workorders' ||
                      activeTab === 'workshops' ||
                      activeTab === 'preventive')
                  ) {
                    setActiveTab('dashboard');
                  }
                }}
                aria-label="Seleccionar rol de usuario"
                className="bg-transparent text-white font-bold text-[11px] sm:text-xs focus:outline-none cursor-pointer"
              >
                <option value="Encargado" className="text-slate-900">
                  Encargado
                </option>
                <option value="Operador" className="text-slate-900">
                  Operador
                </option>
              </select>
            </div>
            <span
              title={
                isOnline
                  ? 'PWA Conectada (Service Worker activo para uso offline)'
                  : 'Modo sin conexión activo: trabajando sobre caché local'
              }
              className={`px-2 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 border ${
                isOnline
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60'
                  : 'bg-amber-950/80 text-amber-300 border-amber-700'
              }`}
            >
              {isOnline ? (
                <>
                  <Wifi className="w-3.5 h-3.5" />
                  <span className="hidden xl:inline">
                    {realtimeLive ? 'Sync En Vivo' : 'Online PWA'}
                  </span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Offline</span>
                </>
              )}
            </span>

            <button
              type="button"
              onClick={() => setShowBackupModal(true)}
              className={`px-3 py-1.5 rounded-xl text-white text-xs font-bold flex items-center gap-1.5 ring-1 ring-white/15 shadow-sm transition ${
                storageStats.isWarning || quotaAlert
                  ? 'bg-amber-600 hover:bg-amber-500'
                  : 'bg-blue-600 hover:bg-blue-500'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Backup</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-black/25 font-mono">
                {storageStats.usagePercent}%
              </span>
            </button>
            <button
              type="button"
              onClick={handleLogout}
              title="Bloquear aplicación / Cerrar sesión"
              className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-rose-950/90 hover:bg-rose-900 text-rose-100 text-xs font-semibold flex items-center gap-1.5 border border-rose-700/80 shadow-sm transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 flex-1 space-y-4">
        {/* Aviso automático de límite de almacenamiento local */}
        {(storageStats.isWarning || quotaAlert) && (
          <div
            className={`p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs ${
              storageStats.isCritical || quotaAlert
                ? 'bg-rose-50 border-rose-300 text-rose-900'
                : 'bg-amber-50 border-amber-300 text-amber-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
              <div>
                <p className="font-bold">
                  Aviso de límite de almacenamiento local ({storageStats.usagePercent}% ocupado —{' '}
                  {formatBytes(storageStats.usedBytes)} de {formatBytes(storageStats.maxBytes)})
                </p>
                <p className="text-[11px] opacity-90">
                  Te recomendamos descargar una copia de seguridad JSON o limpiar fotografías antiguas para evitar alcanzar el tope del navegador.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDownloadJsonBackup}
              className="px-3 py-1.5 rounded-lg bg-slate-900 text-white font-bold hover:bg-slate-800 shrink-0"
            >
              Descargar Backup JSON Ahora
            </button>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <DashboardView
            ambulances={ambulances}
            preventiveSchedules={preventiveSchedules}
            checklists={checklists}
            workOrders={workOrders}
            spareParts={spareParts}
            onNavigate={setActiveTab}
            onCreateWorkOrderFromChecklist={handleCreateWorkOrderFromChecklist}
          />
        )}

        {activeTab === 'fleet' && (
          <FleetView
            ambulances={ambulances}
            spareParts={spareParts}
            workOrders={workOrders}
            checklists={checklists}
            preventiveSchedules={preventiveSchedules}
            stockMovements={stockMovements}
            workshops={workshops}
            initialSelectedAmbulanceId={qrSelectedAmbId}
            onAddAmbulance={handleAddAmbulance}
            onDeleteAmbulance={handleDeleteAmbulance}
            onUpdateStatus={handleUpdateAmbulanceStatus}
            onUpdateMileage={handleUpdateMileage}
            onUpdateLegalDates={handleUpdateLegalDates}
            onUpdateVehicleDocument={handleUpdateVehicleDocument}
            onUpdateBodyAndVisualState={handleUpdateBodyAndVisualState}
            onRestockVehiclePart={handleRestockVehiclePart}
            onUpdateVehiclePartQty={handleUpdateVehiclePartQty}
            onAddPartToVehicleOnboard={handleAddPartToVehicleOnboard}
            onRemovePartFromVehicleOnboard={handleRemovePartFromVehicleOnboard}
          />
        )}

        {activeTab === 'preventive' && (
          <PreventiveView
            ambulances={ambulances}
            schedules={preventiveSchedules}
            onAddSchedule={handleAddSchedule}
            onAddSchedulesBulk={handleAddSchedulesBulk}
            onUpdateSchedule={handleUpdateSchedule}
            onDeleteSchedule={handleDeleteSchedule}
            onCompletePreventive={handleCompletePreventive}
            onGenerateWorkOrderFromPreventive={
              handleGenerateWorkOrderFromPreventive
            }
          />
        )}

        {activeTab === 'checklist' && (
          <ChecklistView
            ambulances={ambulances}
            checklists={checklists}
            workOrders={workOrders}
            workshops={workshops}
            onSubmitChecklist={handleSubmitChecklist}
            onCreateWorkOrderFromChecklist={handleCreateWorkOrderFromChecklist}
          />
        )}

        {activeTab === 'workorders' && (
          <WorkOrdersView
            ambulances={ambulances}
            workshops={workshops}
            workOrders={workOrders}
            spareParts={spareParts}
            onCreateWorkOrder={handleCreateWorkOrder}
            onUpdateWorkOrderStatus={handleUpdateWorkOrderStatus}
            onAddPartToWorkOrder={handleAddPartToWorkOrder}
            onRemovePartFromWorkOrder={handleRemovePartFromWorkOrder}
            onUpdateWorkOrderDetails={handleUpdateWorkOrderDetails}
            onUpdateWorkOrderSignatureAndPhotos={
              handleUpdateWorkOrderSignatureAndPhotos
            }
          />
        )}

        {activeTab === 'workshops' && (
          <WorkshopsView
            workshops={workshops}
            workOrders={workOrders}
            ambulances={ambulances}
            currentRole={currentRole}
            onAddWorkshop={handleAddWorkshop}
            onUpdateWorkshop={handleUpdateWorkshop}
            onDeleteWorkshop={handleDeleteWorkshop}
          />
        )}

        {activeTab === 'parts' && (
          <PartsInventoryView
            spareParts={spareParts}
            ambulances={ambulances}
            stockMovements={stockMovements}
            onAddSparePart={handleAddSparePart}
            onUpdatePartStock={handleUpdatePartStock}
            onRecordCustomMovement={handleRecordCustomMovement}
            onRestockVehiclePart={handleRestockVehiclePart}
            onReceiveSupplierOrder={handleReceiveSupplierOrder}
          />
        )}
      </main>

      {/* Modal Backup Automático, Cuota de Almacenamiento y Sincronización (Fase 0) */}
      {showBackupModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-blue-600" />
                Backup Automático, Almacenamiento y Sincronización
              </h3>
              <button
                type="button"
                onClick={() => setShowBackupModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Medidor de almacenamiento LocalStorage */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex items-center justify-between font-bold text-slate-800">
                <span>Uso de Memoria Local (Offline Cache)</span>
                <span>
                  {formatBytes(storageStats.usedBytes)} / {formatBytes(storageStats.maxBytes)} ({storageStats.usagePercent}%)
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    storageStats.isCritical
                      ? 'bg-rose-600'
                      : storageStats.isWarning
                      ? 'bg-amber-500'
                      : 'bg-emerald-600'
                  }`}
                  style={{ width: `${Math.max(3, storageStats.usagePercent)}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Las fotos adjuntas se comprimen automáticamente (JPEG 640px) para proteger la cuota de almacenamiento offline.
              </p>
            </div>

            {/* Snapshot de Backup Automático Local */}
            {(() => {
              const autoSnap = loadAutoBackupSnapshot();
              return (
                <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="font-bold text-blue-950 flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5 text-blue-600" />
                      Punto de Restauración Automático Local
                    </span>
                    <span className="text-[11px] text-blue-700 block mt-0.5">
                      {autoSnap
                        ? `Última copia automática: ${new Date(autoSnap.timestamp).toLocaleString('es-ES')}`
                        : 'Se genera automáticamente con cada cambio.'}
                    </span>
                  </div>
                  {autoSnap && (
                    <button
                      type="button"
                      onClick={handleRestoreAutoBackup}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold"
                    >
                      Restaurar Punto
                    </button>
                  )}
                </div>
              );
            })()}

            {/* Exportar / Importar Archivo JSON y CSV */}
            <div className="space-y-2.5 text-xs">
              <button
                type="button"
                onClick={handleDownloadJsonBackup}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Descargar Copia de Seguridad Completa (.JSON)
              </button>

              <label className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold flex items-center justify-center gap-2 cursor-pointer">
                <Upload className="w-4 h-4 text-blue-600" />
                <span>Cargar / Restaurar Copia desde Archivo (.JSON)</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportJsonBackup}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={() => exportFleetAndStockToCSV(ambulances, spareParts)}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-2"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Exportar Flota (21) y Stock a Excel (.CSV)
              </button>
            </div>

            {/* Sincronización Nube 2 Usuarios en Firebase (Proyecto: gestion-ambulancias-flota) */}
            <div className="pt-3 border-t border-slate-200 space-y-2.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Cloud className="w-4 h-4 text-amber-500" />
                  Sincronización en la Nube con Firebase (2 Usuarios)
                </span>
                <a
                  href={DEFAULT_FIREBASE_CONFIG.hostingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-bold text-blue-600 hover:underline"
                >
                  Abrir App en Firebase Hosting ↗
                </a>
              </div>

              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-700">
                    Proyecto Firebase:{' '}
                    <strong className="font-mono text-slate-900">
                      {cloudConfig.firebaseProjectId}
                    </strong>
                  </span>
                  {cloudConfig.lastSyncedAt && (
                    <span className="text-emerald-700 font-bold">
                      Última sync:{' '}
                      {new Date(cloudConfig.lastSyncedAt).toLocaleTimeString(
                        'es-ES'
                      )}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isSyncingFirebase}
                    onClick={handlePushToFirebase}
                    className="py-2 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Subir Datos a Firebase
                  </button>
                  <button
                    type="button"
                    disabled={isSyncingFirebase}
                    onClick={handlePullFromFirebase}
                    className="py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Descargar desde Firebase
                  </button>
                </div>

                {firebaseStatusMsg && (
                  <p className="text-[11px] font-medium text-slate-700 bg-white/90 p-2 rounded-lg border border-amber-200">
                    {firebaseStatusMsg}
                  </p>
                )}
              </div>
            </div>

            {/* Configuración del PIN rápido de 4 dígitos para el rol Encargado */}
            {currentRole === 'Encargado' && (
              <div className="pt-3 border-t border-slate-200 space-y-2 text-xs">
                <span className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-blue-600" />
                  PIN de Seguridad Rol Encargado (4 dígitos)
                </span>
                <div className="flex gap-2">
                  <input
                    type="password"
                    maxLength={4}
                    inputMode="numeric"
                    value={newPinInput}
                    onChange={(e) => {
                      setNewPinInput(e.target.value.replace(/\D/g, '').slice(0, 4));
                      setPinSavedMsg('');
                    }}
                    placeholder="Nuevo PIN (4 dígitos, por defecto 1978)"
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-300 bg-slate-50 font-mono font-bold"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await updateManagerPin(newPinInput);
                      if (ok) {
                        setNewPinInput('');
                        setPinSavedMsg('✅ PIN de Encargado actualizado.');
                      } else {
                        setPinSavedMsg('⚠️ Introduce exactamente 4 dígitos numéricos.');
                      }
                    }}
                    className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold"
                  >
                    Guardar PIN
                  </button>
                </div>
                {pinSavedMsg && (
                  <p className="text-[11px] font-semibold text-slate-700">{pinSavedMsg}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal PIN Rápido de Seguridad para cambiar a Rol Encargado */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xs w-full p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-blue-600" />
                PIN de Encargado
              </h3>
              <button
                type="button"
                onClick={() => setShowPinModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Introduce el PIN de 4 dígitos para activar el rol{' '}
              <strong>Encargado</strong> (por defecto: <code className="font-mono">1978</code>).
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const now = Date.now();
                if (pinLockUntil > now) {
                  const secs = Math.ceil((pinLockUntil - now) / 1000);
                  setPinError(`Demasiados intentos. Espera ${secs}s.`);
                  return;
                }
                const valid = await verifyManagerPin(pinInput);
                if (valid) {
                  setPinFailedAttempts(0);
                  setPinLockUntil(0);
                  setCurrentRole('Encargado');
                  setShowPinModal(false);
                  setPinInput('');
                  setPinError('');
                } else {
                  const nextFails = pinFailedAttempts + 1;
                  setPinFailedAttempts(nextFails);
                  if (nextFails >= 5) {
                    setPinLockUntil(Date.now() + 30000);
                    setPinFailedAttempts(0);
                    setPinError('PIN bloqueado 30 segundos por seguridad.');
                  } else {
                    setPinError('PIN incorrecto. Debe tener 4 dígitos válidos.');
                  }
                }
              }}
              className="space-y-3 text-xs"
            >
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                autoFocus
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4));
                  if (pinError) setPinError('');
                }}
                placeholder="••••"
                className="w-full text-center tracking-[0.6em] text-lg font-extrabold px-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50"
              />
              {pinError && (
                <p className="text-rose-600 font-bold text-center">{pinError}</p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold"
                >
                  Desbloquear
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
