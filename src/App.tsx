import React, { useState, useEffect } from 'react';
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
  saveAutoBackupSnapshot,
  loadAutoBackupSnapshot,
  getCloudSyncConfig,
  saveCloudSyncConfig,
  formatBytes,
} from './utils/storage';
import {
  DEFAULT_FIREBASE_CONFIG,
  pushFleetStateToFirebase,
  pullFleetStateFromFirebase,
} from './utils/firebaseSync';
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
  const byId = new Map<string, Ambulance>();
  saved.forEach((a) =>
    byId.set(a.id, {
      ...a,
      status: normalizeAmbulanceStatus(a.status),
      documents: ensureAmbulanceDocuments(a),
    })
  );
  INITIAL_AMBULANCES.forEach((initAmb) => {
    if (!byId.has(initAmb.id) && saved.length <= 5) {
      byId.set(initAmb.id, {
        ...initAmb,
        status: normalizeAmbulanceStatus(initAmb.status),
        documents: ensureAmbulanceDocuments(initAmb),
      });
    }
  });
  return Array.from(byId.values());
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
  const maxNum = existingOrders.reduce((max, wo) => {
    const match = wo.code.match(/(\d+)$/);
    const num = match ? parseInt(match[1], 10) : 0;
    return num > max ? num : max;
  }, 0);
  return `OR-2026-${String(maxNum + 1).padStart(3, '0')}`;
};

const AUTH_SESSION_KEY = `${STORAGE_KEY}_authenticated`;

const verifyAccessPassword = async (input: string): Promise<boolean> => {
  const normalized = input.trim().toLowerCase();
  return normalized === 'mahay1978';
};

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
  }, [
    ambulances,
    workshops,
    preventiveSchedules,
    checklists,
    workOrders,
    spareParts,
    stockMovements,
  ]);

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
    if (!partInfo) return;

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
                    requiredQty: p.requiredQty + requiredQty,
                    currentQty: p.currentQty + currentQty,
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
              requiredQty,
              currentQty,
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

  const handleCompletePreventive = (scheduleId: string) => {
    const sched = preventiveSchedules.find((s) => s.id === scheduleId);
    if (!sched) return;
    const amb = ambulances.find((a) => a.id === sched.ambulanceId);
    const currentKm = amb?.mileage || sched.lastDoneKm || 100000;
    const today = new Date().toISOString().split('T')[0];

    const nextDate = new Date();
    nextDate.setMonth(nextDate.getMonth() + (sched.intervalMonths || 6));

    setPreventiveSchedules((prev) =>
      prev.map((s) =>
        s.id === scheduleId
          ? {
              ...s,
              lastDoneKm: currentKm,
              nextDueKm: s.intervalKm ? currentKm + s.intervalKm : undefined,
              lastDoneDate: today,
              nextDueDate: nextDate.toISOString().split('T')[0],
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
    if (part) {
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
      >
    >
  ) => {
    setWorkOrders((prev) =>
      prev.map((wo) => (wo.id === woId ? { ...wo, ...patch } : wo))
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
    if (part) {
      recordStockMovement(
        part,
        'Ajuste',
        delta,
        `Almacén (${part.warehouseLocation})`,
        `${currentRole} de Flota`,
        notes || 'Ajuste de inventario en almacén'
      );
    }
    setSpareParts((prev) =>
      prev.map((p) =>
        p.id === partId
          ? { ...p, stockQuantity: Math.max(0, p.stockQuantity + delta) }
          : p
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
    a.download = `ambufleet_copia_seguridad_${
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
        if (data.ambulances)
          setAmbulances(hydrateAmbulancesWithFullFleet(data.ambulances));
        if (data.workshops) setWorkshops(data.workshops);
        if (data.preventiveSchedules)
          setPreventiveSchedules(data.preventiveSchedules);
        if (data.checklists) setChecklists(data.checklists);
        if (data.workOrders) setWorkOrders(hydrateWorkOrders(data.workOrders));
        if (data.spareParts) setSpareParts(hydrateSpareParts(data.spareParts));
        if (data.stockMovements) setStockMovements(data.stockMovements);
        setShowBackupModal(false);
      } catch {
        alert('El archivo seleccionado no es una copia de seguridad válida.');
      }
    };
    reader.readAsText(file);
  };

  const handleRestoreAutoBackup = () => {
    const snap = loadAutoBackupSnapshot<{
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
    const valid = await verifyAccessPassword(passwordInput);
    if (valid) {
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
      setAuthError('Contraseña incorrecta. Verifica mayúsculas y números.');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setPasswordInput('');
    try {
      sessionStorage.removeItem(AUTH_SESSION_KEY);
      localStorage.removeItem(AUTH_SESSION_KEY);
    } catch {
      // Ignorar errores de storage
    }
  };

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
                AmbuFleet <span className="text-rose-600">Flota</span>
              </h1>
              <p className="text-xs text-slate-500">
                Gestión de 21 Ambulancias y Talleres Externos
              </p>
            </div>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
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
              Entrar a AmbuFleet
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col pb-24 lg:pb-6">
      {/* Top Navbar adaptada a Móvil, Tablet y Escritorio */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 safe-top shadow-md">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-rose-600 flex items-center justify-center shadow-sm shrink-0">
              <Activity className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-lg font-extrabold tracking-tight truncate">
                  AmbuFleet <span className="text-rose-400">Flota</span>
                </h1>
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
                  <span className="hidden xl:inline">Online PWA</span>
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
              className={`px-2.5 py-1.5 rounded-lg text-white text-xs font-semibold flex items-center gap-1 transition ${
                storageStats.isWarning || quotaAlert
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Backup</span>
              <span className="text-[10px] px-1 py-0.2 rounded bg-black/25 font-mono">
                {storageStats.usagePercent}%
              </span>
            </button>
            <button
              onClick={handleResetDemoData}
              title="Restaurar datos de ejemplo iniciales (21 ambulancias)"
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 border border-slate-700 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Demo</span>
            </button>
            <button
              type="button"
              onClick={handleLogout}
              title="Bloquear aplicación / Cerrar sesión"
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-200 text-xs font-medium flex items-center gap-1 border border-rose-800 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Salir</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs (Tablet Horizontal y Escritorio >= 1024px) */}
        <div className="hidden lg:flex max-w-7xl mx-auto px-4 sm:px-6 items-center gap-1.5 overflow-x-auto no-scrollbar pb-2">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 shrink-0 transition ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      isActive
                        ? 'bg-white text-blue-700'
                        : 'bg-slate-700 text-slate-200'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Bottom Navigation Bar Táctil (Móvil y Tablet Vertical < 1024px) con scroll horizontal suave si hay 7 pestañas */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-slate-900/95 backdrop-blur-md text-white border-t border-slate-800 z-50 px-1.5 pt-1.5 safe-bottom shadow-2xl">
        <div className="flex items-center justify-around gap-1 overflow-x-auto no-scrollbar">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`relative flex-1 min-w-[60px] sm:min-w-[84px] flex flex-col items-center justify-center py-2 px-1.5 rounded-xl transition ${
                  isActive
                    ? 'bg-blue-600 text-white font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 active:bg-slate-800'
                }`}
              >
                {item.icon}
                <span className="text-[10px] sm:text-[11px] mt-1 tracking-tight truncate max-w-full">
                  {item.shortLabel}
                </span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`absolute top-1 right-1.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-extrabold flex items-center justify-center ${
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
        </div>
      </nav>

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
            onAddAmbulance={handleAddAmbulance}
            onDeleteAmbulance={handleDeleteAmbulance}
            onUpdateStatus={handleUpdateAmbulanceStatus}
            onUpdateMileage={handleUpdateMileage}
            onUpdateLegalDates={handleUpdateLegalDates}
            onUpdateVehicleDocument={handleUpdateVehicleDocument}
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
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
