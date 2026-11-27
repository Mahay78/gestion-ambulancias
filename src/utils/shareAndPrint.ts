import {
  Ambulance,
  ExternalWorkshop,
  FleetChecklist,
  SparePart,
  WorkOrder,
} from '../types';

const escapeHtml = (unsafe?: string | number): string => {
  if (unsafe === undefined || unsafe === null) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const getReportLogoHtml = (): string => {
  const logoUrl =
    typeof window !== 'undefined'
      ? new URL('./logo-acciona-icot.png', window.location.href).href
      : './logo-acciona-icot.png';
  return `<img src="${escapeHtml(
    logoUrl
  )}" alt="Logo UTE Acciona ICOT" style="height:40px;width:auto;object-fit:contain;margin-bottom:8px;display:block;" />`;
};

export const shareChecklistViaWhatsApp = (
  chk: FleetChecklist,
  amb?: Ambulance
) => {
  const anomalies = chk.items.filter((i) => i.status !== 'OK');
  const anomalyLines =
    anomalies.length > 0
      ? anomalies
          .map(
            (a) =>
              `• [${a.status.toUpperCase()}] ${a.label}${
                a.comment ? ` (${a.comment})` : ''
              }`
          )
          .join('\n')
      : '• Todos los puntos mecánicos marcados OK';

  const missingLines =
    chk.missingParts.length > 0
      ? chk.missingParts
          .map((m) => `• ${m.partName}: faltan ${m.missingQty} uds.`)
          .join('\n')
      : '• Dotación de piezas a bordo completa';

  const text = [
    `🚑 *PARTE DE INSPECCIÓN FLOTA → TALLER*`,
    `*Unidad:* ${amb?.code || ''} (${amb?.plate || ''}) - ${amb?.brand || ''} ${
      amb?.model || ''
    }`,
    `*Fecha:* ${chk.date} | *Km:* ${chk.mileageAtInspection.toLocaleString()} km`,
    `*Urgencia:* ${chk.overallUrgency.toUpperCase()}`,
    `*Responsable:* ${chk.inspectorName}`,
    ``,
    `🔧 *Incidencias Mecánicas (${anomalies.length}):*`,
    anomalyLines,
    ``,
    `📦 *Stock de Piezas del Vehículo:*`,
    missingLines,
    ``,
    `📝 *Observaciones:* ${chk.generalObservations}`,
  ].join('\n');

  window.open(
    `https://wa.me/?text=${encodeURIComponent(text)}`,
    '_blank',
    'noopener,noreferrer'
  );
};

export const shareWorkOrderViaWhatsApp = (
  wo: WorkOrder,
  amb?: Ambulance,
  ws?: ExternalWorkshop
) => {
  const partsLines =
    wo.partsUsed.length > 0
      ? wo.partsUsed
          .map((p) => `• ${p.partName} (${p.sku}) x${p.quantity} uds.`)
          .join('\n')
      : '• Sin repuestos propios suministrados';

  const text = [
    `🛠️ *ORDEN DE REPARACIÓN EXTERNA: ${wo.code}*`,
    `*Unidad:* ${amb?.code || ''} (${amb?.plate || ''}) - ${amb?.brand || ''} ${
      amb?.model || ''
    }`,
    `*Taller Externo:* ${ws?.name || 'Por asignar'} (${ws?.phone || ''})`,
    `*Estado:* ${wo.status.toUpperCase()} | *Prioridad:* ${wo.priority}`,
    `*Fecha Entrada:* ${wo.entryDate || wo.createdAt} | *Km:* ${wo.mileageAtEntry.toLocaleString()} km`,
    ``,
    `📌 *Motivo:* ${wo.title}`,
    `*Detalle:* ${wo.description}`,
    ``,
    `🔩 *Informe del Taller Externo:*`,
    wo.workshopReport || 'Pendiente de informe del taller',
    `*Garantía:* ${wo.warranty || 'Estándar taller'}`,
    ``,
    `📦 *Repuestos Suministrados desde Nuestro Almacén:*`,
    partsLines,
  ].join('\n');

  window.open(
    `https://wa.me/?text=${encodeURIComponent(text)}`,
    '_blank',
    'noopener,noreferrer'
  );
};

export const printChecklistReport = (chk: FleetChecklist, amb?: Ambulance) => {
  const win = window.open('', '_blank');
  if (!win) return;

  const rowsHtml = chk.items
    .map(
      (i) => `
      <tr>
        <td style="padding:6px 8px;border:1px solid #cbd5e1;font-size:11px;">${escapeHtml(
          i.section
        )}</td>
        <td style="padding:6px 8px;border:1px solid #cbd5e1;font-size:11px;font-weight:600;">${escapeHtml(
          i.label
        )}</td>
        <td style="padding:6px 8px;border:1px solid #cbd5e1;font-size:11px;text-align:center;font-weight:700;color:${
          i.status === 'Avería'
            ? '#be123c'
            : i.status === 'Observación'
            ? '#b45309'
            : '#15803d'
        };">${escapeHtml(i.status)}</td>
        <td style="padding:6px 8px;border:1px solid #cbd5e1;font-size:11px;">${
          escapeHtml(i.comment) || '-'
        }</td>
      </tr>`
    )
    .join('');

  const missingHtml =
    chk.missingParts.length > 0
      ? chk.missingParts
          .map(
            (m) =>
              `<li><strong>${escapeHtml(m.partName)}</strong>: Faltan ${escapeHtml(
                m.missingQty
              )} uds. (${escapeHtml(m.actionRequired)})</li>`
          )
          .join('')
      : '<li>Dotación de piezas a bordo del vehículo completa.</li>';

  const safePhotos = (chk.photos || []).filter((p) =>
    p.startsWith('data:image/')
  );
  const photosHtml =
    safePhotos.length > 0
      ? `<div style="margin-top:16px;">
          <h3 style="font-size:13px;margin-bottom:8px;">Evidencias Fotográficas Adjuntas (${safePhotos.length})</h3>
          <div style="display:flex;flex-wrap:wrap;gap:10px;">
            ${safePhotos
              .map(
                (p) =>
                  `<img src="${p}" style="width:160px;height:115px;object-fit:cover;border:1px solid #94a3b8;border-radius:6px;" />`
              )
              .join('')}
          </div>
        </div>`
      : '';

  const signatureHtml =
    chk.inspectorSignature && chk.inspectorSignature.startsWith('data:image/')
      ? `<div style="margin-top:20px;border-top:1px solid #cbd5e1;padding-top:12px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <p style="font-size:12px;font-weight:bold;margin:0;">Firmado por Responsable de Flota:</p>
          <p style="font-size:11px;color:#475569;margin:2px 0;">${escapeHtml(
            chk.inspectorName
          )}</p>
        </div>
        <img src="${chk.inspectorSignature}" style="height:65px;border:1px solid #cbd5e1;padding:4px;border-radius:6px;" />
      </div>`
      : '';

  win.document.write(`
    <!doctype html>
    <html lang="es">
    <head>
      <meta charset="utf-8" />
      <title>Checklist ${escapeHtml(amb?.code)} - ${escapeHtml(chk.date)}</title>
      <style>
        body { font-family: Arial, sans-serif; color: #0f172a; margin: 24px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        @media print { .no-print { display: none; } }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom:16px;text-align:right;">
        <button onclick="window.print()" style="padding:8px 16px;background:#2563eb;color:white;border:none;border-radius:6px;font-weight:bold;cursor:pointer;">
          Imprimir / Guardar como PDF
        </button>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0f172a;padding-bottom:12px;">
        <div>
          ${getReportLogoHtml()}
          <h1 style="font-size:18px;margin:0;">AMBU-LZFLOTA — PARTE DE INSPECCIÓN A TALLER</h1>
          <p style="font-size:12px;color:#475569;margin:4px 0 0;">Checklist del Responsable de Flota y Auditoría de Stock del Vehículo</p>
        </div>
        <div style="text-align:right;font-size:12px;">
          <strong>Fecha:</strong> ${escapeHtml(chk.date)}<br/>
          <strong>Urgencia:</strong> ${escapeHtml(chk.overallUrgency)}
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;background:#f8fafc;padding:12px;border:1px solid #cbd5e1;border-radius:8px;margin-top:14px;font-size:12px;">
        <div><strong>Unidad:</strong> ${escapeHtml(amb?.code)} (${escapeHtml(
          amb?.plate
        )})</div>
        <div><strong>Vehículo:</strong> ${escapeHtml(amb?.brand)} ${escapeHtml(
          amb?.model
        )}</div>
        <div><strong>Kilometraje:</strong> ${chk.mileageAtInspection.toLocaleString()} km</div>
      </div>

      <p style="font-size:12px;background:#f1f5f9;padding:10px;border-radius:6px;margin-top:12px;">
        <strong>Observaciones Generales al Taller:</strong> ${escapeHtml(
          chk.generalObservations
        )}
      </p>

      <h3 style="font-size:13px;margin-top:16px;margin-bottom:4px;">Stock de Piezas a Reponer en el Vehículo</h3>
      <ul style="font-size:12px;margin-top:4px;">${missingHtml}</ul>

      <h3 style="font-size:13px;margin-top:16px;margin-bottom:4px;">Puntos de Inspección Mecánica y Carrozado</h3>
      <table>
        <thead>
          <tr style="background:#e2e8f0;font-size:11px;text-align:left;">
            <th style="padding:6px 8px;border:1px solid #cbd5e1;">Bloque</th>
            <th style="padding:6px 8px;border:1px solid #cbd5e1;">Punto Revisado</th>
            <th style="padding:6px 8px;border:1px solid #cbd5e1;text-align:center;">Estado</th>
            <th style="padding:6px 8px;border:1px solid #cbd5e1;">Nota / Síntoma</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>

      ${photosHtml}
      ${signatureHtml}
    </body>
    </html>
  `);
  win.document.close();
};

export const printWorkOrderReport = (
  wo: WorkOrder,
  amb?: Ambulance,
  ws?: ExternalWorkshop
) => {
  const win = window.open('', '_blank');
  if (!win) return;

  const partsHtml =
    wo.partsUsed.length > 0
      ? wo.partsUsed
          .map(
            (p) => `
          <tr>
            <td style="padding:6px 8px;border:1px solid #cbd5e1;font-size:12px;">${escapeHtml(
              p.partName
            )}</td>
            <td style="padding:6px 8px;border:1px solid #cbd5e1;font-size:12px;font-family:monospace;">${escapeHtml(
              p.sku
            )}</td>
            <td style="padding:6px 8px;border:1px solid #cbd5e1;font-size:12px;text-align:center;font-weight:bold;">${escapeHtml(
              p.quantity
            )} uds.</td>
          </tr>`
          )
          .join('')
      : `<tr><td colspan="3" style="padding:8px;border:1px solid #cbd5e1;text-align:center;font-size:12px;">Sin repuestos propios suministrados</td></tr>`;

  const safePhotos = (wo.photos || []).filter((p) =>
    p.startsWith('data:image/')
  );
  const photosHtml =
    safePhotos.length > 0
      ? `<div style="margin-top:16px;">
          <h3 style="font-size:13px;margin-bottom:8px;">Fotografías de la Avería / Intervención (${safePhotos.length})</h3>
          <div style="display:flex;flex-wrap:wrap;gap:10px;">
            ${safePhotos
              .map(
                (p) =>
                  `<img src="${p}" style="width:160px;height:115px;object-fit:cover;border:1px solid #94a3b8;border-radius:6px;" />`
              )
              .join('')}
          </div>
        </div>`
      : '';

  const safeInspectorSig =
    wo.inspectorSignature && wo.inspectorSignature.startsWith('data:image/')
      ? wo.inspectorSignature
      : '';
  const safeConformitySig =
    wo.workshopConformitySignature &&
    wo.workshopConformitySignature.startsWith('data:image/')
      ? wo.workshopConformitySignature
      : '';

  win.document.write(`
    <!doctype html>
    <html lang="es">
    <head>
      <meta charset="utf-8" />
      <title>Orden de Reparación Externa ${escapeHtml(wo.code)} - ${escapeHtml(
        amb?.plate
      )}</title>
      <style>
        body { font-family: Arial, sans-serif; color: #0f172a; margin: 24px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        @media print { .no-print { display: none; } }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom:16px;text-align:right;">
        <button onclick="window.print()" style="padding:8px 16px;background:#2563eb;color:white;border:none;border-radius:6px;font-weight:bold;cursor:pointer;">
          Imprimir Volante de Taller Externo / Guardar PDF
        </button>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0f172a;padding-bottom:12px;">
        <div>
          ${getReportLogoHtml()}
          <h1 style="font-size:18px;margin:0;">ORDEN DE REPARACIÓN EXTERNA — ${escapeHtml(
            wo.code
          )}</h1>
          <p style="font-size:12px;color:#475569;margin:4px 0 0;">Ambu-lzflota • Gestión de Flota de Ambulancias</p>
        </div>
        <div style="text-align:right;font-size:12px;">
          <strong>Estado:</strong> ${escapeHtml(wo.status)}<br/>
          <strong>Prioridad:</strong> ${escapeHtml(wo.priority)}<br/>
          <strong>Entrada:</strong> ${escapeHtml(
            wo.entryDate || wo.createdAt
          )} ${wo.exitDate ? `| <strong>Salida:</strong> ${escapeHtml(wo.exitDate)}` : ''}
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;background:#f8fafc;padding:12px;border:1px solid #cbd5e1;border-radius:8px;margin-top:14px;font-size:12px;">
        <div><strong>Unidad:</strong> ${escapeHtml(amb?.code)} (${escapeHtml(
          amb?.plate
        )})</div>
        <div><strong>Modelo:</strong> ${escapeHtml(amb?.brand)} ${escapeHtml(
          amb?.model
        )}</div>
        <div><strong>Km Entrada:</strong> ${wo.mileageAtEntry.toLocaleString()} km</div>
        <div><strong>Taller Externo:</strong> ${escapeHtml(
          ws?.name || 'Taller Externo'
        )}</div>
        <div><strong>Contacto Taller:</strong> ${escapeHtml(
          ws?.contactPerson || '-'
        )} (${escapeHtml(ws?.phone || '-')})</div>
        <div><strong>Reportado por:</strong> ${escapeHtml(wo.reportedBy)}</div>
      </div>

      <div style="margin-top:14px;font-size:12px;background:#f1f5f9;padding:12px;border-radius:6px;">
        <p style="margin:0 0 6px;"><strong>Motivo de la Reparación:</strong> ${escapeHtml(
          wo.title
        )}</p>
        <p style="margin:0;"><strong>Descripción / Síntomas:</strong> ${escapeHtml(
          wo.description
        )}</p>
      </div>

      <div style="margin-top:14px;font-size:12px;background:#fff;border:1px solid #cbd5e1;padding:12px;border-radius:6px;">
        <p style="margin:0 0 6px;"><strong>Informe del Taller Externo:</strong></p>
        <p style="margin:0 0 8px;">${
          escapeHtml(wo.workshopReport) ||
          'Pendiente de informe del taller externo.'
        }</p>
        <p style="margin:0;"><strong>Garantía de Reparación:</strong> ${escapeHtml(
          wo.warranty || 'Según condiciones de taller externo'
        )}</p>
      </div>

      <h3 style="font-size:13px;margin-top:16px;margin-bottom:4px;">Repuestos Suministrados desde Almacén Propio</h3>
      <table>
        <thead>
          <tr style="background:#e2e8f0;font-size:11px;text-align:left;">
            <th style="padding:6px 8px;border:1px solid #cbd5e1;">Repuesto</th>
            <th style="padding:6px 8px;border:1px solid #cbd5e1;">Código SKU</th>
            <th style="padding:6px 8px;border:1px solid #cbd5e1;text-align:center;">Cantidad Suministrada</th>
          </tr>
        </thead>
        <tbody>${partsHtml}</tbody>
      </table>

      ${photosHtml}

      <div style="margin-top:24px;border-top:1px solid #cbd5e1;padding-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:20px;">
        <div style="border:1px solid #cbd5e1;padding:10px;border-radius:8px;">
          <p style="font-size:11px;font-weight:bold;margin:0 0 6px;">Firma Entrega a Taller Externo (${escapeHtml(
            wo.reportedBy
          )}):</p>
          ${
            safeInspectorSig
              ? `<img src="${safeInspectorSig}" style="height:60px;object-contain;" />`
              : `<div style="height:60px;border-bottom:1px dashed #94a3b8;"></div>`
          }
        </div>
        <div style="border:1px solid #cbd5e1;padding:10px;border-radius:8px;">
          <p style="font-size:11px;font-weight:bold;margin:0 0 6px;">Firma Recepción / Taller Externo (${escapeHtml(
            ws?.name || 'Taller'
          )}):</p>
          ${
            safeConformitySig
              ? `<img src="${safeConformitySig}" style="height:60px;object-contain;" />`
              : `<div style="height:60px;border-bottom:1px dashed #94a3b8;"></div>`
          }
        </div>
      </div>
    </body>
    </html>
  `);
  win.document.close();
};

export const printPartsDeliveryNote = (
  wo: WorkOrder,
  amb?: Ambulance,
  ws?: ExternalWorkshop
) => {
  const win = window.open('', '_blank', 'width=800,height=900');
  if (!win) return;

  const safeSig =
    wo.partsDeliverySignature && wo.partsDeliverySignature.startsWith('data:image/')
      ? wo.partsDeliverySignature
      : '';

  const rowsHtml =
    wo.partsUsed.length > 0
      ? wo.partsUsed
          .map(
            (p, idx) => `
          <tr>
            <td style="padding:8px;border:1px solid #cbd5e1;text-align:center;">${idx + 1}</td>
            <td style="padding:8px;border:1px solid #cbd5e1;font-family:monospace;font-weight:bold;">${escapeHtml(
              p.sku
            )}</td>
            <td style="padding:8px;border:1px solid #cbd5e1;">${escapeHtml(p.partName)}</td>
            <td style="padding:8px;border:1px solid #cbd5e1;text-align:center;font-weight:bold;">${
              p.quantity
            } uds.</td>
          </tr>`
          )
          .join('')
      : `<tr><td colspan="4" style="padding:12px;border:1px solid #cbd5e1;text-align:center;">Sin repuestos registrados en esta orden</td></tr>`;

  win.document.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <title>Albarán Entrega Repuestos - ${escapeHtml(wo.code)}</title>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; color: #0f172a; padding: 28px; max-width: 780px; margin: 0 auto; }
        .no-print { margin-bottom: 16px; display: flex; justify-content: flex-end; }
        .btn { background: #0f172a; color: #fff; border: none; padding: 8px 16px; border-radius: 8px; font-weight: bold; cursor: pointer; }
        @media print { .no-print { display: none; } }
      </style>
    </head>
    <body>
      <div class="no-print">
        <button class="btn" onclick="window.print()">Imprimir / Guardar PDF</button>
      </div>
      <div style="border-bottom:3px solid #0f172a;padding-bottom:12px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:flex-end;">
        <div>
          ${getReportLogoHtml()}
          <h1 style="margin:0;font-size:20px;">ALBARÁN DE ENTREGA DE REPUESTOS PROPIOS</h1>
          <p style="margin:4px 0 0;font-size:12px;color:#475569;">Ambu-lzflota Gestión de Flota (Material de almacén propio sin cargo económico)</p>
        </div>
        <div style="text-align:right;">
          <div style="font-size:16px;font-weight:900;color:#e11d48;">${escapeHtml(wo.code)}</div>
          <div style="font-size:11px;color:#64748b;">Fecha entrega: ${escapeHtml(
            wo.partsDeliveryDate || new Date().toISOString().split('T')[0]
          )}</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px;font-size:12px;">
        <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:10px;">
          <div style="font-weight:800;color:#475569;margin-bottom:4px;">VEHÍCULO DESTINO</div>
          <div><strong>Unidad:</strong> ${escapeHtml(amb?.code || '')} — ${escapeHtml(
            amb?.plate || ''
          )}</div>
          <div><strong>Modelo:</strong> ${escapeHtml(amb?.brand || '')} ${escapeHtml(
            amb?.model || ''
          )}</div>
          <div><strong>Km entrada:</strong> ${wo.mileageAtEntry.toLocaleString()} km</div>
        </div>
        <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:10px;">
          <div style="font-weight:800;color:#475569;margin-bottom:4px;">TALLER EXTERNO RECEPTOR</div>
          <div><strong>Taller:</strong> ${escapeHtml(ws?.name || 'Por asignar')}</div>
          <div><strong>Contacto:</strong> ${escapeHtml(ws?.contactPerson || '—')} (${escapeHtml(
            ws?.phone || '—'
          )})</div>
          <div><strong>Orden:</strong> ${escapeHtml(wo.title)}</div>
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:22px;">
        <thead>
          <tr style="background:#0f172a;color:#fff;">
            <th style="padding:8px;border:1px solid #0f172a;width:45px;">#</th>
            <th style="padding:8px;border:1px solid #0f172a;text-align:left;width:130px;">SKU</th>
            <th style="padding:8px;border:1px solid #0f172a;text-align:left;">Descripción del Repuesto</th>
            <th style="padding:8px;border:1px solid #0f172a;width:90px;">Cantidad</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;font-size:11px;">
        <div style="border:1px solid #cbd5e1;border-radius:8px;padding:10px;">
          <p style="margin:0 0 6px;font-weight:bold;">Entregado por (Flota):</p>
          <p style="margin:0 0 8px;color:#475569;">${escapeHtml(
            wo.partsDeliveredBy || wo.reportedBy || 'Encargado de Flota'
          )}</p>
          <div style="height:55px;border-bottom:1px dashed #94a3b8;"></div>
        </div>
        <div style="border:1px solid #cbd5e1;border-radius:8px;padding:10px;">
          <p style="margin:0 0 6px;font-weight:bold;">Recibido conforme (Taller Externo):</p>
          <p style="margin:0 0 8px;color:#475569;">${escapeHtml(
            wo.partsReceivedBy || ws?.contactPerson || ws?.name || 'Receptor Taller'
          )}</p>
          ${
            safeSig
              ? `<img src="${safeSig}" style="height:55px;object-fit:contain;" />`
              : `<div style="height:55px;border-bottom:1px dashed #94a3b8;"></div>`
          }
        </div>
      </div>
    </body>
    </html>
  `);
  win.document.close();
};

export const exportFleetAndStockToCSV = (
  ambulances: Ambulance[],
  spareParts: SparePart[]
) => {
  const lines: string[] = [
    'SECCION,CODIGO/SKU,MATRICULA/NOMBRE,MARCA/CATEGORIA,MODELO/UBICACION_ALMACEN,ESTADO/STOCK,KM/STOCK_MIN,ITV_VENCIMIENTO,CERT_SANITARIO',
  ];

  ambulances.forEach((a) => {
    lines.push(
      `AMBULANCIA,"${a.code}","${a.plate}","${a.brand}","${a.model}","${a.status}",${a.mileage},"${a.itvExpiry}","${a.sanitaryCertExpiry}"`
    );
  });

  spareParts.forEach((p) => {
    lines.push(
      `REPUESTO_ALMACEN,"${p.sku}","${p.name}","${p.category}","${p.warehouseLocation}",${p.stockQuantity},${p.minStockAlert},"${p.supplier}",""`
    );
  });

  const blob = new Blob(['\uFEFF' + lines.join('\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ambu-lzflota_flota_y_stock_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

export interface BreakdownReportRow {
  date: string;
  code: string;
  ambulanceCode: string;
  plate: string;
  mileage: number;
  title: string;
  workshopName: string;
  status: string;
  daysInShop: number;
  partsSummary: string;
}

export const printBreakdownsManagementReport = (params: {
  fromDate: string;
  toDate: string;
  ambulanceLabel: string;
  bossEmail?: string;
  rows: BreakdownReportRow[];
  totalUnitsAffected: number;
  totalDaysInShop: number;
  openCount: number;
}) => {
  const win = window.open('', '_blank', 'width=920,height=900');
  if (!win) return;

  const rowsHtml =
    params.rows.length > 0
      ? params.rows
          .map(
            (r) => `
          <tr>
            <td style="padding:7px;border:1px solid #cbd5e1;white-space:nowrap;">${escapeHtml(
              r.date
            )}</td>
            <td style="padding:7px;border:1px solid #cbd5e1;font-weight:bold;">${escapeHtml(
              r.ambulanceCode
            )}<br/><span style="font-size:10px;color:#64748b;font-weight:normal;">${escapeHtml(
              r.plate
            )}</span></td>
            <td style="padding:7px;border:1px solid #cbd5e1;"><strong>${escapeHtml(
              r.code
            )}</strong><br/>${escapeHtml(r.title)}</td>
            <td style="padding:7px;border:1px solid #cbd5e1;">${escapeHtml(
              r.workshopName
            )}</td>
            <td style="padding:7px;border:1px solid #cbd5e1;text-align:center;">${escapeHtml(
              r.status
            )}</td>
            <td style="padding:7px;border:1px solid #cbd5e1;text-align:center;font-weight:bold;">${
              r.daysInShop
            }d</td>
            <td style="padding:7px;border:1px solid #cbd5e1;font-size:11px;">${escapeHtml(
              r.partsSummary || '—'
            )}</td>
          </tr>`
          )
          .join('')
      : `<tr><td colspan="7" style="padding:14px;border:1px solid #cbd5e1;text-align:center;">No hay roturas registradas en el periodo seleccionado.</td></tr>`;

  win.document.write(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <title>Informe de Roturas - Ambu-lzflota</title>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; color: #0f172a; padding: 24px; max-width: 960px; margin: 0 auto; }
        .no-print { margin-bottom: 14px; display: flex; justify-content: flex-end; }
        .btn { background: #0f172a; color: #fff; border: none; padding: 8px 16px; border-radius: 8px; font-weight: bold; cursor: pointer; }
        @media print { .no-print { display: none; } }
      </style>
    </head>
    <body>
      <div class="no-print">
        <button class="btn" onclick="window.print()">Imprimir / Guardar PDF</button>
      </div>
      <div style="border-bottom:3px solid #0f172a;padding-bottom:10px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-end;">
        <div>
          ${getReportLogoHtml()}
          <h1 style="margin:0;font-size:20px;">INFORME DE ROTURAS Y AVERÍAS DE FLOTA</h1>
          <p style="margin:4px 0 0;font-size:12px;color:#475569;">Ambu-lzflota • Periodo: ${escapeHtml(
            params.fromDate || 'Inicio'
          )} a ${escapeHtml(params.toDate || 'Hoy')} • Filtro: ${escapeHtml(
    params.ambulanceLabel
  )}</p>
        </div>
        <div style="text-align:right;font-size:11px;color:#475569;">
          ${
            params.bossEmail
              ? `<div><strong>Destinatario:</strong> ${escapeHtml(params.bossEmail)}</div>`
              : ''
          }
          <div><strong>Generado:</strong> ${escapeHtml(
            new Date().toLocaleDateString('es-ES')
          )}</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px;font-size:12px;">
        <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:10px;text-align:center;">
          <div style="color:#64748b;font-size:11px;">Total Roturas</div>
          <div style="font-size:20px;font-weight:900;">${params.rows.length}</div>
        </div>
        <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:10px;text-align:center;">
          <div style="color:#64748b;font-size:11px;">Unidades Afectadas</div>
          <div style="font-size:20px;font-weight:900;">${params.totalUnitsAffected}</div>
        </div>
        <div style="background:#fff1f2;border:1px solid #fecdd3;border-radius:8px;padding:10px;text-align:center;">
          <div style="color:#be123c;font-size:11px;">Abiertas / En Taller</div>
          <div style="font-size:20px;font-weight:900;color:#be123c;">${params.openCount}</div>
        </div>
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px;text-align:center;">
          <div style="color:#b45309;font-size:11px;">Días Parado Totales</div>
          <div style="font-size:20px;font-weight:900;color:#b45309;">${params.totalDaysInShop}d</div>
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;font-size:11px;">
        <thead>
          <tr style="background:#0f172a;color:#fff;">
            <th style="padding:8px;border:1px solid #0f172a;text-align:left;">Fecha</th>
            <th style="padding:8px;border:1px solid #0f172a;text-align:left;">Unidad</th>
            <th style="padding:8px;border:1px solid #0f172a;text-align:left;">Orden / Rotura</th>
            <th style="padding:8px;border:1px solid #0f172a;text-align:left;">Taller Externo</th>
            <th style="padding:8px;border:1px solid #0f172a;">Estado</th>
            <th style="padding:8px;border:1px solid #0f172a;">Días</th>
            <th style="padding:8px;border:1px solid #0f172a;text-align:left;">Repuestos Propios</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </body>
    </html>
  `);
  win.document.close();
};
