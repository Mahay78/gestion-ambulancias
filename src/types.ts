export type AmbulanceStatus = 'Activa' | 'En Taller' | 'Fuera de Servicio' | 'Revisión Pendiente';
export type AmbulanceType = 'SVA (UVI Móvil)' | 'SVB (Soporte Vital Básico)' | 'TNA (Transporte No Asistido)';

export type DocumentType =
  | 'ITV'
  | 'Seguro'
  | 'Certificado Técnico-Sanitario'
  | 'Tacógrafo'
  | 'Ficha Técnica';

export interface VehicleDocument {
  id: string;
  type: DocumentType;
  number: string;
  issueDate: string; // YYYY-MM-DD
  expiryDate: string; // YYYY-MM-DD
  fileName?: string;
  fileDataUrl?: string;
  notes?: string;
}

export interface VehicleOnboardPart {
  partId: string;
  partName: string;
  requiredQty: number;
  currentQty: number;
}

export interface Ambulance {
  id: string;
  code: string; // ej. AMB-01 .. AMB-21
  plate: string; // Matrícula
  brand: string;
  model: string;
  year: number;
  vin: string;
  type: AmbulanceType;
  status: AmbulanceStatus;
  mileage: number; // Kilometraje actual
  baseLocation: string;
  fuelType: 'Diésel' | 'Diésel + AdBlue' | 'Híbrido' | 'Eléctrico';
  itvExpiry: string; // YYYY-MM-DD
  sanitaryCertExpiry: string; // YYYY-MM-DD
  insuranceExpiry: string; // YYYY-MM-DD
  documents?: VehicleDocument[];
  lastServiceDate: string;
  lastServiceMileage: number;
  notes: string;
  onboardParts: VehicleOnboardPart[];
}

export type PreventiveCategory =
  | 'Aceite y Filtros'
  | 'Sistema de Frenos'
  | 'Neumáticos y Alineación'
  | 'Correa / Distribución'
  | 'Sistema Eléctrico y Baterías'
  | 'Suspensión y Dirección'
  | 'Climatización y Célula Sanitaria'
  | 'ITV / Legal';

export interface PreventiveSchedule {
  id: string;
  ambulanceId: string;
  category: PreventiveCategory;
  title: string;
  intervalKm?: number;
  lastDoneKm?: number;
  nextDueKm?: number;
  intervalMonths?: number;
  lastDoneDate: string;
  nextDueDate?: string;
  estimatedCost: number;
  notes?: string;
}

export type ChecklistItemStatus = 'OK' | 'Observación' | 'Avería';

export interface ChecklistItem {
  id: string;
  section: 'Motor y Niveles' | 'Frenos, Dirección y Suspensión' | 'Neumáticos y Carrocería' | 'Electricidad, Baterías y Prioritarios' | 'Célula Sanitaria y Camilla';
  label: string;
  status: ChecklistItemStatus;
  comment: string;
  photoUrl?: string;
}

export interface MissingVehiclePartReport {
  partId: string;
  partName: string;
  missingQty: number;
  actionRequired: 'Reponer en vehículo' | 'Sustituir en taller';
}

export interface FleetChecklist {
  id: string;
  ambulanceId: string;
  date: string;
  inspectorName: string;
  mileageAtInspection: number;
  overallUrgency: 'Normal' | 'Prioritaria' | 'Inmovilización Inmediata';
  items: ChecklistItem[];
  missingParts: MissingVehiclePartReport[];
  generalObservations: string;
  workshopStatus: 'Pendiente de Revisión Taller' | 'Orden de Trabajo Creada' | 'Archivada / OK';
  linkedWorkOrderId?: string;
  photos?: string[];
  inspectorSignature?: string;
}

export type WorkOrderStatus = 'Pendiente' | 'En Diagnóstico' | 'Esperando Repuestos' | 'En Reparación' | 'Finalizada';
export type WorkOrderPriority = 'Baja' | 'Media' | 'Alta' | 'Crítica (Urgente)';
export type WorkOrderType = 'Correctivo (Avería)' | 'Preventivo' | 'Inspección Responsable Flota' | 'ITV / Pre-ITV';

export interface WorkOrderPartUsed {
  partId: string;
  partName: string;
  sku: string;
  quantity: number;
  unitCost: number;
}

export interface WorkOrder {
  id: string;
  code: string;
  ambulanceId: string;
  type: WorkOrderType;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  title: string;
  description: string;
  reportedBy: string;
  assignedMechanic: string;
  createdAt: string;
  completedAt?: string;
  mileageAtEntry: number;
  laborHours: number;
  laborHourlyRate: number;
  partsUsed: WorkOrderPartUsed[];
  mechanicDiagnosis: string;
  sourceChecklistId?: string;
  photos?: string[];
  inspectorSignature?: string;
  mechanicSignature?: string;
}

export type PartCategory =
  | 'Filtros y Lubricantes'
  | 'Frenos'
  | 'Eléctrico y Prioritarios'
  | 'Motor y Transmisión'
  | 'Suspensión y Neumáticos'
  | 'Carrocería y Célula Sanitaria'
  | 'Dotación a Bordo Vehículo';

export interface SparePart {
  id: string;
  sku: string;
  name: string;
  category: PartCategory;
  compatibleModels: string[];
  stockQuantity: number;
  minStockAlert: number;
  unitCost: number;
  locationInWorkshop: string;
  supplier: string;
  isVehicleOnboardStandard: boolean;
}

export type StockMovementType =
  | 'Salida a Orden de Taller'
  | 'Reposición a Bordo Vehículo'
  | 'Entrada Pedido Proveedor'
  | 'Ajuste Manual Almacén';

export interface StockMovement {
  id: string;
  date: string;
  partId: string;
  partName: string;
  sku: string;
  type: StockMovementType;
  quantityChange: number; // negativo para salidas, positivo para entradas
  targetReference: string; // ej. "AMB-02 (9104-KTR) • OT-2026-001"
  performedBy: string;
}
