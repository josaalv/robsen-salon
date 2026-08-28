// mp-webhook — Mercado Pago avisa aquí cuando un pago cambia de estado.
// Nunca se confía en el cuerpo de la notificación por sí solo (cualquiera
// podría mandar un POST falso diciendo "aprobado"): siempre se le
// pregunta a la API real de Mercado Pago, con nuestro propio Access
// Token, cuál es el estado verdadero de ese payment_id antes de marcar
// nada como pagado.
//
// A diferencia de wa-webhook (que siempre regresa 200 para no generar
// reintentos de mensajes), aquí SÍ nos conviene que Mercado Pago reintente
// si algo de nuestro lado falla — es dinero real, es peor perder la
// confirmación que recibir el mismo aviso dos veces (el proceso es
// idempotente por payment_id).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MP_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");

const ESTADO_MAP: Record<string, string> = {
  approved: "aprobado",
  rejected: "rechazado",
  pending: "pendiente",
  in_process: "en_proceso",
  cancelled: "cancelado",
  refunded: "cancelado",
  charged_back: "cancelado",
};

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
  if (!MP_TOKEN) return new Response("falta MERCADOPAGO_ACCESS_TOKEN", { status: 500 });

  try {
    const url = new URL(req.url);
    // Mercado Pago manda el aviso de dos formas según la integración:
    // querystring clásico (?topic=payment&id=123) o body JSON
    // ({ type: "payment", data: { id: "123" } }) — se aceptan ambas.
    let paymentId = url.searchParams.get("id") || url.searchParams.get("data.id");
    let topic = url.searchParams.get("topic") || url.searchParams.get("type");

    if (req.method === "POST") {
      const body = await req.json().catch(() => null);
      if (body) {
        topic = topic || body.type || body.topic;
        paymentId = paymentId || body.data?.id || body.id;
      }
    }

    // Solo nos interesan eventos de pago — merchant_order y otros se
    // ignoran (200, para que Mercado Pago no siga reintentando algo que
    // nunca vamos a procesar).
    if (topic !== "payment" || !paymentId) {
      return new Response("ok (ignorado)", { status: 200 });
    }

    // Fuente de verdad real: la API de Mercado Pago, nunca el payload del
    // webhook. Esto es lo que hace imposible falsificar un "pago aprobado".
    const payRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { "Authorization": `Bearer ${MP_TOKEN}` },
    });
    if (!payRes.ok) {
      // 404 legítimo (id de prueba/otro ambiente) vs. error real de MP:
      // en cualquier caso, dejamos que Mercado Pago reintente si fue un
      // problema transitorio de su lado.
      return new Response("no se pudo verificar el pago con Mercado Pago", { status: 502 });
    }
    const pago = await payRes.json();
    const estado = ESTADO_MAP[pago.status] || "en_proceso";
    const referencia = String(pago.external_reference || "");

    // Upsert por payment_id: si ya existe el registro (normal — se creó
    // 'pendiente' en mp-crear-preferencia), lo actualiza; si no existe
    // (pago iniciado por otra vía, o el insert original falló), lo crea.
    const existente = await rest(`pagos_online?payment_id=eq.${encodeURIComponent(String(pago.id))}&select=id`);
    const filas = existente.ok ? await existente.json() : [];

    const payloadActualizado = {
      payment_id: String(pago.id),
      // pago.order.id es el id del merchant_order — un espacio de ids
      // distinto al de preference_id (que ya quedó fijado desde
      // mp-crear-preferencia). No se toca aquí para no pisarlo con el
      // valor equivocado; se guarda aparte en detalle por si sirve de
      // referencia.
      external_reference: referencia || undefined,
      monto: pago.transaction_amount,
      estado,
      raw_status: pago.status,
      detalle: { status_detail: pago.status_detail, payment_method_id: pago.payment_method_id, order_id: pago.order?.id },
      actualizado_en: new Date().toISOString(),
    }

    let writeRes: Response;
    if (filas.length > 0) {
      writeRes = await rest(`pagos_online?id=eq.${filas[0].id}`, {
        method: "PATCH", headers: { "Prefer": "return=minimal" },
        body: JSON.stringify(payloadActualizado),
      });
    } else {
      // Sin fila previa (no había preference_id que emparejar): intenta
      // encontrarla por external_reference antes de crear una nueva, para
      // no duplicar el registro 'pendiente' que ya dejó mp-crear-preferencia.
      const porReferencia = referencia
        ? await rest(`pagos_online?external_reference=eq.${encodeURIComponent(referencia)}&payment_id=is.null&select=id`)
        : null;
      const filasRef = porReferencia?.ok ? await porReferencia.json() : [];
      if (filasRef.length > 0) {
        writeRes = await rest(`pagos_online?id=eq.${filasRef[0].id}`, {
          method: "PATCH", headers: { "Prefer": "return=minimal" },
          body: JSON.stringify(payloadActualizado),
        });
      } else {
        writeRes = await rest("pagos_online", {
          method: "POST", headers: { "Prefer": "return=minimal" },
          body: JSON.stringify({ ...payloadActualizado, external_reference: referencia || "desconocida", monto: pago.transaction_amount ?? 0 }),
        });
      }
    }

    if (!writeRes.ok) {
      const errBody = await writeRes.text();
      console.error("mp-webhook: fallo al guardar", errBody);
      return new Response("fallo al guardar el estado del pago", { status: 500 });
    }

    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error("mp-webhook error:", e);
    return new Response("error interno", { status: 500 });
  }
});
