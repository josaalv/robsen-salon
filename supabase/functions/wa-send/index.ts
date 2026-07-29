// wa-send — conector de PRUEBA para WhatsApp Cloud API.
// Envía una plantilla (por defecto hello_world) a un número de prueba, leyendo
// el token del secreto WHATSAPP_TOKEN. Es un primer test de integración; el
// conector definitivo (cola, plantillas propias, estados) viene después.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GRAPH = "https://graph.facebook.com/v21.0";
const PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || "1252418747952067";

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  try {
    const token = Deno.env.get("WHATSAPP_TOKEN");
    if (!token) return json({ error: "Falta el secreto WHATSAPP_TOKEN en Supabase." }, 500);

    const body = await req.json().catch(() => ({}));
    const to = String(body.to || "").replace(/\D/g, "");
    if (!to) return json({ error: "Falta el número destino en el campo 'to'." }, 400);

    const template = body.template || "hello_world";
    const lang = body.lang || "en_US";

    const res = await fetch(`${GRAPH}/${PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: { name: template, language: { code: lang } },
      }),
    });
    const data = await res.json();
    return json({ ok: res.ok, status: res.status, data }, res.ok ? 200 : 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
