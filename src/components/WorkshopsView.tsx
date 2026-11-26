import React, { useState } from 'react';
import {
  Ambulance,
  ExternalWorkshop,
  UserRole,
  WorkOrder,
  WorkshopSpecialty,
} from '../types';
import {
  Building2,
  Phone,
  Mail,
  MapPin,
  User,
  Wrench,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  Search,
} from 'lucide-react';

interface WorkshopsViewProps {
  workshops: ExternalWorkshop[];
  workOrders: WorkOrder[];
  ambulances: Ambulance[];
  currentRole: UserRole;
  onAddWorkshop: (ws: Omit<ExternalWorkshop, 'id'>) => void;
  onUpdateWorkshop: (ws: ExternalWorkshop) => void;
  onDeleteWorkshop: (id: string) => void;
}

const SPECIALTIES: WorkshopSpecialty[] = [
  'Mecánica General',
  'Electricidad y Prioritarios',
  'Carrozado Sanitario',
  'Neumáticos y Frenos',
  'Chapa y Pintura',
  'Servicio Oficial Marca',
];

export const WorkshopsView: React.FC<WorkshopsViewProps> = ({
  workshops,
  workOrders,
  ambulances,
  currentRole,
  onAddWorkshop,
  onUpdateWorkshop,
  onDeleteWorkshop,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSpecialty, setFilterSpecialty] = useState<string>('Todas');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingWs, setEditingWs] = useState<ExternalWorkshop | null>(null);

  const [newWs, setNewWs] = useState<Omit<ExternalWorkshop, 'id'>>({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    specialty: 'Mecánica General',
    zone: '',
    notes: '',
  });

  const filteredWorkshops = workshops.filter((ws) => {
    const matchesSpec =
      filterSpecialty === 'Todas' || ws.specialty === filterSpecialty;
    const matchesQuery =
      ws.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ws.contactPerson.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ws.zone.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ws.specialty.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSpec && matchesQuery;
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWs.name.trim()) return;
    onAddWorkshop(newWs);
    setNewWs({
      name: '',
      contactPerson: '',
      phone: '',
      email: '',
      specialty: 'Mecánica General',
      zone: '',
      notes: '',
    });
    setShowAddModal(false);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWs || !editingWs.name.trim()) return;
    onUpdateWorkshop(editingWs);
    setEditingWs(null);
  };

  return (
    <div className="space-y-6">
      {/* Cabecera y Filtros */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              Directorio de Talleres Externos Concertados ({workshops.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Todas las reparaciones de la flota se realizan en talleres externos. Suministramos repuestos desde nuestro almacén propio cuando corresponde.
            </p>
          </div>

          {currentRole === 'Encargado' && (
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-2 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Añadir Taller Externo
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar taller por nombre, persona de contacto, especialidad o zona..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-300 text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {['Todas', ...SPECIALTIES].map((spec) => (
              <button
                key={spec}
                type="button"
                onClick={() => setFilterSpecialty(spec)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  filterSpecialty === spec
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {spec}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Listado de Talleres Externos */}
      {filteredWorkshops.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-xs text-slate-500">
          No se encontraron talleres externos con los filtros seleccionados.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredWorkshops.map((ws) => {
            const wsOrders = workOrders.filter((wo) => wo.workshopId === ws.id);
            const activeOrders = wsOrders.filter((wo) => wo.status !== 'Cerrada');

            return (
              <div
                key={ws.id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="inline-block px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold text-[11px] mb-1">
                        {ws.specialty}
                      </span>
                      <h3 className="text-base font-bold text-slate-900">
                        {ws.name}
                      </h3>
                    </div>

                    {currentRole === 'Encargado' && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setEditingWs(ws)}
                          title="Editar taller externo"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              window.confirm(
                                `¿Eliminar el taller externo "${ws.name}"?`
                              )
                            ) {
                              onDeleteWorkshop(ws.id);
                            }
                          }}
                          title="Eliminar taller externo"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200/70">
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate font-medium">
                        {ws.contactPerson || 'Sin contacto'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <a
                        href={`tel:${ws.phone}`}
                        className="font-bold text-slate-900 hover:underline"
                      >
                        {ws.phone || '-'}
                      </a>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <a
                        href={`mailto:${ws.email}`}
                        className="truncate text-blue-700 hover:underline"
                      >
                        {ws.email || '-'}
                      </a>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <span className="truncate">{ws.zone || '-'}</span>
                    </div>
                  </div>

                  {ws.notes && (
                    <p className="text-xs text-slate-600 italic">
                      Notas: {ws.notes}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-slate-600">
                      Órdenes históricas: <strong>{wsOrders.length}</strong>
                    </span>
                  </div>

                  {activeOrders.length > 0 ? (
                    <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-bold">
                      {activeOrders.length} en curso (
                      {activeOrders
                        .map(
                          (o) =>
                            ambulances.find((a) => a.id === o.ambulanceId)?.code
                        )
                        .filter(Boolean)
                        .join(', ')}
                      )
                    </span>
                  ) : (
                    <span className="text-slate-400">
                      Sin unidades en este taller hoy
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Añadir Taller Externo */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900">
                Dar de Alta Taller Externo
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Nombre del Taller Externo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Talleres DieselSur SL"
                  value={newWs.name}
                  onChange={(e) => setNewWs({ ...newWs, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Persona de Contacto
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Nombre receptor..."
                    value={newWs.contactPerson}
                    onChange={(e) =>
                      setNewWs({ ...newWs, contactPerson: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="954 000 000"
                    value={newWs.phone}
                    onChange={(e) =>
                      setNewWs({ ...newWs, phone: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="recepcion@taller.es"
                    value={newWs.email}
                    onChange={(e) =>
                      setNewWs({ ...newWs, email: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Especialidad
                  </label>
                  <select
                    value={newWs.specialty}
                    onChange={(e) =>
                      setNewWs({
                        ...newWs,
                        specialty: e.target.value as WorkshopSpecialty,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  >
                    {SPECIALTIES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Zona / Ubicación
                </label>
                <input
                  type="text"
                  placeholder="Ej. Polígono Industrial Norte - Nave 8"
                  value={newWs.zone}
                  onChange={(e) => setNewWs({ ...newWs, zone: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Notas / Observaciones
                </label>
                <textarea
                  rows={2}
                  value={newWs.notes}
                  onChange={(e) => setNewWs({ ...newWs, notes: e.target.value })}
                  placeholder="Horario de recepción, marcas concertadas..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
                >
                  Guardar Taller
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Taller Externo */}
      {editingWs && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900">
                Editar Taller Externo
              </h3>
              <button
                type="button"
                onClick={() => setEditingWs(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Nombre del Taller Externo *
                </label>
                <input
                  type="text"
                  required
                  value={editingWs.name}
                  onChange={(e) =>
                    setEditingWs({ ...editingWs, name: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Persona de Contacto
                  </label>
                  <input
                    type="text"
                    value={editingWs.contactPerson}
                    onChange={(e) =>
                      setEditingWs({
                        ...editingWs,
                        contactPerson: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    value={editingWs.phone}
                    onChange={(e) =>
                      setEditingWs({ ...editingWs, phone: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={editingWs.email}
                    onChange={(e) =>
                      setEditingWs({ ...editingWs, email: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Especialidad
                  </label>
                  <select
                    value={editingWs.specialty}
                    onChange={(e) =>
                      setEditingWs({
                        ...editingWs,
                        specialty: e.target.value as WorkshopSpecialty,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  >
                    {SPECIALTIES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Zona / Ubicación
                </label>
                <input
                  type="text"
                  value={editingWs.zone}
                  onChange={(e) =>
                    setEditingWs({ ...editingWs, zone: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Notas
                </label>
                <textarea
                  rows={2}
                  value={editingWs.notes}
                  onChange={(e) =>
                    setEditingWs({ ...editingWs, notes: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingWs(null)}
                  className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
