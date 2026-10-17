// wa-send — conector de PRUEBA para mandar una plantilla suelta vía YCloud,
// sin pasar por la cola (wa_mensajes). Útil para probar que la conexión
// YCloud ↔ número real funciona antes de confiar en el flujo automático.
// El botón de confirmar/cancelar "de prueba" (mensaje interactivo suelto,
// fuera de una plantilla aprobada) se quitó de aquí: el flujo real ya usa
// los botones de la propia plantilla recordatorio_24h (ver wa-templates),
// que es lo único que de verdad importa en producción.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const YCLOUD_BASE = "https://api.ycloud.com/v2";
const FROM = Deno.env.get("YCLOUD_WHATSAPP_NUMBER") || "+523311751393";

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Misma normalización que wa-enviar/wa-responder — un número de 10 dígitos
// capturado a la mexicana necesita el 52 antepuesto para quedar en E.164;
// sin esto el mensaje sale con un "+" pegado a 10 dígitos sueltos (número
// inválido, sin lada de ningún país).
function normTel(raw: string): string {
  const d = String(raw || "").replace(/\D/g, "");
  if (d.length === 10) return "+52" + d;
  if (d.length === 11 && d.startsWith("1")) return "+52" + d.slice(1);
  return "+" + d;
}

Deno.serve(async (req: Request) => {
  try {
    const apiKey = Deno.env.get("YCLOUD_API_KEY");
    if (!apiKey) return json({ error: "Falta el secreto YCLOUD_API_KEY en Supabase." }, 500);

    const body = await req.json().catch(() => ({}));
    const to = normTel(String(body.to || ""));
    if (to.length < 13) return json({ error: "Falta o es inválido el número destino en el campo 'to'." }, 400);

    // vars: ["Ana", "Corte", ...] — parámetros posicionales {{1}}, {{2}}…
    // del body de la plantilla.
    const payload = {
      from: FROM,
      to,
      type: "template",
      template: {
        name: body.template || "confirmacion_cita",
        language: { code: body.lang || "es_MX" },
        ...(Array.isArray(body.vars) && body.vars.length
          ? { components: [{ type: "body", parameters: body.vars.map((v: unknown) => ({ type: "text", text: String(v) })) }] }
          : {}),
      },
    };

    const res = await fetch(`${YCLOUD_BASE}/whatsapp/messages/sendDirectly`, {
      method: "POST",
      headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return json({ ok: res.ok && !data?.error, status: res.status, data }, res.ok ? 200 : 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
