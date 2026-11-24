import React, { useState, useEffect } from 'react';
import {
  Ambulance,
  AmbulanceStatus,
  FleetChecklist,
  PreventiveSchedule,
  SparePart,
  WorkOrder,
  WorkOrderStatus,
} from './types';
import {
  INITIAL_AMBULANCES,
  INITIAL_CHECKLISTS,
  INITIAL_PREVENTIVE_SCHEDULES,
  INITIAL_SPARE_PARTS,
  INITIAL_WORK_ORDERS,
} from './initialData';
import { DashboardView } from './components/DashboardView';
import { FleetView } from './components/FleetView';
import { PreventiveView } from './components/PreventiveView';
import { ChecklistView } from './components/ChecklistView';
import { WorkOrdersView } from './components/WorkOrdersView';
import { PartsInventoryView } from './components/PartsInventoryView';
import {
  LayoutDashboard,
  Truck,
  CalendarClock,
  ClipboardCheck,
  Wrench,
  Package,
  RotateCcw,
  Activity,
} from 'lucide-react';

type ActiveTab =
  | 'dashboard'
  | 'fleet'
  | 'preventive'
  | 'checklist'
  | 'workorders'
  | 'parts';

const STORAGE_KEY = 'ambufleet_mechanics_v1';

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  const [ambulances, setAmbulances] = useState<Ambulance[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_ambulances`);
    return saved ? JSON.parse(saved) : INITIAL_AMBULANCES;
  });

  const [preventiveSchedules, setPreventiveSchedules] = useState<
    PreventiveSchedule[]
  >(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_preventive`);
    return saved ? JSON.parse(saved) : INITIAL_PREVENTIVE_SCHEDULES;
  });

  const [checklists, setChecklists] = useState<FleetChecklist[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_checklists`);
    return saved ? JSON.parse(saved) : INITIAL_CHECKLISTS;
  });

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_workorders`);
    return saved ? JSON.parse(saved) : INITIAL_WORK_ORDERS;
  });

  const [spareParts, setSpareParts] = useState<SparePart[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_parts`);
    return saved ? JSON.parse(saved) : INITIAL_SPARE_PARTS;
  });

  // Persistencia automática en LocalStorage
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_ambulances`, JSON.stringify(ambulances));
  }, [ambulances]);

  useEffect(() => {
    localStorage.setItem(
      `${STORAGE_KEY}_preventive`,
      JSON.stringify(preventiveSchedules)
    );
  }, [preventiveSchedules]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_checklists`, JSON.stringify(checklists));
  }, [checklists]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_workorders`, JSON.stringify(workOrders));
  }, [workOrders]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_parts`, JSON.stringify(spareParts));
  }, [spareParts]);

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

  // Reponer pieza de la dotación a bordo de una ambulancia descontando del almacén
  const handleRestockVehiclePart = (ambulanceId: string, partId: string) => {
    const amb = ambulances.find((a) => a.id === ambulanceId);
    if (!amb) return;
    const onboard = amb.onboardParts.find((p) => p.partId === partId);
    if (!onboard) return;
    const needed = onboard.requiredQty - onboard.currentQty;
    if (needed <= 0) return;

    setSpareParts((prev) =>
      prev.map((sp) =>
        sp.id === partId
          ? { ...sp, stockQuantity: Math.max(0, sp.stockQuantity - needed) }
          : sp
      )
    );

    setAmbulances((prev) =>
      prev.map((a) =>
        a.id === ambulanceId
          ? {
              ...a,
              onboardParts: a.onboardParts.map((p) =>
                p.partId === partId ? { ...p, currentQty: p.requiredQty } : p
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

    const newWo: WorkOrder = {
      id: `wo-${Date.now()}`,
      code: `OT-2026-00${workOrders.length + 1}`,
      ambulanceId: amb.id,
      type: 'Preventivo',
      priority: 'Alta',
      status: 'Pendiente',
      title: `Mantenimiento Preventivo: ${sched.title}`,
      description: `Programado desde el plan preventivo (${sched.category}). ${
        sched.notes || ''
      }`,
      reportedBy: 'Sistema de Alertas Preventivas',
      assignedMechanic: 'Javier Ortega (Jefe de Taller)',
      createdAt: new Date().toISOString().split('T')[0],
      mileageAtEntry: amb.mileage,
      laborHours: 2.0,
      laborHourlyRate: 48,
      partsUsed: [],
      mechanicDiagnosis: '',
    };

    setWorkOrders((prev) => [newWo, ...prev]);
    handleUpdateAmbulanceStatus(amb.id, 'En Taller');
    setActiveTab('workorders');
  };

  // --- Handlers Checklist Responsable de Flota ---
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

    const newWoId = `wo-${Date.now()}`;
    const newWo: WorkOrder = {
      id: newWoId,
      code: `OT-2026-00${workOrders.length + 1}`,
      ambulanceId: amb.id,
      type: 'Inspección Responsable Flota',
      priority:
        chk.overallUrgency === 'Inmovilización Inmediata'
          ? 'Crítica (Urgente)'
          : chk.overallUrgency === 'Prioritaria'
          ? 'Alta'
          : 'Media',
      status: 'En Diagnóstico',
      title: `Inspección Flota (${amb.code}): ${
        faultItems.length > 0
          ? faultItems[0].label
          : 'Reposición de Stock y Revisión General'
      }`,
      description: `${chk.generalObservations}. Detalle puntos: ${faultSummary}${missingSummary}`,
      reportedBy: chk.inspectorName,
      assignedMechanic: 'Javier Ortega (Jefe de Taller)',
      createdAt: new Date().toISOString().split('T')[0],
      mileageAtEntry: chk.mileageAtInspection,
      laborHours: 1.5,
      laborHourlyRate: 48,
      partsUsed: [],
      mechanicDiagnosis: '',
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
              workshopStatus: 'Orden de Trabajo Creada',
              linkedWorkOrderId: newWoId,
            }
          : c
      )
    );
    handleUpdateAmbulanceStatus(amb.id, 'En Taller');
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

    // Actualizar kilometraje y stock real verificado en la ambulancia
    setAmbulances((prev) =>
      prev.map((a) => {
        if (a.id !== checklistData.ambulanceId) return a;
        return {
          ...a,
          mileage: Math.max(a.mileage, checklistData.mileageAtInspection),
          status: autoCreateWorkOrder
            ? 'En Taller'
            : checklistData.items.some((i) => i.status === 'Avería')
            ? 'Revisión Pendiente'
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

  // --- Handlers Órdenes de Trabajo ---
  const handleCreateWorkOrder = (woData: Omit<WorkOrder, 'id' | 'code'>) => {
    const newWo: WorkOrder = {
      ...woData,
      id: `wo-${Date.now()}`,
      code: `OT-2026-00${workOrders.length + 1}`,
    };
    setWorkOrders((prev) => [newWo, ...prev]);
    handleUpdateAmbulanceStatus(woData.ambulanceId, 'En Taller');
  };

  const handleUpdateWorkOrderStatus = (woId: string, status: WorkOrderStatus) => {
    const wo = workOrders.find((w) => w.id === woId);
    setWorkOrders((prev) =>
      prev.map((w) =>
        w.id === woId
          ? {
              ...w,
              status,
              completedAt:
                status === 'Finalizada'
                  ? new Date().toISOString().split('T')[0]
                  : w.completedAt,
            }
          : w
      )
    );

    // Si la OT pasa a Finalizada, la ambulancia vuelve a estar Activa y actualiza fecha de última revisión
    if (wo && status === 'Finalizada') {
      const today = new Date().toISOString().split('T')[0];
      setAmbulances((prev) =>
        prev.map((a) =>
          a.id === wo.ambulanceId
            ? {
                ...a,
                status: 'Activa',
                lastServiceDate: today,
                lastServiceMileage: a.mileage,
              }
            : a
        )
      );
    }
  };

  const handleAddPartToWorkOrder = (
    woId: string,
    partId: string,
    quantity: number
  ) => {
    const part = spareParts.find((p) => p.id === partId);
    if (!part) return;

    // Descontar del inventario de taller
    setSpareParts((prev) =>
      prev.map((p) =>
        p.id === partId
          ? { ...p, stockQuantity: Math.max(0, p.stockQuantity - quantity) }
          : p
      )
    );

    // Añadir a la OT
    setWorkOrders((prev) =>
      prev.map((wo) =>
        wo.id === woId
          ? {
              ...wo,
              partsUsed: [
                ...wo.partsUsed,
                {
                  partId: part.id,
                  partName: part.name,
                  sku: part.sku,
                  quantity,
                  unitCost: part.unitCost,
                },
              ],
            }
          : wo
      )
    );
  };

  const handleUpdateWorkOrderDetails = (
    woId: string,
    laborHours: number,
    mechanicDiagnosis: string
  ) => {
    setWorkOrders((prev) =>
      prev.map((wo) =>
        wo.id === woId ? { ...wo, laborHours, mechanicDiagnosis } : wo
      )
    );
  };

  const handleUpdateWorkOrderSignatureAndPhotos = (
    woId: string,
    mechanicSignature?: string,
    newPhotoUrl?: string
  ) => {
    setWorkOrders((prev) =>
      prev.map((wo) => {
        if (wo.id !== woId) return wo;
        return {
          ...wo,
          mechanicSignature:
            mechanicSignature !== undefined
              ? mechanicSignature || undefined
              : wo.mechanicSignature,
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

  const handleUpdatePartStock = (partId: string, delta: number) => {
    setSpareParts((prev) =>
      prev.map((p) =>
        p.id === partId
          ? { ...p, stockQuantity: Math.max(0, p.stockQuantity + delta) }
          : p
      )
    );
  };

  const handleResetDemoData = () => {
    localStorage.removeItem(`${STORAGE_KEY}_ambulances`);
    localStorage.removeItem(`${STORAGE_KEY}_preventive`);
    localStorage.removeItem(`${STORAGE_KEY}_checklists`);
    localStorage.removeItem(`${STORAGE_KEY}_workorders`);
    localStorage.removeItem(`${STORAGE_KEY}_parts`);
    setAmbulances(INITIAL_AMBULANCES);
    setPreventiveSchedules(INITIAL_PREVENTIVE_SCHEDULES);
    setChecklists(INITIAL_CHECKLISTS);
    setWorkOrders(INITIAL_WORK_ORDERS);
    setSpareParts(INITIAL_SPARE_PARTS);
  };

  const navItems: {
    id: ActiveTab;
    label: string;
    shortLabel: string;
    icon: React.ReactNode;
    badge?: number;
  }[] = [
    {
      id: 'dashboard',
      label: 'Panel General',
      shortLabel: 'Inicio',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: 'fleet',
      label: 'Flota y Stock Vehículo',
      shortLabel: 'Flota',
      icon: <Truck className="w-4 h-4" />,
      badge: ambulances.length,
    },
    {
      id: 'checklist',
      label: 'Checklist Resp. Flota',
      shortLabel: 'Checklist',
      icon: <ClipboardCheck className="w-4 h-4" />,
      badge: checklists.filter(
        (c) => c.workshopStatus === 'Pendiente de Revisión Taller'
      ).length,
    },
    {
      id: 'workorders',
      label: 'Órdenes de Taller (OT)',
      shortLabel: 'Taller OT',
      icon: <Wrench className="w-4 h-4" />,
      badge: workOrders.filter((w) => w.status !== 'Finalizada').length,
    },
    {
      id: 'preventive',
      label: 'Mantenimiento Preventivo',
      shortLabel: 'Preventivo',
      icon: <CalendarClock className="w-4 h-4" />,
    },
    {
      id: 'parts',
      label: 'Inventario de Repuestos',
      shortLabel: 'Stock',
      icon: <Package className="w-4 h-4" />,
      badge: spareParts.filter((p) => p.stockQuantity <= p.minStockAlert).length,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col pb-20 md:pb-6">
      {/* Top Navbar */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-rose-600 flex items-center justify-center shadow-sm shrink-0">
              <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-extrabold tracking-tight">
                  AmbuFleet <span className="text-rose-400">Mecánica</span>
                </h1>
                <span className="hidden sm:inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  Gestión de Taller y Flota Sanitaria
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 line-clamp-1">
                Checklists a pie de ambulancia, taller y stock de piezas por vehículo
              </p>
            </div>
          </div>

          <button
            onClick={handleResetDemoData}
            title="Restaurar datos de ejemplo iniciales"
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 border border-slate-700 transition shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Restaurar Demo</span>
          </button>
        </div>

        {/* Navigation Tabs (Desktop & Tablet Landscape) */}
        <div className="hidden md:flex max-w-7xl mx-auto px-4 sm:px-6 items-center gap-1 overflow-x-auto pb-2">
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

      {/* Bottom Navigation Bar (Móvil y Tablet Vertical) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-slate-900/95 backdrop-blur-md text-white border-t border-slate-800 z-50 px-1 py-1.5 grid grid-cols-6 gap-0.5 shadow-2xl">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`relative flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition ${
                isActive
                  ? 'bg-blue-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {item.icon}
              <span className="text-[10px] mt-1 tracking-tight truncate max-w-full">
                {item.shortLabel}
              </span>
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className={`absolute top-0.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-extrabold flex items-center justify-center ${
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

      {/* Main Content */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 flex-1">
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
            onAddAmbulance={handleAddAmbulance}
            onDeleteAmbulance={handleDeleteAmbulance}
            onUpdateStatus={handleUpdateAmbulanceStatus}
            onUpdateMileage={handleUpdateMileage}
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
            workOrders={workOrders}
            spareParts={spareParts}
            onCreateWorkOrder={handleCreateWorkOrder}
            onUpdateWorkOrderStatus={handleUpdateWorkOrderStatus}
            onAddPartToWorkOrder={handleAddPartToWorkOrder}
            onUpdateWorkOrderDetails={handleUpdateWorkOrderDetails}
            onUpdateWorkOrderSignatureAndPhotos={
              handleUpdateWorkOrderSignatureAndPhotos
            }
          />
        )}

        {activeTab === 'parts' && (
          <PartsInventoryView
            spareParts={spareParts}
            ambulances={ambulances}
            onAddSparePart={handleAddSparePart}
            onUpdatePartStock={handleUpdatePartStock}
            onRestockVehiclePart={handleRestockVehiclePart}
          />
        )}
      </main>
    </div>
  );
}

export default App;
