export type UserRole = 'Encargado' | 'Operador';

export type AmbulanceStatus = 'Disponible' | 'En taller' | 'Fuera de servicio';
export type AmbulanceType = 'SVA (UVI Móvil)' | 'SVB (Soporte Vital Básico)' | 'TNA (Transporte No Asistido)';

export type DocumentType =
  | 'ITV'
  | 'Seguro'
  | 'Certificado Técnico-Sanitario'
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
  category?: string;
  requiredQty: number;
  currentQty: number;
  status?: 'OK' | 'Falta';
  notes?: string;
}

export type BodyView =
  | 'frontal'
  | 'trasera'
  | 'lateral_izq'
  | 'lateral_der'
  | 'techo';

export type BodyDamageType =
  | 'Roce'
  | 'Golpe'
  | 'Luna / Cristal'
  | 'Óptica / Prioritario'
  | 'Otro';

export interface BodyDamageMark {
  id: string;
  view: BodyView;
  xPercent: number;
  yPercent: number;
  type: BodyDamageType;
  moment: 'Campa' | 'Antes de taller' | 'Después de taller';
  note: string;
  date: string;
  repaired?: boolean;
}

export type TirePosition = 'FL' | 'FR' | 'RL' | 'RR' | 'SPARE';

export interface TireStatus {
  position: TirePosition;
  label: string;
  treadDepthMm: number;
  pressureBar: number;
  condition: 'OK' | 'Desgaste' | 'Crítico (<3mm)';
  lastCheckDate: string;
}

export interface DualBatteryStatus {
  starterVoltage: number;
  starterStatus: 'OK' | 'Baja (<12.3V)' | 'Crítica';
  auxVoltage: number;
  auxStatus: 'OK' | 'Baja (<12.2V)' | 'Crítica';
  auxType: string;
  lastCheckDate: string;
  notes?: string;
}

export interface BoardTask {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
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
  bodyDamages?: BodyDamageMark[];
  tires?: TireStatus[];
  batteries?: DualBatteryStatus;
  boardTasks?: BoardTask[];
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
  workshopStatus:
    | 'Pendiente de Asignar Taller'
    | 'Orden Externa Creada'
    | 'Archivada / OK'
    | 'Cerrada / Resuelta';
  linkedWorkOrderId?: string;
  sentItemIds?: string[];
  photos?: string[];
  inspectorSignature?: string;
  closedAt?: string;
  closedBy?: string;
  closingResolution?: string;
}

export interface ClosedReportRecord {
  id: string;
  checklistId: string;
  ambulanceId: string;
  ambulanceCode: string;
  plate: string;
  reportDate: string;
  closedAt: string;
  closedAtIso: string;
  reporterName: string;
  closedBy: string;
  mileage: number;
  urgency: FleetChecklist['overallUrgency'];
  summary: string;
  anomalies: string[];
  resolution: string;
  closureType: 'Cierre Directo' | 'Orden de Taller';
  linkedWorkOrderCode?: string;
  workshopName?: string;
}

export type WorkshopSpecialty =
  | 'Mecánica General'
  | 'Electricidad y Prioritarios'
  | 'Carrozado Sanitario'
  | 'Neumáticos y Frenos'
  | 'Chapa y Pintura'
  | 'Servicio Oficial Marca';

export interface ExternalWorkshop {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  specialty: WorkshopSpecialty;
  zone: string;
  notes: string;
}

export type WorkOrderStatus =
  | 'Reportada'
  | 'Asignada'
  | 'En taller'
  | 'Reparada'
  | 'Cerrada';

export type WorkOrderPriority = 'Baja' | 'Media' | 'Alta' | 'Crítica (Urgente)';
export type WorkOrderType =
  | 'Correctivo (Avería)'
  | 'Preventivo'
  | 'Incidencia / Checklist'
  | 'ITV / Pre-ITV';

export interface WorkOrderPartUsed {
  partId: string;
  partName: string;
  sku: string;
  quantity: number;
  deductedFromStock?: boolean;
}

export interface WorkOrder {
  id: string;
  code: string;
  ambulanceId: string;
  workshopId: string; // Taller externo asignado
  type: WorkOrderType;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  title: string; // Motivo principal
  description: string;
  reportedBy: string;
  createdAt: string;
  entryDate: string; // Fecha entrada al taller externo (YYYY-MM-DD)
  exitDate?: string; // Fecha salida del taller externo (YYYY-MM-DD)
  completedAt?: string;
  mileageAtEntry: number;
  partsUsed: WorkOrderPartUsed[]; // Repuestos propios suministrados al taller externo (sin importe)
  workshopReport: string; // Informe de reparación del taller externo
  warranty: string; // Garantía de la reparación (ej. "6 meses / 15.000 km")
  sourceChecklistId?: string;
  photos?: string[];
  inspectorSignature?: string;
  workshopConformitySignature?: string;
  partsDeliverySignature?: string;
  partsDeliveryDate?: string;
  partsDeliveredBy?: string;
  partsReceivedBy?: string;
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
  warehouseLocation: string; // Ubicación simple de almacén propio
  supplier: string;
  supplierContact?: string;
  isVehicleOnboardStandard: boolean;
}

export type StockMovementType =
  | 'Salida a reparación'
  | 'Salida a vehículo'
  | 'Entrada'
  | 'Ajuste';

export interface StockMovement {
  id: string;
  date: string;
  partId: string;
  partName: string;
  sku: string;
  type: StockMovementType;
  quantityChange: number; // negativo para salidas, positivo para entradas
  targetReference: string; // Destino (ej. "AMB-02 • OR-2026-001 (Talleres DieselSur)")
  notes?: string;
  performedBy: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  role: UserRole;
  action: string;
  target: string;
  details: string;
}
