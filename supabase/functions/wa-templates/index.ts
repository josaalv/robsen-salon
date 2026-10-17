// wa-templates — administra las plantillas de WhatsApp y el webhook en
// YCloud (Tech Provider, coexistence — ver docs/PENDIENTES.md).
//   { "action": "create" }           -> somete el catálogo a aprobación
//   { "action": "list" }             -> lista las plantillas y su estado actual
//   { "action": "sync" }             -> refleja el estado real en wa_plantillas.estado_meta
//   { "action": "register-webhook" } -> registra wa-webhook en YCloud (una sola vez)
// Lee la API key del secreto YCLOUD_API_KEY.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const YCLOUD_BASE = "https://api.ycloud.com/v2";
// WABA real del número +52 1 33 1175 1393, visible en el dashboard de
// YCloud (WhatsApp Manager → WhatsApp accounts). Fijo en código (no en
// secreto) — es un identificador, no una credencial; mismo criterio que ya
// se usaba con el WABA_ID de Meta.
const WABA_ID = "2828283060886913";
const LANG = "es_MX";
const SUPA_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Traduce el estado de YCloud/Meta al que usa la app en wa_plantillas.estado_meta.
function metaEstado(status: string): string {
  const s = (status || "").toUpperCase();
  if (s === "APPROVED") return "aprobada";
  if (s === "REJECTED" || s === "DISABLED" || s === "PAUSED") return "rechazada";
  return "pendiente";
}

// Catálogo de plantillas en español. Variables posicionales {{1}}, {{2}}, …
interface Tpl { name: string; category: string; body: string; example: string[]; footer?: string; buttons?: string[] }
const CATALOGO: Tpl[] = [
  {
    name: "confirmacion_cita",
    category: "UTILITY",
    body: "Hola {{1}} 💛 Confirmamos tu cita de {{2}} el {{3}} a las {{4}} con {{5}} en Robsen Salón & Spa. Responde CONFIRMO para apartar tu lugar.",
    example: ["Ana", "Corte y peinado", "14 Ago", "4:00 pm", "Valeria"],
    footer: "Robsen Salón & Spa",
  },
  {
    name: "recordatorio_24h",
    category: "UTILITY",
    body: "¡Hola {{1}}! Te recordamos tu cita de {{2}} mañana a las {{3}} con {{4}}. Responde CONFIRMO para confirmar tu asistencia. ✨",
    example: ["Ana", "Tinte", "11:30 am", "Renata"],
    footer: "Robsen Salón & Spa",
    // Botones de respuesta rápida: en una plantilla aprobada el payload es
    // fijo (mismo texto para cualquiera que la reciba) — wa-webhook resuelve
    // a qué cita corresponde por teléfono + recencia, no por un id embebido.
    buttons: ["Confirmar", "Cancelar"],
  },
  {
    name: "post_visita",
    category: "UTILITY",
    body: "Gracias por visitarnos, {{1}} ✨ Fue un placer consentirte con tu {{2}}. Nos encantará verte pronto en Robsen Salón & Spa 💛",
    example: ["Ana", "balayage"],
    footer: "Robsen Salón & Spa",
  },
  {
    name: "cumpleanos",
    category: "MARKETING",
    body: "¡Feliz cumpleaños, {{1}}! 🎂🎉 Todo el equipo de Robsen Salón & Spa te desea un día increíble. Ven a consentirte: tienes un regalo especial esperándote 🎁",
    example: ["Ana"],
    footer: "Robsen Salón & Spa",
  },
  {
    name: "bienvenida",
    category: "MARKETING",
    body: "¡Bienvenida a Robsen Salón & Spa, {{1}}! 💛 Gracias por tu confianza. Estamos para consentirte; cualquier duda, escríbenos por aquí. ✨",
    example: ["Ana"],
    footer: "Robsen Salón & Spa",
  },
  {
    name: "reactivacion",
    category: "MARKETING",
    body: "Te extrañamos, {{1}} 💛 Han pasado {{2}} días desde tu última visita. Regresa a Robsen con un 20% en tu próximo {{3}}. ¿Agendamos? ✨",
    example: ["Ana", "75", "servicio"],
    footer: "Robsen Salón & Spa",
  },
  // Completa los disparadores automáticos por estado de cita: ya había para
  // creación (confirmacion_cita) y cierre (post_visita), faltaban estos dos
  // — ver wa_trigger_cita_cancelada/wa_trigger_cita_no_asistio en
  // 069_wa_triggers_cancelacion_no_asistio.sql.
  {
    name: "cita_cancelada",
    category: "UTILITY",
    body: "Hola {{1}} 💛 Tu cita de {{2}} del {{3}} a las {{4}} quedó cancelada. Si fue un error o quieres reagendar, escríbenos por aquí.",
    example: ["Ana", "Corte y peinado", "14 Ago", "4:00 pm"],
    footer: "Robsen Salón & Spa",
  },
  {
    name: "cita_no_asistio",
    category: "UTILITY",
    body: "Hola {{1}}, notamos que no pudiste llegar a tu cita de {{2}} de hoy. Esperamos que todo esté bien — si quieres reagendar, aquí estamos 💛",
    example: ["Ana", "Corte y peinado"],
    footer: "Robsen Salón & Spa",
  },
];

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), { status, headers: { "Content-Type": "application/json" } });
}

function buildComponents(t: Tpl): unknown[] {
  const components: unknown[] = [
    { type: "BODY", text: t.body, example: { body_text: [t.example] } },
  ];
  if (t.footer) components.push({ type: "FOOTER", text: t.footer });
  if (t.buttons?.length) {
    components.push({ type: "BUTTONS", buttons: t.buttons.map(b => ({ type: "QUICK_REPLY", text: b })) });
  }
  return components;
}

async function createTemplate(apiKey: string, t: Tpl) {
  const res = await fetch(`${YCLOUD_BASE}/whatsapp/templates`, {
    method: "POST",
    headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ wabaId: WABA_ID, name: t.name, language: LANG, category: t.category, components: buildComponents(t) }),
  });
  const data = await res.json();
  return { name: t.name, ok: res.ok && !data?.error, status: res.status, data };
}

Deno.serve(async (req: Request) => {
  try {
    const apiKey = Deno.env.get("YCLOUD_API_KEY");
    if (!apiKey) return json({ error: "Falta el secreto YCLOUD_API_KEY en Supabase." }, 500);
    const body = await req.json().catch(() => ({}));
    const action = body.action || "list";

    if (action === "list") {
      const res = await fetch(
        `${YCLOUD_BASE}/whatsapp/templates?filter.wabaId=${encodeURIComponent(WABA_ID)}&limit=100`,
        { headers: { "X-API-Key": apiKey } },
      );
      return json(await res.json(), res.ok ? 200 : 400);
    }

    if (action === "create") {
      // body.names opcional: ["cita_cancelada", ...] — para someter solo
      // plantillas nuevas sin reenviar las que ya están aprobadas.
      const names: string[] | undefined = Array.isArray(body.names) ? body.names : undefined;
      const lista = names ? CATALOGO.filter(t => names.includes(t.name)) : CATALOGO;
      const results = [];
      for (const t of lista) results.push(await createTemplate(apiKey, t));
      return json({ submitted: results }, 200);
    }

    // sync: lee el estado real en YCloud y lo refleja en wa_plantillas.estado_meta,
    // para que el panel muestre "Aprobada" en cuanto Meta apruebe (sin tocar la BD a mano).
    if (action === "sync") {
      const res = await fetch(
        `${YCLOUD_BASE}/whatsapp/templates?filter.wabaId=${encodeURIComponent(WABA_ID)}&limit=100`,
        { headers: { "X-API-Key": apiKey } },
      );
      const data = await res.json();
      if (!res.ok || !Array.isArray(data?.items)) return json({ error: "No se pudo leer YCloud", detail: data }, 400);
      if (!SUPA_URL || !SERVICE) return json({ error: "Faltan credenciales de servicio para actualizar la BD." }, 500);

      const cambios: { nombre: string; estado: string }[] = [];
      for (const t of data.items) {
        const estado = metaEstado(t.status);
        cambios.push({ nombre: t.name, estado });
        await fetch(`${SUPA_URL}/rest/v1/wa_plantillas?nombre=eq.${encodeURIComponent(t.name)}`, {
          method: "PATCH",
          headers: {
            "apikey": SERVICE, "Authorization": `Bearer ${SERVICE}`,
            "Content-Type": "application/json", "Prefer": "return=minimal",
          },
          body: JSON.stringify({ estado_meta: estado }),
        });
      }
      return json({ sincronizados: cambios.length, cambios }, 200);
    }

    // register-webhook: registra wa-webhook contra YCloud UNA SOLA VEZ (ver
    // docs/PENDIENTES.md). YCloud regresa un 'secret' que NO vuelve a
    // mostrarse — hay que copiarlo de la respuesta y guardarlo de inmediato
    // como el secreto YCLOUD_WEBHOOK_SECRET en Supabase, o wa-webhook
    // rechazará todos los eventos entrantes por firma inválida.
    if (action === "register-webhook") {
      if (!SUPA_URL) return json({ error: "Falta SUPABASE_URL." }, 500);
      const projectRef = new URL(SUPA_URL).hostname.split(".")[0];
      const url = `https://${projectRef}.supabase.co/functions/v1/wa-webhook`;
      const res = await fetch(`${YCLOUD_BASE}/webhookEndpoints`, {
        method: "POST",
        headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          enabledEvents: [
            "whatsapp.inbound_message.received",
            "whatsapp.message.updated",
            "whatsapp.smb.message.echoes",
          ],
        }),
      });
      const data = await res.json();
      return json({ ok: res.ok, url, data, aviso: "Copia 'secret' de la respuesta y guárdalo como YCLOUD_WEBHOOK_SECRET en Supabase — no se vuelve a mostrar." }, res.ok ? 200 : 400);
    }

    return json({ error: "action debe ser 'create', 'list', 'sync' o 'register-webhook'" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
