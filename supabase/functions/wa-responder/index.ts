// wa-responder — manda texto libre a una clienta desde la bandeja de
// conversaciones del CRM. Solo funciona dentro de la ventana de 24h de
// servicio al cliente (Meta exige plantilla aprobada fuera de esa ventana);
// se valida antes de llamar a Meta para dar un error claro en vez del
// código crudo de la API.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GRAPH = "https://graph.facebook.com/v21.0";
const PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || "1252418747952067";
const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VENTANA_MS = 24 * 60 * 60 * 1000;

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), { status, headers: { "Content-Type": "application/json" } });
}

function normTel(raw: string): string {
  const d = String(raw || "").replace(/\D/g, "");
  if (d.length === 10) return "52" + d;
  if (d.length === 11 && d.startsWith("1")) return "52" + d.slice(1);
  return d;
}

async function rest(path: string, init: RequestInit = {}) {
  return fetch(`${SUPA_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      "apikey": SERVICE, "Authorization": `Bearer ${SERVICE}`,
      "Content-Type": "application/json", ...(init.headers || {}),
    },
  });
}

Deno.serve(async (req: Request) => {
  try {
    const token = Deno.env.get("WHATSAPP_TOKEN");
    if (!token) return json({ error: "Falta el secreto WHATSAPP_TOKEN." }, 500);

    const body = await req.json().catch(() => ({}));
    const telRaw = String(body.tel || "");
    const texto = String(body.texto || "").trim();
    if (!telRaw || !texto) return json({ error: "Faltan 'tel' y/o 'texto'." }, 400);

    const last10 = telRaw.replace(/\D/g, "").slice(-10);
    // Último mensaje entrante de esa clienta — determina si la ventana de
    // 24h de servicio al cliente sigue abierta (Meta la exige para texto
    // libre; fuera de ella solo se puede mandar una plantilla aprobada).
    const q = `wa_mensajes?flujo=eq.entrante&select=tel,created_at&order=created_at.desc&limit=200`;
    const resEntrantes = await rest(q);
    const entrantes = await resEntrantes.json();
    const ultimo = Array.isArray(entrantes)
      ? entrantes.find((m: { tel: string }) => String(m.tel || "").replace(/\D/g, "").slice(-10) === last10)
      : null;
    if (!ultimo) {
      return json({ error: "Esta clienta no tiene mensajes entrantes registrados — no se puede abrir la ventana de 24h sin que ella haya escrito primero." }, 409);
    }
    const desdeUltimo = Date.now() - new Date(ultimo.created_at).getTime();
    if (desdeUltimo > VENTANA_MS) {
      return json({ error: "La ventana de 24h desde su último mensaje ya cerró. Para contactarla de nuevo hay que usar una plantilla aprobada, no texto libre." }, 409);
    }

    const to = normTel(telRaw);
    const res = await fetch(`${GRAPH}/${PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: texto } }),
    });
    const data = await res.json();
    const nowIso = new Date().toISOString();

    if (res.ok) {
      const wamid = data?.messages?.[0]?.id ?? null;
      await rest(`wa_mensajes`, {
        method: "POST", headers: { "Prefer": "return=minimal" },
        body: JSON.stringify({
          tel: to, flujo: "saliente_libre", cuerpo: texto, estado: "enviado",
          wa_message_id: wamid, enviado_at: nowIso, requiere_aprobacion: false, creado_por: "staff",
        }),
      });
      return json({ ok: true, wamid }, 200);
    } else {
      const err = JSON.stringify(data?.error ?? data).slice(0, 500);
      await rest(`wa_mensajes`, {
        method: "POST", headers: { "Prefer": "return=minimal" },
        body: JSON.stringify({
          tel: to, flujo: "saliente_libre", cuerpo: texto, estado: "fallido",
          error: err, requiere_aprobacion: false, creado_por: "staff",
        }),
      });
      return json({ ok: false, error: err }, 400);
    }
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
