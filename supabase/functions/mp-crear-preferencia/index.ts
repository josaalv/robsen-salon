// mp-crear-preferencia — crea un cobro (Checkout Pro) en Mercado Pago para
// un anticipo de cita y regresa la URL de pago. Nunca tocamos datos de
// tarjeta: Mercado Pago aloja la página de pago completa.
//
// El Access Token (MERCADOPAGO_ACCESS_TOKEN) vive solo aquí, del lado del
// servidor — jamás debe llegar al navegador (a diferencia de las llaves
// VITE_*, que sí se empaquetan en el bundle público).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MP_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      // Booking eventualmente se sirve sin sesión (pantalla pública) — la
      // llamada desde el navegador necesita CORS abierto para ese caso.
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    },
  });
}

async function rest(path: string, schema: string, init: RequestInit = {}) {
  return fetch(`${SUPA_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      "apikey": SERVICE, "Authorization": `Bearer ${SERVICE}`,
      "Content-Type": "application/json", "Content-Profile": schema, ...(init.headers || {}),
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return json({});
  if (!MP_TOKEN) return json({ error: "Falta el secreto MERCADOPAGO_ACCESS_TOKEN en Supabase." }, 500);

  try {
    const body = await req.json().catch(() => ({}));
    const monto = Number(body.monto);
    const referencia = String(body.referencia || "").trim();
    const descripcion = String(body.descripcion || "Anticipo de cita — Robsen Salón & Spa").slice(0, 255);
    // basePath viene del cliente ('/' en producción, '/preview/' en preview)
    // — determina a qué schema escribir el registro pendiente y a dónde debe
    // regresar Mercado Pago después de pagar. Sin esto, cualquier prueba en
    // preview escribiría en la tabla de pagos_online real de producción y
    // regresaría al dominio raíz en vez de /preview/.
    const basePath = String(body.basePath || "/").replace(/\/+$/, "") + "/";
    const entorno = basePath.includes("preview") ? "preview" : "produccion";
    const schema = entorno === "preview" ? "preview" : "public";
    // metadataExtra (ej. los datos de la cita/clienta de Booking) viaja con
    // la preferencia y Mercado Pago lo regresa intacto en el webhook — así
    // el webhook puede agendar la cita del lado del servidor cuando el pago
    // se apruebe de verdad, sin depender de que el navegador siga abierto.
    const metadataExtra = body.metadataExtra && typeof body.metadataExtra === "object" ? body.metadataExtra : {};

    if (!referencia) return json({ error: "Falta 'referencia' (id de la cita/apartado)." }, 400);
    if (!Number.isFinite(monto) || monto <= 0) return json({ error: "'monto' debe ser un número mayor a cero." }, 400);

    const preference = {
      items: [{ title: descripcion, quantity: 1, unit_price: monto, currency_id: "MXN" }],
      external_reference: referencia,
      metadata: { entorno, ...metadataExtra },
      back_urls: {
        success: `https://robseninterno.com${basePath}booking?pago=exitoso`,
        failure: `https://robseninterno.com${basePath}booking?pago=fallido`,
        pending: `https://robseninterno.com${basePath}booking?pago=pendiente`,
      },
      auto_return: "approved",
      notification_url: `${SUPA_URL}/functions/v1/mp-webhook`,
    };

    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { "Authorization": `Bearer ${MP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(preference),
    });
    const mpData = await mpRes.json();
    if (!mpRes.ok) {
      return json({ error: "Mercado Pago rechazó la solicitud.", detalle: mpData }, 502);
    }

    // Deja un registro 'pendiente' desde ya — mp-webhook lo actualiza cuando
    // llegue el resultado real del pago (aprobado/rechazado/etc.).
    const insertRes = await rest("pagos_online", schema, {
      method: "POST",
      headers: { "Prefer": "return=representation" },
      body: JSON.stringify({
        preference_id: mpData.id,
        external_reference: referencia,
        monto,
        estado: "pendiente",
        detalle: { descripcion },
      }),
    });
    if (!insertRes.ok) {
      const errBody = await insertRes.text();
      return json({ error: "No se pudo registrar el pago pendiente.", detalle: errBody }, 500);
    }

    // sandbox_init_point solo viene presente cuando se usan credenciales de
    // prueba (TEST-... o el Access Token de un usuario de prueba) — con
    // credenciales de producción, init_point es el único disponible.
    const checkoutUrl = mpData.sandbox_init_point || mpData.init_point;
    return json({ preference_id: mpData.id, checkout_url: checkoutUrl });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
