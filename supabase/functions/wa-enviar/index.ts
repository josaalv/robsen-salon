// wa-enviar — conector de envío. Toma los mensajes 'aprobado' de la cola
// (wa_mensajes), los envía por la Cloud API con sus variables y actualiza el
// estado a 'enviado' (o 'fallido'). Usa service role para leer/escribir la cola.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GRAPH = "https://graph.facebook.com/v21.0";
const PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || "1252418747952067";
const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), { status, headers: { "Content-Type": "application/json" } });
}

// Normaliza a formato E.164 que espera Meta (solo dígitos, con lada país).
// Los teléfonos se capturan a 10 dígitos (MX); se les antepone 52. Si ya
// traen lada (12–13 dígitos empezando en 52) se dejan como están.
function normTel(raw: string): string {
  const d = String(raw || "").replace(/\D/g, "");
  if (d.length === 10) return "52" + d;               // MX local -> +52
  if (d.length === 11 && d.startsWith("1")) return "52" + d.slice(1); // 1+10 mal capturado
  return d;                                             // ya trae lada o formato no-MX
}

async function rest(path: string, init: RequestInit = {}) {
  return fetch(`${SUPA_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      "apikey": SERVICE,
      "Authorization": `Bearer ${SERVICE}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

// deno-lint-ignore no-explicit-any
async function enviarUno(token: string, m: any) {
  const lang = m.plantilla === "hello_world" ? "en_US" : "es_MX";
  const vars = m.variables || {};
  const keys = Object.keys(vars).sort((a, b) => Number(a) - Number(b));
  const params = keys.map((k) => ({ type: "text", text: String(vars[k]) }));
  // deno-lint-ignore no-explicit-any
  const template: any = { name: m.plantilla, language: { code: lang } };
  if (params.length) template.components = [{ type: "body", parameters: params }];

  const to = normTel(m.tel);
  if (to.length < 12) {
    const nowIso = new Date().toISOString();
    await rest(`wa_mensajes?id=eq.${m.id}`, {
      method: "PATCH", headers: { "Prefer": "return=minimal" },
      body: JSON.stringify({ estado: "fallido", error: `Teléfono inválido: ${m.tel}`, updated_at: nowIso }),
    });
    return { id: m.id, ok: false, error: `tel_invalido:${m.tel}` };
  }

  const res = await fetch(`${GRAPH}/${PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "template", template }),
  });
  const data = await res.json();
  const nowIso = new Date().toISOString();
  if (res.ok) {
    const wamid = data?.messages?.[0]?.id ?? null;
    await rest(`wa_mensajes?id=eq.${m.id}`, {
      method: "PATCH", headers: { "Prefer": "return=minimal" },
      body: JSON.stringify({ estado: "enviado", wa_message_id: wamid, enviado_at: nowIso, error: null, updated_at: nowIso }),
    });
    return { id: m.id, ok: true, wamid };
  } else {
    const err = JSON.stringify(data?.error ?? data).slice(0, 500);
    await rest(`wa_mensajes?id=eq.${m.id}`, {
      method: "PATCH", headers: { "Prefer": "return=minimal" },
      body: JSON.stringify({ estado: "fallido", error: err, updated_at: nowIso }),
    });
    return { id: m.id, ok: false, error: err };
  }
}

Deno.serve(async (_req: Request) => {
  try {
    const token = Deno.env.get("WHATSAPP_TOKEN");
    if (!token) return json({ error: "Falta el secreto WHATSAPP_TOKEN." }, 500);

    // Mensajes aprobados y cuyo horario programado ya llegó (o sin programar).
    const res = await rest(`wa_mensajes?estado=eq.aprobado&select=*&limit=50`);
    const pend = await res.json();
    if (!Array.isArray(pend)) return json({ error: "No se pudo leer la cola", detail: pend }, 500);
    const nowMs = Date.now();
    // deno-lint-ignore no-explicit-any
    const listos = pend.filter((m: any) => !m.programado_para || new Date(m.programado_para).getTime() <= nowMs);

    const results = [];
    for (const m of listos) results.push(await enviarUno(token, m));
    return json({ procesados: results.length, results }, 200);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
