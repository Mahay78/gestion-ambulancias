import {
  Ambulance,
  ExternalWorkshop,
  FleetChecklist,
  PreventiveSchedule,
  SparePart,
  WorkOrder,
  WorkOrderPriority,
} from '../types';
import { collectAllDocumentAlerts } from './expiryAlerts';
import { getLocalDateString } from './dateUtils';
import { STORAGE_KEY } from './storage';

const AI_API_KEY_STORAGE = `${STORAGE_KEY}_gemini_free_key`;

export interface FleetContextData {
  ambulances: Ambulance[];
  workshops: ExternalWorkshop[];
  workOrders: WorkOrder[];
  checklists: FleetChecklist[];
  preventiveSchedules: PreventiveSchedule[];
  spareParts: SparePart[];
}

export interface TriageSuggestion {
  priority: WorkOrderPriority;
  recommendedWorkshopId?: string;
  recommendedWorkshopName?: string;
  specialty: string;
  reason: string;
}

export const getSavedGeminiFreeKey = (): string => {
  try {
    return localStorage.getItem(AI_API_KEY_STORAGE) || '';
  } catch {
    return '';
  }
};

export const saveGeminiFreeKey = (key: string): void => {
  try {
    const clean = key.trim();
    if (clean) {
      localStorage.setItem(AI_API_KEY_STORAGE, clean);
    } else {
      localStorage.removeItem(AI_API_KEY_STORAGE);
    }
  } catch {
    // ignorar
  }
};

/**
 * Triaje inteligente local (100% gratis, sin API externa) para sugerir prioridad y taller externo.
 */
export const suggestLocalBreakdownTriage = (
  text: string,
  workshops: ExternalWorkshop[]
): TriageSuggestion => {
  const q = text.toLowerCase();

  let priority: WorkOrderPriority = 'Media';
  if (
    /freno|direcci[oó]n|airbag|humo|fuego|aceite|inmoviliz|no arranca|pérdida|fuga|neum[aá]tico revent|pinchazo/.test(
      q
    )
  ) {
    priority = 'Crítica (Urgente)';
  } else if (
    /bater[ií]a|alternador|sirena|prioritario|puente|aire acondicionado|a\/c|camilla|ox[ií]geno|testigo|fallo motor/.test(
      q
    )
  ) {
    priority = 'Alta';
  } else if (/roce|pintura|piloto|bombilla|limpia|ruido leve/.test(q)) {
    priority = 'Baja';
  }

  let specialty = 'Mecánica General';
  if (/bater[ií]a|alternador|sirena|prioritario|led|luz|faro|fusible|el[eé]ctric|inversor|220v/.test(q)) {
    specialty = 'Electricidad y Prioritarios';
  } else if (/neum[aá]tico|rueda|pinchazo|freno|pastilla|disco|alineaci[oó]n/.test(q)) {
    specialty = 'Neumáticos y Frenos';
  } else if (/c[eé]lula|camilla|aire acondicionado|a\/c|puerta lateral|pelda[ñn]o|carroz/.test(q)) {
    specialty = 'Carrozado Sanitario';
  } else if (/golpe|roce|chapa|pintura|paragolpes|luna|cristal|parabrisas/.test(q)) {
    specialty = 'Chapa y Pintura';
  } else if (/garant[ií]a|diagnosis|oficial|sprinter|crafter|adblue/.test(q)) {
    specialty = 'Servicio Oficial Marca';
  }

  const matchedWs =
    workshops.find((w) => w.specialty === specialty) || workshops[0];

  return {
    priority,
    recommendedWorkshopId: matchedWs?.id,
    recommendedWorkshopName: matchedWs?.name,
    specialty,
    reason: `Detectada especialidad "${specialty}" con prioridad "${priority}" según los síntomas descritos.`,
  };
};

/**
 * Motor de respuestas inteligente local (100% gratis y offline) sobre toda la flota.
 */
export const answerFleetQuestionLocally = (
  question: string,
  ctx: FleetContextData
): string => {
  const q = question.toLowerCase().trim();
  const today = getLocalDateString();

  // 1. Consulta específica de una ambulancia (AMB-XX o matrícula)
  const ambMatch = ctx.ambulances.find(
    (a) =>
      q.includes(a.code.toLowerCase()) ||
      q.includes(a.plate.toLowerCase()) ||
      q.includes(a.plate.replace(/[^a-z0-9]/gi, '').toLowerCase())
  );

  if (ambMatch) {
    const ambOrders = ctx.workOrders.filter(
      (w) => w.ambulanceId === ambMatch.id && w.status !== 'Cerrada'
    );
    const missingOnboard = ambMatch.onboardParts.filter(
      (p) => p.currentQty < p.requiredQty || p.status === 'Falta'
    );
    const docAlerts = collectAllDocumentAlerts([ambMatch]);
    const activeDamages = (ambMatch.bodyDamages || []).filter((d) => !d.repaired);

    return [
      `🚑 **Ficha Rápida ${ambMatch.code} (${ambMatch.plate})**`,
      `• **Modelo:** ${ambMatch.brand} ${ambMatch.model} (${ambMatch.year})`,
      `• **Estado:** ${ambMatch.status} | **Kilometraje:** ${ambMatch.mileage.toLocaleString()} km`,
      `• **Base:** ${ambMatch.baseLocation}`,
      `• **Órdenes abiertas:** ${ambOrders.length > 0 ? ambOrders.map((o) => `${o.code} (${o.status})`).join(', ') : 'Ninguna'}`,
      `• **Alertas documentales (≤30d/vencidas):** ${docAlerts.length > 0 ? docAlerts.map((d) => `${d.document.type}: ${d.daysRemaining}d`).join(', ') : 'Todo en regla'}`,
      `• **Dotación a bordo faltante:** ${missingOnboard.length > 0 ? missingOnboard.map((m) => m.partName).join(', ') : 'Completa (OK)'}`,
      `• **Daños carrocería activos:** ${activeDamages.length}`,
    ].join('\n');
  }

  // 2. Vencimientos documentales (ITV, Seguro, Técnico-Sanitario)
  if (/itv|seguro|document|venc|caduc|sanitari|ficha/.test(q)) {
    const alerts = collectAllDocumentAlerts(ctx.ambulances);
    if (alerts.length === 0) {
      return '✅ Todos los documentos (ITV, Seguro, Certificado Técnico-Sanitario y Ficha Técnica) de la flota están al día (> 30 días).';
    }
    const top = alerts
      .slice(0, 8)
      .map(
        (a) =>
          `• **${a.ambulanceCode}** (${a.ambulancePlate}) — ${a.document.type}: ${
            a.daysRemaining < 0
              ? `VENCIDO hace ${Math.abs(a.daysRemaining)} días`
              : `vence en ${a.daysRemaining} días (${a.document.expiryDate})`
          }`
      );
    return `📄 **Alertas Documentales (${alerts.length} encontradas):**\n${top.join('\n')}`;
  }

  // 3. Stock / Repuestos / Almacén / Dotación
  if (/stock|repuesto|almac[eé]n|pieza|falta|m[ií]nimo|dotaci[oó]n/.test(q)) {
    const lowStock = ctx.spareParts.filter(
      (p) => p.stockQuantity <= p.minStockAlert
    );
    const missingUnits = ctx.ambulances.filter((a) =>
      a.onboardParts.some((p) => p.currentQty < p.requiredQty || p.status === 'Falta')
    );
    const lowLines =
      lowStock.length > 0
        ? lowStock
            .slice(0, 8)
            .map(
              (p) =>
                `• **${p.name}** (${p.sku}): ${p.stockQuantity} uds. (mín. ${p.minStockAlert}) — ${p.warehouseLocation}`
            )
            .join('\n')
        : '• Todo el stock del almacén está por encima del mínimo.';
    return `📦 **Resumen de Almacén y Dotación:**\n${lowLines}\n\n🚑 **Unidades con dotación a bordo incompleta:** ${missingUnits.length > 0 ? missingUnits.map((a) => a.code).join(', ') : 'Ninguna'}`;
  }

  // 4. Talleres / Órdenes / Días parado
  if (/taller|orden|reparaci[oó]n|parado|aver[ií]a|garant[ií]a/.test(q)) {
    const openOrders = ctx.workOrders.filter((w) => w.status !== 'Cerrada');
    if (openOrders.length === 0) {
      return '✅ No hay órdenes de reparación externas abiertas ahora mismo.';
    }
    const lines = openOrders.slice(0, 8).map((wo) => {
      const amb = ctx.ambulances.find((a) => a.id === wo.ambulanceId);
      const ws = ctx.workshops.find((w) => w.id === wo.workshopId);
      const days = Math.max(
        0,
        Math.round(
          (new Date(`${today}T00:00:00`).getTime() -
            new Date(`${wo.entryDate || wo.createdAt}T00:00:00`).getTime()) /
            (1000 * 3600 * 24)
        )
      );
      return `• **${wo.code}** (${amb?.code || '?'}) — ${wo.status} en *${ws?.name || 'Por asignar'}* (${days} días) — ${wo.title}`;
    });
    return `🛠️ **Órdenes Externas Abiertas (${openOrders.length}):**\n${lines.join('\n')}`;
  }

  // 5. Preventivos
  if (/preventivo|aceite|freno|revisi[oó]n|mantenimiento/.test(q)) {
    const overdue = ctx.preventiveSchedules.filter((ps) => {
      const amb = ctx.ambulances.find((a) => a.id === ps.ambulanceId);
      const kmOver = ps.nextDueKm && amb ? amb.mileage >= ps.nextDueKm : false;
      const dateOver = ps.nextDueDate ? ps.nextDueDate <= today : false;
      return kmOver || dateOver;
    });
    return `🗓️ **Mantenimiento Preventivo:**\n• Total planes activos: **${ctx.preventiveSchedules.length}**\n• Vencidos por fecha o km: **${overdue.length}**${
      overdue.length > 0
        ? `\n` +
          overdue
            .slice(0, 6)
            .map((ps) => {
              const amb = ctx.ambulances.find((a) => a.id === ps.ambulanceId);
              return `  - ${amb?.code || '?'}: ${ps.title}`;
            })
            .join('\n')
        : ''
    }`;
  }

  // 6. Resumen general por defecto
  const avail = ctx.ambulances.filter((a) => a.status === 'Disponible').length;
  const inShop = ctx.ambulances.filter((a) => a.status === 'En taller').length;
  const out = ctx.ambulances.filter((a) => a.status === 'Fuera de servicio').length;
  const docAlertsCount = collectAllDocumentAlerts(ctx.ambulances).length;
  const openWoCount = ctx.workOrders.filter((w) => w.status !== 'Cerrada').length;
  const lowStockCount = ctx.spareParts.filter(
    (p) => p.stockQuantity <= p.minStockAlert
  ).length;

  return [
    `📊 **Resumen Ejecutivo de Ambu-lzflota (${today}):**`,
    `• **Flota (${ctx.ambulances.length}):** ${avail} Disponibles | ${inShop} En taller | ${out} Fuera de servicio`,
    `• **Alertas documentales (≤30d / vencidas):** ${docAlertsCount}`,
    `• **Órdenes externas abiertas:** ${openWoCount}`,
    `• **Repuestos bajo mínimos:** ${lowStockCount}`,
    ``,
    `💡 *Puedes preguntarme por una unidad concreta (ej. "AMB-04" o matrícula), "vencimientos ITV", "stock bajo", "órdenes en taller" o "preventivos".*`,
  ].join('\n');
};

/**
 * Consulta opcional a Google Gemini Free Tier si el usuario introdujo su API Key gratuita.
 * Si falla o no hay key, hace fallback automático al motor local gratuito.
 */
export const askFleetAiAssistant = async (
  question: string,
  ctx: FleetContextData,
  imageBase64DataUrl?: string
): Promise<{ text: string; provider: 'gemini-free' | 'local-free' }> => {
  const apiKey = getSavedGeminiFreeKey();
  if (!apiKey) {
    return {
      text: answerFleetQuestionLocally(question, ctx),
      provider: 'local-free',
    };
  }

  try {
    const docAlerts = collectAllDocumentAlerts(ctx.ambulances)
      .slice(0, 15)
      .map(
        (a) =>
          `${a.ambulanceCode}(${a.ambulancePlate}): ${a.document.type} en ${a.daysRemaining}d`
      );
    const openOrders = ctx.workOrders
      .filter((w) => w.status !== 'Cerrada')
      .slice(0, 15)
      .map((w) => {
        const amb = ctx.ambulances.find((a) => a.id === w.ambulanceId);
        return `${w.code} ${amb?.code || ''} [${w.status}]: ${w.title}`;
      });
    const lowStock = ctx.spareParts
      .filter((p) => p.stockQuantity <= p.minStockAlert)
      .map((p) => `${p.name} (${p.sku}): ${p.stockQuantity}/${p.minStockAlert}`);

    const systemContext = `Eres el asistente IA de Ambu-lzflota (flota de ${ctx.ambulances.length} ambulancias, sin campos económicos). Responde en español, breve y práctico.
Datos actuales:
- Unidades: ${ctx.ambulances.map((a) => `${a.code}(${a.plate},${a.status},${a.mileage}km)`).join('; ')}
- Alertas documentos: ${docAlerts.join('; ') || 'Ninguna'}
- Órdenes abiertas: ${openOrders.join('; ') || 'Ninguna'}
- Stock bajo: ${lowStock.join('; ') || 'Ninguno'}
- Talleres: ${ctx.workshops.map((w) => `${w.name}(${w.specialty})`).join('; ')}`;

    const parts: Record<string, unknown>[] = [
      { text: `${systemContext}\n\nPregunta del usuario: ${question}` },
    ];

    if (imageBase64DataUrl && imageBase64DataUrl.startsWith('data:image/')) {
      const [meta, data] = imageBase64DataUrl.split(',');
      const mimeMatch = meta.match(/data:(image\/[^;]+);/);
      if (data && mimeMatch) {
        parts.push({
          inline_data: {
            mime_type: mimeMatch[1],
            data,
          },
        });
      }
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
        apiKey
      )}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }] }),
      }
    );

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const json = await res.json();
    const reply = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (reply && typeof reply === 'string') {
      return { text: reply, provider: 'gemini-free' };
    }
    throw new Error('Respuesta vacía');
  } catch {
    return {
      text: answerFleetQuestionLocally(question, ctx),
      provider: 'local-free',
    };
  }
};
