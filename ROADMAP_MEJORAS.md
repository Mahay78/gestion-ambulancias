# 📋 Hoja de Ruta de Mejoras (Roadmap) — AmbuFleet Gestión de Flota

- **Repositorio GitHub**: `https://github.com/Mahay78/gestion-ambulancias`
- **Web App Móvil / Tablet (PWA)**: `https://mahay78.github.io/gestion-ambulancias/`
- **Alcance de Negocio**: Gestión de flota de **21 ambulancias**, **2 usuarios** (`Encargado` y `Operador`), reparaciones en **talleres externos**, **almacén propio de repuestos** suministrados a talleres/vehículos y **cero campos económicos**.

---

## ✅ Fases Completadas (Base Operativa Actual)
- [x] **Fase 0**: PWA real con Service Worker offline (`public/sw.js`), backup automático con punto de restauración local, aviso de cuota de `localStorage`, compresión automática de fotos, flota de 21 ambulancias (`AMB-01` a `AMB-21`) y alertas de los 4 documentos reglamentarios (`ITV`, `Seguro`, `Certificado Técnico-Sanitario`, `Ficha Técnica`) a **30 / 15 / 7 días y vencidos**.
- [x] **Fase 1**: Eliminación total de campos monetarios y de mecánicos internos; directorio de **Talleres Externos**, **Órdenes de Reparación Externas** (`Reportada → Asignada → En taller → Reparada → Cerrada`) con cálculo de días parado, informe del taller, garantía y suministro de repuestos propios; sincronización automática de disponibilidad (`Disponible` / `En taller` / `Fuera de servicio`) y selector de roles (`Encargado` / `Operador`).
- [x] **Fase 2**: **Stock de repuestos sin costes** con ubicación simple de almacén y contacto de proveedor; registro trazable de movimientos (`Entrada`, `Salida a reparación`, `Salida a vehículo`, `Ajuste`) con notas y usuario; **Dotación a bordo obligatoria** con estado interactivo `OK / FALTA`; e **Historial / Línea temporal unificada por vehículo**.

---

## 🚀 Próximas Mejoras Propuestas

### 1. Sincronización Multiusuario y Seguridad (2 Usuarios: Encargado y Operador)
- [ ] **1.1. Sincronización en Tiempo Real con Supabase (Offline-First)**: Conectar el adaptador preparado en `src/utils/storage.ts` a Supabase (PostgreSQL + Auth + Storage) para que los cambios del Operador en campa y del Encargado en oficina se sincronicen automáticamente entre dispositivos manteniendo caché offline.
- [ ] **1.2. PIN Rápido de Seguridad para el Rol "Encargado"**: Código PIN de 4 dígitos al cambiar de `Operador` a `Encargado` para proteger bajas de unidades, edición de talleres externos y ajustes manuales de inventario.

### 2. Control de Talleres Externos, Garantías y Entrega de Repuestos
- [ ] **2.1. Detector Automático de Reparaciones en Garantía**: Al abrir una nueva incidencia u orden externa, avisar si la ambulancia tuvo una intervención reciente en un taller externo con garantía vigente para reclamar la reparación sin cargo.
- [ ] **2.2. Albarán PDF / Firma de Entrega de Repuestos Propios al Taller Externo**: Documento imprimible y firmable en pantalla específico para justificar las piezas de nuestro almacén entregadas a cada taller externo.
- [ ] **2.3. Estadísticas Operativas de Talleres Externos (Sin Costes)**: Comparativa de talleres por tiempo medio de estancia (**días parado**), volumen de órdenes atendidas y cumplimiento de plazos.

### 3. Agilidad en Campa y Estado Visual de las 21 Ambulancias
- [ ] **3.1. Generador de Etiquetas QR Imprimibles (A4) para las 21 Ambulancias**: Hoja lista para imprimir y pegar en el marco de puerta de `AMB-01` a `AMB-21` para abrir su ficha, dotación o reporte de incidencia escaneando con el móvil.
- [ ] **3.2. Mapa Visual 360° de Carrocería y Lunas**: Esquema interactivo de las 5 vistas de la ambulancia (Frontal, Trasera, Lateral Izquierdo, Lateral Derecho y Techo/Puente Prioritario) para registrar estado exterior antes y después de entrar al taller externo.
- [ ] **3.3. Panel Visual de Neumáticos (4 Ruedas + Repuesto) y Doble Batería**: Control por eje de profundidad de dibujo (`mm`), presión (`bar`) y estado de batería de arranque vs. batería AGM auxiliar de célula sanitaria.

### 4. Alertas Proactivas de Vencimientos y Almacén
- [ ] **4.1. Notificaciones Locales PWA de Vencimientos Críticos**: Aviso del navegador al iniciar el día cuando algún documento (`ITV`, `Seguro`, `Certificado Técnico-Sanitario`, `Ficha Técnica`) entre en la franja de **≤ 15 días**, **≤ 7 días** o **Vencido**.
- [ ] **4.2. Exportación de Calendario `.ICS` (Google Calendar / Outlook / Apple)**: Descarga en 1 clic de todos los vencimientos documentales y preventivos de las 21 ambulancias para integrarlos en el calendario del móvil.
- [ ] **4.3. Escáner de Código de Barras / QR en Almacén de Repuestos**: Lectura con la cámara del móvil o tablet para registrar entradas y salidas de repuestos hacia órdenes externas en segundos.
