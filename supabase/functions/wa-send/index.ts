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

    // interactive: { body: string, buttons: [{id, title}] } — mensaje con
    // botones de respuesta rápida. Solo funciona dentro de la ventana de
    // 24h de servicio al cliente (la clienta escribió recientemente); para
    // mensajes iniciados por el negocio fuera de esa ventana, Meta exige
    // una plantilla aprobada.
    // deno-lint-ignore no-explicit-any
    const payload: any = body.interactive
      ? {
          messaging_product: "whatsapp",
          to,
          type: "interactive",
          interactive: {
            type: "button",
            body: { text: String(body.interactive.body || "") },
            // deno-lint-ignore no-explicit-any
            action: { buttons: (body.interactive.buttons || []).map((b: any) => ({
              type: "reply", reply: { id: String(b.id), title: String(b.title).slice(0, 20) },
            })) },
          },
        }
      : {
          messaging_product: "whatsapp",
          to,
          type: "template",
          // vars: ["Ana", "Corte", ...] — parámetros posicionales {{1}}, {{2}}…
          // del body de la plantilla. Sin esto solo se pueden mandar
          // plantillas sin variables (como hello_world).
          template: {
            name: body.template || "hello_world",
            language: { code: body.lang || "en_US" },
            ...(Array.isArray(body.vars) && body.vars.length
              ? { components: [{ type: "body", parameters: body.vars.map((v: unknown) => ({ type: "text", text: String(v) })) }] }
              : {}),
          },
        };

    const res = await fetch(`${GRAPH}/${PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return json({ ok: res.ok, status: res.status, data }, res.ok ? 200 : 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
