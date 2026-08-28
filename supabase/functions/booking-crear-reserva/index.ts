// booking-crear-reserva — agenda una cita del camino público que NO
// requiere anticipo (los que sí requieren anticipo se agendan en
// mp-webhook, solo cuando el pago se confirma — ver H-07 de la auditoría).
//
// Existe porque crear_reserva_publica dejó de ser llamable directo con la
// anon key (H-12: cualquiera podía automatizarla y llenar la agenda de
// citas/clientas falsas, gratis). Esta función es el único camino
// autorizado para ese caso: verifica reCAPTCHA v3 antes de agendar de
// verdad, del lado del servidor con la service role.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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

// Sin RECAPTCHA_SECRET_KEY configurada, no bloquea — deja pasar sin
// verificar. Es a propósito: mientras nadie configure la llave (requiere
// crear un sitio en el panel de Google reCAPTCHA), el agendamiento sigue
// funcionando igual que antes; la protección se activa sola en cuanto la
// llave se agrega, sin tocar código de nuevo.
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
    const cita = body.cita;
    const clienta = body.clienta;
    if (!cita || !clienta) return json({ error: "Faltan datos de la cita/clienta." }, 400);

    const basePath = String(body.basePath || "/").replace(/\/+$/, "") + "/";
    const schema = basePath.includes("preview") ? "preview" : "public";
    const secretoRecaptcha = schema === "preview" ? RECAPTCHA_SECRET_TEST : RECAPTCHA_SECRET;

    const humano = await verificarRecaptcha(body.recaptchaToken, "booking_publico", secretoRecaptcha);
    if (!humano) return json({ error: "No se pudo verificar la solicitud. Recarga la página e intenta de nuevo." }, 400);

    const rpcRes = await rest("rpc/crear_reserva_publica", schema, {
      method: "POST",
      body: JSON.stringify({ p_cita: cita, p_clienta: clienta }),
    });
    const data = await rpcRes.json().catch(() => null);
    if (!rpcRes.ok) {
      return json({ error: data?.message || "No se pudo agendar la cita." }, 400);
    }
    return json(data);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
