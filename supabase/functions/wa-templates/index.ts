// wa-templates — administra las plantillas de WhatsApp en Meta.
//   { "action": "create" }  -> somete el catálogo a aprobación de Meta
//   { "action": "list" }    -> lista las plantillas y su estado actual
// Lee el token del secreto WHATSAPP_TOKEN. WABA ID configurable por env.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GRAPH = "https://graph.facebook.com/v21.0";
const WABA_ID = Deno.env.get("WHATSAPP_WABA_ID") || "1033375755765717";
const LANG = "es_MX";

// Catálogo de plantillas en español. Variables posicionales {{1}}, {{2}}, …
interface Tpl { name: string; category: string; body: string; example: string[]; footer?: string }
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
];

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), { status, headers: { "Content-Type": "application/json" } });
}

async function createTemplate(token: string, t: Tpl) {
  const components: unknown[] = [
    { type: "BODY", text: t.body, example: { body_text: [t.example] } },
  ];
  if (t.footer) components.push({ type: "FOOTER", text: t.footer });
  const res = await fetch(`${GRAPH}/${WABA_ID}/message_templates`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: t.name, language: LANG, category: t.category, components }),
  });
  const data = await res.json();
  return { name: t.name, ok: res.ok, status: res.status, data };
}

Deno.serve(async (req: Request) => {
  try {
    const token = Deno.env.get("WHATSAPP_TOKEN");
    if (!token) return json({ error: "Falta el secreto WHATSAPP_TOKEN en Supabase." }, 500);
    const body = await req.json().catch(() => ({}));
    const action = body.action || "list";

    if (action === "list") {
      const res = await fetch(`${GRAPH}/${WABA_ID}/message_templates?fields=name,status,category,language&limit=100`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      return json(await res.json(), res.ok ? 200 : 400);
    }

    if (action === "create") {
      const results = [];
      for (const t of CATALOGO) results.push(await createTemplate(token, t));
      return json({ submitted: results }, 200);
    }

    return json({ error: "action debe ser 'create' o 'list'" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
