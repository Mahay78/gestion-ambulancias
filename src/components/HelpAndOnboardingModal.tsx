import React, { useState } from 'react';
import { UserRole } from '../types';
import { HelpCircle, ShieldCheck, BookOpen, X } from 'lucide-react';

interface HelpAndOnboardingModalProps {
  currentRole: UserRole;
  onClose: () => void;
}

export const HelpAndOnboardingModal: React.FC<HelpAndOnboardingModalProps> = ({
  currentRole,
  onClose,
}) => {
  const [tab, setTab] = useState<'guide' | 'help' | 'privacy'>('guide');

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <HelpCircle className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="text-sm font-extrabold">
                Ayuda, Guía Rápida y Privacidad (RGPD)
              </h3>
              <p className="text-[11px] text-slate-300">
                Rol activo: {currentRole}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pt-3 border-b border-slate-200 flex gap-2 text-xs bg-slate-50">
          <button
            type="button"
            onClick={() => setTab('guide')}
            className={`px-3 py-2 rounded-t-xl font-bold flex items-center gap-1.5 ${
              tab === 'guide'
                ? 'bg-white border border-b-0 border-slate-200 text-blue-700'
                : 'text-slate-600'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Guía 3 Pasos ({currentRole})
          </button>
          <button
            type="button"
            onClick={() => setTab('help')}
            className={`px-3 py-2 rounded-t-xl font-bold flex items-center gap-1.5 ${
              tab === 'help'
                ? 'bg-white border border-b-0 border-slate-200 text-blue-700'
                : 'text-slate-600'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Estados y Módulos
          </button>
          <button
            type="button"
            onClick={() => setTab('privacy')}
            className={`px-3 py-2 rounded-t-xl font-bold flex items-center gap-1.5 ${
              tab === 'privacy'
                ? 'bg-white border border-b-0 border-slate-200 text-blue-700'
                : 'text-slate-600'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Privacidad y RGPD
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-3 text-xs text-slate-700 leading-relaxed">
          {tab === 'guide' && (
            <>
              {currentRole === 'Encargado' ? (
                <div className="space-y-3">
                  <h4 className="font-extrabold text-slate-900 text-sm">
                    Guía Rápida para el Encargado de Flota
                  </h4>
                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                    <strong>Paso 1 — Revisa la Pizarra y Alertas:</strong> Entra en{' '}
                    <strong>Pizarra</strong> o en el icono de campana (🔔) para ver al
                    instante qué ambulancia tiene ITV/Seguro por vencer, partes de
                    unidades o falta de dotación.
                  </div>
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                    <strong>Paso 2 — Asigna Taller y Repuestos:</strong> Convierte
                    cualquier incidencia en <strong>Orden Externa</strong>, comprueba si
                    salta aviso de <em>Garantía Vigente</em> y genera el{' '}
                    <strong>Albarán de Repuestos</strong> firmado.
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                    <strong>Paso 3 — Informa a Dirección:</strong> Pulsa{' '}
                    <strong>Informe Roturas (Jefe)</strong> para sacar PDF o enviarlo
                    por correo directo desde <code>flotaambulz@gmail.com</code>.
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <h4 className="font-extrabold text-slate-900 text-sm">
                    Guía Rápida para el Operador
                  </h4>
                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                    <strong>Paso 1 — Consulta tu unidad en Pizarra / Flota:</strong>{' '}
                    Verifica si la ambulancia tiene algún pendiente o falta de dotación.
                  </div>
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                    <strong>Paso 2 — Pasa Checklist o Parte:</strong> Registra
                    kilometraje, marca anomalías o saca foto con la cámara.
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                    <strong>Paso 3 — Repón Stock:</strong> Usa el escáner QR/barras en{' '}
                    <strong>Almacén</strong> para registrar entradas o salidas de piezas.
                  </div>
                </div>
              )}
            </>
          )}

          {tab === 'help' && (
            <div className="space-y-2.5">
              <h4 className="font-extrabold text-slate-900 text-sm">
                Ciclo de Estados de las Órdenes Externas
              </h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong>1. Reportada:</strong> Avería detectada pendiente de asignar
                  taller.
                </li>
                <li>
                  <strong>2. Asignada:</strong> Taller externo seleccionado / esperando
                  cita.
                </li>
                <li>
                  <strong>3. En taller:</strong> El vehículo entra al taller externo y
                  pasa automáticamente a estado <em>En taller</em>.
                </li>
                <li>
                  <strong>4. Reparada:</strong> Trabajo finalizado por el taller,
                  pendiente de recoger/verificar.
                </li>
                <li>
                  <strong>5. Cerrada:</strong> Unidad verificada; vuelve a{' '}
                  <em>Disponible</em> (si no tiene otra orden en taller ni está{' '}
                  <em>Fuera de servicio</em>).
                </li>
              </ul>
            </div>
          )}

          {tab === 'privacy' && (
            <div className="space-y-2.5">
              <h4 className="font-extrabold text-slate-900 text-sm">
                Política de Privacidad, Fotos, Firmas y RGPD
              </h4>
              <p>
                <strong>1. Finalidad operativa:</strong> Las fotografías de averías,
                documentos reglamentarios y firmas digitales de recepción/conformidad
                se utilizan exclusivamente para la gestión técnica de la flota de
                ambulancias y trazabilidad con talleres externos.
              </p>
              <p>
                <strong>2. Consentimiento en servicios externos:</strong> El envío de
                copias o documentos a Google Drive (<code>flotaambulz@gmail.com</code>) y
                las consultas opcionales con Google Gemini solo se realizan cuando tú
                lo configuras y activas en la app.
              </p>
              <p>
                <strong>3. Retención y derechos:</strong> Los datos locales se guardan
                en tu navegador (IndexedDB / localStorage) y en tu proyecto Firebase
                privado. Puedes exportar toda la información en JSON/CSV o borrar la
                copia local en cualquier momento desde el menú <strong>Backup</strong>.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
