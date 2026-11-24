import {
  Ambulance,
  FleetChecklist,
  SparePart,
  WorkOrder,
} from '../types';

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

export const shareWorkOrderViaWhatsApp = (wo: WorkOrder, amb?: Ambulance) => {
  const partsLines =
    wo.partsUsed.length > 0
      ? wo.partsUsed
          .map((p) => `• ${p.partName} (${p.sku}) x${p.quantity} uds.`)
          .join('\n')
      : '• Sin repuestos imputados todavía';

  const text = [
    `🛠️ *ORDEN DE TRABAJO TALLER: ${wo.code}*`,
    `*Unidad:* ${amb?.code || ''} (${amb?.plate || ''}) - ${amb?.brand || ''} ${
      amb?.model || ''
    }`,
    `*Estado:* ${wo.status.toUpperCase()} | *Prioridad:* ${wo.priority}`,
    `*Km Entrada:* ${wo.mileageAtEntry.toLocaleString()} km`,
    `*Mecánico:* ${wo.assignedMechanic}`,
    ``,
    `📌 *Avería:* ${wo.title}`,
    `*Detalle:* ${wo.description}`,
    ``,
    `🔩 *Diagnóstico Técnico (${wo.laborHours} h):*`,
    wo.mechanicDiagnosis || 'Pendiente de diagnóstico',
    ``,
    `📦 *Repuestos Utilizados:*`,
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
        <td style="padding:6px 8px;border:1px solid #cbd5e1;font-size:11px;">${i.section}</td>
        <td style="padding:6px 8px;border:1px solid #cbd5e1;font-size:11px;font-weight:600;">${i.label}</td>
        <td style="padding:6px 8px;border:1px solid #cbd5e1;font-size:11px;text-align:center;font-weight:700;color:${
          i.status === 'Avería'
            ? '#be123c'
            : i.status === 'Observación'
            ? '#b45309'
            : '#15803d'
        };">${i.status}</td>
        <td style="padding:6px 8px;border:1px solid #cbd5e1;font-size:11px;">${
          i.comment || '-'
        }</td>
      </tr>`
    )
    .join('');

  const missingHtml =
    chk.missingParts.length > 0
      ? chk.missingParts
          .map(
            (m) =>
              `<li><strong>${m.partName}</strong>: Faltan ${m.missingQty} uds. (${m.actionRequired})</li>`
          )
          .join('')
      : '<li>Dotación de piezas a bordo del vehículo completa.</li>';

  const photosHtml =
    chk.photos && chk.photos.length > 0
      ? `<div style="margin-top:16px;">
          <h3 style="font-size:13px;margin-bottom:8px;">Evidencias Fotográficas Adjuntas (${chk.photos.length})</h3>
          <div style="display:flex;flex-wrap:wrap;gap:10px;">
            ${chk.photos
              .map(
                (p) =>
                  `<img src="${p}" style="width:160px;height:115px;object-fit:cover;border:1px solid #94a3b8;border-radius:6px;" />`
              )
              .join('')}
          </div>
        </div>`
      : '';

  const signatureHtml = chk.inspectorSignature
    ? `<div style="margin-top:20px;border-top:1px solid #cbd5e1;padding-top:12px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <p style="font-size:12px;font-weight:bold;margin:0;">Firmado por Responsable de Flota:</p>
          <p style="font-size:11px;color:#475569;margin:2px 0;">${chk.inspectorName}</p>
        </div>
        <img src="${chk.inspectorSignature}" style="height:65px;border:1px solid #cbd5e1;padding:4px;border-radius:6px;" />
      </div>`
    : '';

  win.document.write(`
    <!doctype html>
    <html lang="es">
    <head>
      <meta charset="utf-8" />
      <title>Checklist ${amb?.code || ''} - ${chk.date}</title>
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
          <h1 style="font-size:18px;margin:0;">AMBUFLEET MECÁNICA — PARTE DE INSPECCIÓN A TALLER</h1>
          <p style="font-size:12px;color:#475569;margin:4px 0 0;">Checklist del Responsable de Flota y Auditoría de Stock del Vehículo</p>
        </div>
        <div style="text-align:right;font-size:12px;">
          <strong>Fecha:</strong> ${chk.date}<br/>
          <strong>Urgencia:</strong> ${chk.overallUrgency}
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;background:#f8fafc;padding:12px;border:1px solid #cbd5e1;border-radius:8px;margin-top:14px;font-size:12px;">
        <div><strong>Unidad:</strong> ${amb?.code} (${amb?.plate})</div>
        <div><strong>Vehículo:</strong> ${amb?.brand} ${amb?.model}</div>
        <div><strong>Kilometraje:</strong> ${chk.mileageAtInspection.toLocaleString()} km</div>
      </div>

      <p style="font-size:12px;background:#f1f5f9;padding:10px;border-radius:6px;margin-top:12px;">
        <strong>Observaciones Generales al Taller:</strong> ${chk.generalObservations}
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

export const printWorkOrderReport = (wo: WorkOrder, amb?: Ambulance) => {
  const win = window.open('', '_blank');
  if (!win) return;

  const partsHtml =
    wo.partsUsed.length > 0
      ? wo.partsUsed
          .map(
            (p) => `
          <tr>
            <td style="padding:6px 8px;border:1px solid #cbd5e1;font-size:12px;">${p.partName}</td>
            <td style="padding:6px 8px;border:1px solid #cbd5e1;font-size:12px;font-family:monospace;">${p.sku}</td>
            <td style="padding:6px 8px;border:1px solid #cbd5e1;font-size:12px;text-align:center;font-weight:bold;">${p.quantity} uds.</td>
          </tr>`
          )
          .join('')
      : `<tr><td colspan="3" style="padding:8px;border:1px solid #cbd5e1;text-align:center;font-size:12px;">Sin repuestos registrados</td></tr>`;

  const photosHtml =
    wo.photos && wo.photos.length > 0
      ? `<div style="margin-top:16px;">
          <h3 style="font-size:13px;margin-bottom:8px;">Fotografías de la Avería / Intervención (${wo.photos.length})</h3>
          <div style="display:flex;flex-wrap:wrap;gap:10px;">
            ${wo.photos
              .map(
                (p) =>
                  `<img src="${p}" style="width:160px;height:115px;object-fit:cover;border:1px solid #94a3b8;border-radius:6px;" />`
              )
              .join('')}
          </div>
        </div>`
      : '';

  win.document.write(`
    <!doctype html>
    <html lang="es">
    <head>
      <meta charset="utf-8" />
      <title>Orden de Trabajo ${wo.code} - ${amb?.plate || ''}</title>
      <style>
        body { font-family: Arial, sans-serif; color: #0f172a; margin: 24px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        @media print { .no-print { display: none; } }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom:16px;text-align:right;">
        <button onclick="window.print()" style="padding:8px 16px;background:#2563eb;color:white;border:none;border-radius:6px;font-weight:bold;cursor:pointer;">
          Imprimir Hoja de Taller / Guardar PDF
        </button>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0f172a;padding-bottom:12px;">
        <div>
          <h1 style="font-size:18px;margin:0;">ORDEN DE TRABAJO EN TALLER — ${wo.code}</h1>
          <p style="font-size:12px;color:#475569;margin:4px 0 0;">AmbuFleet Mecánica • Gestión de Flota Sanitaria</p>
        </div>
        <div style="text-align:right;font-size:12px;">
          <strong>Estado:</strong> ${wo.status}<br/>
          <strong>Prioridad:</strong> ${wo.priority}<br/>
          <strong>Fecha Entrada:</strong> ${wo.createdAt}
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;background:#f8fafc;padding:12px;border:1px solid #cbd5e1;border-radius:8px;margin-top:14px;font-size:12px;">
        <div><strong>Unidad:</strong> ${amb?.code} (${amb?.plate})</div>
        <div><strong>Modelo:</strong> ${amb?.brand} ${amb?.model}</div>
        <div><strong>Km Entrada:</strong> ${wo.mileageAtEntry.toLocaleString()} km</div>
        <div><strong>Tipo:</strong> ${wo.type}</div>
        <div><strong>Solicitado por:</strong> ${wo.reportedBy}</div>
        <div><strong>Mecánico:</strong> ${wo.assignedMechanic}</div>
      </div>

      <div style="margin-top:14px;font-size:12px;background:#f1f5f9;padding:12px;border-radius:6px;">
        <p style="margin:0 0 6px;"><strong>Avería / Trabajo Solicitado:</strong> ${wo.title}</p>
        <p style="margin:0;"><strong>Descripción de Síntomas:</strong> ${wo.description}</p>
      </div>

      <div style="margin-top:14px;font-size:12px;background:#fff;border:1px solid #cbd5e1;padding:12px;border-radius:6px;">
        <p style="margin:0 0 6px;"><strong>Informe de Intervención del Mecánico (${wo.laborHours} horas invertidas):</strong></p>
        <p style="margin:0;">${wo.mechanicDiagnosis || 'Pendiente de completar informe técnico.'}</p>
      </div>

      <h3 style="font-size:13px;margin-top:16px;margin-bottom:4px;">Repuestos Instalados del Almacén</h3>
      <table>
        <thead>
          <tr style="background:#e2e8f0;font-size:11px;text-align:left;">
            <th style="padding:6px 8px;border:1px solid #cbd5e1;">Repuesto</th>
            <th style="padding:6px 8px;border:1px solid #cbd5e1;">Código SKU</th>
            <th style="padding:6px 8px;border:1px solid #cbd5e1;text-align:center;">Cantidad</th>
          </tr>
        </thead>
        <tbody>${partsHtml}</tbody>
      </table>

      ${photosHtml}

      <div style="margin-top:24px;border-top:1px solid #cbd5e1;padding-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:20px;">
        <div style="border:1px solid #cbd5e1;padding:10px;border-radius:8px;">
          <p style="font-size:11px;font-weight:bold;margin:0 0 6px;">Firma Entrega a Taller (Resp. Flota — ${wo.reportedBy}):</p>
          ${
            wo.inspectorSignature
              ? `<img src="${wo.inspectorSignature}" style="height:60px;object-contain;" />`
              : `<div style="height:60px;border-bottom:1px dashed #94a3b8;"></div>`
          }
        </div>
        <div style="border:1px solid #cbd5e1;padding:10px;border-radius:8px;">
          <p style="font-size:11px;font-weight:bold;margin:0 0 6px;">Firma Alta Mecánica (Jefe de Taller — ${wo.assignedMechanic}):</p>
          ${
            wo.mechanicSignature
              ? `<img src="${wo.mechanicSignature}" style="height:60px;object-contain;" />`
              : `<div style="height:60px;border-bottom:1px dashed #94a3b8;"></div>`
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
    'SECCION,CODIGO/SKU,MATRICULA/NOMBRE,MARCA/CATEGORIA,MODELO/UBICACION,ESTADO/STOCK,KM/STOCK_MIN,ITV_VENCIMIENTO,CERT_SANITARIO',
  ];

  ambulances.forEach((a) => {
    lines.push(
      `AMBULANCIA,"${a.code}","${a.plate}","${a.brand}","${a.model}","${a.status}",${a.mileage},"${a.itvExpiry}","${a.sanitaryCertExpiry}"`
    );
  });

  spareParts.forEach((p) => {
    lines.push(
      `REPUESTO_TALLER,"${p.sku}","${p.name}","${p.category}","${p.locationInWorkshop}",${p.stockQuantity},${p.minStockAlert},"${p.supplier}",""`
    );
  });

  const blob = new Blob(['\uFEFF' + lines.join('\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ambufleet_flota_y_stock_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
