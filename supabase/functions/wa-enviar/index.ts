// wa-enviar — conector de envío. Toma los mensajes 'aprobado' de la cola
// (wa_mensajes), los envía por la API de YCloud (Tech Provider con
// coexistence — ver docs/PENDIENTES.md) con sus variables, y actualiza el
// estado a 'enviado' (o 'fallido'). Usa service role para leer/escribir la cola.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const YCLOUD_BASE = "https://api.ycloud.com/v2";
// Número real del salón, conectado a YCloud con coexistence (app de
// WhatsApp Business + API en el mismo +52 1 33 1175 1393). No es secreto —
// es el número público del negocio — pero se permite sobreescribir por env
// var igual que el resto de las constantes de este tipo en el proyecto.
const FROM = Deno.env.get("YCLOUD_WHATSAPP_NUMBER") || "+523311751393";
const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), { status, headers: { "Content-Type": "application/json" } });
}

// Normaliza a E.164 CON el '+' que espera YCloud (Meta directo pedía solo
// dígitos; YCloud pide el formato con '+', ver sus ejemplos de la API).
// Los teléfonos se capturan a 10 dígitos (MX); se les antepone 52. Si ya
// traen lada (12–13 dígitos empezando en 52) se dejan como están.
function normTel(raw: string): string {
  const d = String(raw || "").replace(/\D/g, "");
  if (d.length === 10) return "+52" + d;
  if (d.length === 11 && d.startsWith("1")) return "+52" + d.slice(1); // 1+10 mal capturado
  return "+" + d; // ya trae lada o formato no-MX
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
async function enviarUno(apiKey: string, m: any) {
  const vars = m.variables || {};
  const keys = Object.keys(vars).sort((a, b) => Number(a) - Number(b));
  const params = keys.map((k) => ({ type: "text", text: String(vars[k]) }));
  // deno-lint-ignore no-explicit-any
  const template: any = { name: m.plantilla, language: { code: "es_MX" } };
  if (params.length) template.components = [{ type: "body", parameters: params }];

  const to = normTel(m.tel);
  if (to.length < 13) {
    const nowIso = new Date().toISOString();
    await rest(`wa_mensajes?id=eq.${m.id}`, {
      method: "PATCH", headers: { "Prefer": "return=minimal" },
      body: JSON.stringify({ estado: "fallido", error: `Teléfono inválido: ${m.tel}`, updated_at: nowIso }),
    });
    return { id: m.id, ok: false, error: `tel_invalido:${m.tel}` };
  }

  // sendDirectly: entrega sincrónica (espera la respuesta real de WhatsApp
  // antes de contestar) — así el resultado de este fetch ya dice si de
  // verdad se envió o no, igual que se asumía con la llamada directa a Meta.
  // El endpoint /messages (sin sendDirectly) encola de forma asíncrona y
  // deja el resultado solo para el webhook — no encaja con cómo este cron
  // ya reporta éxito/fallo por mensaje.
  const res = await fetch(`${YCLOUD_BASE}/whatsapp/messages/sendDirectly`, {
    method: "POST",
    headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to, type: "template", template, externalId: m.id }),
  });
  const data = await res.json();
  const nowIso = new Date().toISOString();
  if (res.ok && !data?.error) {
    const wamid = data?.wamid ?? data?.whatsappMessage?.wamid ?? null;
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
    const apiKey = Deno.env.get("YCLOUD_API_KEY");
    if (!apiKey) return json({ error: "Falta el secreto YCLOUD_API_KEY." }, 500);

    // Mensajes aprobados y cuyo horario programado ya llegó (o sin programar).
    const res = await rest(`wa_mensajes?estado=eq.aprobado&select=*&limit=50`);
    const pend = await res.json();
    if (!Array.isArray(pend)) return json({ error: "No se pudo leer la cola", detail: pend }, 500);
    const nowMs = Date.now();
    // deno-lint-ignore no-explicit-any
    let listos = pend.filter((m: any) => !m.programado_para || new Date(m.programado_para).getTime() <= nowMs);

    // Modo prueba: mientras esté activo, este es el único filtro que
    // realmente importa — sin importar cómo haya llegado un mensaje a la
    // cola (cron, botón "Generar cola", inserción manual), solo se entrega
    // si el teléfono coincide con wa_test_tel. Lo que no matchea se queda
    // en 'aprobado' sin tocarse (no se envía ni se marca como fallido).
    const cfgRes = await rest(`config?id=eq.main&select=wa_modo_prueba,wa_test_tel`);
    const cfgRows = await cfgRes.json();
    const cfg = Array.isArray(cfgRows) ? cfgRows[0] : null;
    let enEspera = 0;
    if (cfg?.wa_modo_prueba) {
      const test10 = normTel(String(cfg.wa_test_tel || "")).slice(-10);
      const antes = listos.length;
      // deno-lint-ignore no-explicit-any
      listos = listos.filter((m: any) => normTel(m.tel).slice(-10) === test10);
      enEspera = antes - listos.length;
    }

    const results = [];
    for (const m of listos) results.push(await enviarUno(apiKey, m));
    return json({ procesados: results.length, en_espera_modo_prueba: enEspera, results }, 200);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
