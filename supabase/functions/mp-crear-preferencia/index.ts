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
// Dos credenciales separadas, nunca una sola compartida: una cuenta de
// prueba de Mercado Pago y la cuenta real viven en espacios completamente
// distintos (sus payment_id no se cruzan). Preview SIEMPRE usa la de
// prueba — así nadie vuelve a cobrar dinero real sin querer probando en
// /preview/. Producción exige la real; si falta, la función se niega a
// cobrar en vez de caer de vuelta a la de prueba en silencio.
const MP_TOKEN_PROD = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
const MP_TOKEN_TEST = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN_TEST");
const RECAPTCHA_SECRET = Deno.env.get("RECAPTCHA_SECRET_KEY");
// Llave de prueba oficial de Google (documentada en su FAQ de reCAPTCHA,
// pública a propósito — no es secreta) — siempre da puntuación 0.9. Sin
// esto, las pruebas E2E de CI (H-13) chocarían para siempre con la
// protección real: reCAPTCHA detecta correctamente a Playwright como bot y
// le pone puntuación baja, que es justo para lo que sirve. Solo se usa
// cuando la preferencia viene de /preview/ — producción siempre usa la
// llave real.
const RECAPTCHA_SECRET_TEST = Deno.env.get("RECAPTCHA_TEST_SECRET_KEY") || "6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe";

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
      "Content-Type": "application/json",
      "Accept-Profile": schema, "Content-Profile": schema,
      ...(init.headers || {}),
    },
  });
}

// Sin RECAPTCHA_SECRET_KEY configurada, no bloquea (se activa sola en
// cuanto se agregue la llave). Solo se exige para preferencias que vienen
// de Booking (traen cita) — el "cobro virtual" interno no pasa por aquí.
async function verificarRecaptcha(token: unknown, accion: string, secret: string | undefined): Promise<boolean> {
  if (!secret) return true;
  if (typeof token !== "string" || !token) return false;
  try {
    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
    });
    const data = await res.json();
    return data.success === true
      && (data.score === undefined || data.score >= 0.5)
      && (!data.action || data.action === accion);
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return json({});

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
    const mpToken = entorno === "preview" ? MP_TOKEN_TEST : MP_TOKEN_PROD;
    if (!mpToken) {
      const faltante = entorno === "preview" ? "MERCADOPAGO_ACCESS_TOKEN_TEST" : "MERCADOPAGO_ACCESS_TOKEN";
      return json({ error: `Falta el secreto ${faltante} en Supabase.` }, 500);
    }
    // metadataExtra (ej. los datos de la cita/clienta de Booking) viaja con
    // la preferencia y Mercado Pago lo regresa intacto en el webhook — así
    // el webhook puede agendar la cita del lado del servidor cuando el pago
    // se apruebe de verdad, sin depender de que el navegador siga abierto.
    const metadataExtra = body.metadataExtra && typeof body.metadataExtra === "object" ? body.metadataExtra : {};

    if (!referencia) return json({ error: "Falta 'referencia' (id de la cita/apartado)." }, 400);
    if (!Number.isFinite(monto) || monto <= 0) return json({ error: "'monto' debe ser un número mayor a cero." }, 400);

    // Cuando esta preferencia viene de Booking (metadataExtra.cita), el
    // monto/total NUNCA se toman en confianza del navegador — se recalculan
    // aquí contra el precio real del servicio. Sin esto, cualquiera podría
    // llamar esta función directo (la anon key es pública por diseño) con un
    // 'monto' de un peso mientras el metadata dice que la cita vale $5,000,
    // y terminar con una reserva real agendada como si el anticipo correcto
    // se hubiera cobrado. No aplica al futuro "cobro virtual" interno, que
    // no trae una cita asociada.
    const citaMeta = metadataExtra.cita as Record<string, unknown> | undefined;
    if (citaMeta?.servicio_id) {
      const servRes = await rest(`servicios?id=eq.${encodeURIComponent(String(citaMeta.servicio_id))}&select=precio,anticipo,online,activo`, schema);
      const servRows = servRes.ok ? await servRes.json() : [];
      const serv = servRows[0];
      if (!serv || serv.activo === false || serv.online === false) {
        return json({ error: "Ese servicio ya no está disponible para agendar en línea." }, 400);
      }
      if (!serv.anticipo) {
        return json({ error: "Ese servicio no requiere anticipo." }, 400);
      }
      const cfgRes = await rest(`config?id=eq.main&select=anticipo_pct`, schema);
      const cfgRows = cfgRes.ok ? await cfgRes.json() : [];
      const anticipoPct = Number(cfgRows[0]?.anticipo_pct ?? 35);
      const precioReal = Number(serv.precio);
      const anticipoEsperado = Math.round(precioReal * anticipoPct / 100);
      if (Math.abs(anticipoEsperado - monto) > 1) {
        return json({ error: "El monto del anticipo no coincide con el precio real del servicio." }, 400);
      }
      if (citaMeta.total !== undefined && Math.abs(Number(citaMeta.total) - precioReal) > 1) {
        return json({ error: "El total de la cita no coincide con el precio real del servicio." }, 400);
      }
      const secretoRecaptcha = entorno === "preview" ? RECAPTCHA_SECRET_TEST : RECAPTCHA_SECRET;
      const humano = await verificarRecaptcha(body.recaptchaToken, "booking_pago", secretoRecaptcha);
      if (!humano) return json({ error: "No se pudo verificar la solicitud. Recarga la página e intenta de nuevo." }, 400);
    }

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
      // El entorno viaja también en la querystring del propio webhook (no
      // solo en metadata): mp-webhook necesita saber CON QUÉ credencial
      // verificar el pago con la API de Mercado Pago, y eso hay que
      // decidirlo antes de poder leer metadata — la cuenta de prueba y la
      // real son espacios separados, cada una solo ve sus propios pagos.
      notification_url: `${SUPA_URL}/functions/v1/mp-webhook?entorno=${entorno}`,
    };

    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { "Authorization": `Bearer ${mpToken}`, "Content-Type": "application/json" },
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
