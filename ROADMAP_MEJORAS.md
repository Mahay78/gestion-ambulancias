# 📋 Hoja de Ruta (Fase 2) — Potenciación de AmbuFleet Mecánica

- **Carpeta Local**: `C:\proyectos\gestion-ambulancias`
- **Repositorio GitHub**: `https://github.com/Mahay78/gestion-ambulancias`
- **Web App Móvil / Tablet (PWA)**: `https://mahay78.github.io/gestion-ambulancias/`

---

## 1. Control Técnico Visual de la Ambulancia (Gráficos Interactivos)
- [ ] **1.1. Mapa Visual 360° de Daños de Carrocería y Lunas**: Esquema interactivo de las 5 vistas de la ambulancia (Frontal, Trasera, Lateral Izquierdo, Puerta Corredera Derecha y Techo/Puente de Luces) para marcar golpes, roces o roturas tocando con el dedo.
- [ ] **1.2. Esquema Visual de Neumáticos por Eje (4 Ruedas + Repuesto)**: Panel del chasis por ambulancia con presión (`bar`), profundidad del dibujo (`mm` con semáforo de desgaste) y fecha de cambio por rueda.
- [ ] **1.3. Monitor de Doble Batería (Arranque vs. Célula Sanitaria AGM + Inversor 220V)**: Control de voltajes, fecha de instalación y estado de toma exterior de 220V en base.

## 2. Agilidad en el Taller y en la Campa
- [ ] **2.1. Generador de Pegatinas QR por Ambulancia**: Impresión de etiquetas con código QR para el marco de puerta de cada ambulancia (`AMB-01`, `AMB-02`...) que abren su ficha o checklist directamente al escanearlas.
- [ ] **2.2. Cronómetro en Vivo para el Mecánico**: Botón `▶ Iniciar Reparación` / `⏸ Pausar` dentro de cada Orden de Trabajo para medir y sumar automáticamente las horas reales de intervención.
- [ ] **2.3. Modo Oscuro / Alto Contraste de Taller**: Interruptor Día/Noche para trabajar en el foso del taller o en turnos nocturnos.

## 3. Inteligencia Mecánica y Estadísticas de Flota
- [ ] **3.1. Panel de Estadísticas y Ranking de Fiabilidad**: Ambulancias con más entradas a taller, tiempo de inmovilización, sistemas que más fallan y repuestos más utilizados.
- [ ] **3.2. Control de Repostajes (Diésel y AdBlue) y Alertas de Consumo**: Cálculo automático de consumo (`L/100 km`) y detección de consumo anómalo (inyectores / filtro de partículas FAP).

## 4. Roles de Usuario y Conexión en Tiempo Real
- [ ] **4.1. Selector de Rol / Perfil con PIN de Taller**: Vistas adaptadas para *Técnico TES / Conductor*, *Responsable de Flota* y *Jefe de Taller*, con PIN para proteger borrados y altas mecánicas.
- [ ] **4.2. Base de Datos en la Nube en Tiempo Real (Supabase / Firebase)**: Sincronización instantánea entre todos los móviles, tablets y el PC del taller.
