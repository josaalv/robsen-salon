// wa-enviar — conector de envío. Toma los mensajes 'aprobado' de la cola
// (wa_mensajes), los envía por la Cloud API con sus variables y actualiza el
// estado a 'enviado' (o 'fallido'). Usa service role para leer/escribir la cola.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GRAPH = "https://graph.facebook.com/v21.0";
const PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || "1191037344100256";
const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), { status, headers: { "Content-Type": "application/json" } });
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

  const res = await fetch(`${GRAPH}/${PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: m.tel, type: "template", template }),
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
