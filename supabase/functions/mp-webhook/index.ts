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
    // El entorno viene del metadata que mp-crear-preferencia fijó al crear
    // la preferencia — se lee de la respuesta de Mercado Pago (fuente de
    // verdad), nunca de algo que mande el propio webhook, así que no se
    // puede falsificar. Sin esto, un pago de prueba en preview terminaría
    // actualizando (o creando) una fila en la tabla real de producción.
    const schema = pago.metadata?.entorno === "preview" ? "preview" : "public";

    // Upsert por payment_id: si ya existe el registro (normal — se creó
    // 'pendiente' en mp-crear-preferencia), lo actualiza; si no existe
    // (pago iniciado por otra vía, o el insert original falló), lo crea.
    const existente = await rest(`pagos_online?payment_id=eq.${encodeURIComponent(String(pago.id))}&select=id,estado`, schema);
    const filas = existente.ok ? await existente.json() : [];
    // Idempotencia: Mercado Pago puede reenviar el mismo aviso varias veces
    // (o nosotros mismos devolver 500 y provocar un reintento). Si esta fila
    // YA estaba 'aprobado' antes de este aviso, la cita ya se agendó — no
    // hay que volver a intentarlo (fallaría con un id duplicado).
    let estadoPrevio: string | null = filas[0]?.estado ?? null;

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
      writeRes = await rest(`pagos_online?id=eq.${filas[0].id}`, schema, {
        method: "PATCH", headers: { "Prefer": "return=minimal" },
        body: JSON.stringify(payloadActualizado),
      });
    } else {
      // Sin fila previa (no había preference_id que emparejar): intenta
      // encontrarla por external_reference antes de crear una nueva, para
      // no duplicar el registro 'pendiente' que ya dejó mp-crear-preferencia.
      const porReferencia = referencia
        ? await rest(`pagos_online?external_reference=eq.${encodeURIComponent(referencia)}&payment_id=is.null&select=id,estado`, schema)
        : null;
      const filasRef = porReferencia?.ok ? await porReferencia.json() : [];
      estadoPrevio = filasRef[0]?.estado ?? null;
      if (filasRef.length > 0) {
        writeRes = await rest(`pagos_online?id=eq.${filasRef[0].id}`, schema, {
          method: "PATCH", headers: { "Prefer": "return=minimal" },
          body: JSON.stringify(payloadActualizado),
        });
      } else {
        writeRes = await rest("pagos_online", schema, {
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

    // La cita de Booking solo se agenda AQUÍ, al confirmar el pago de
    // verdad — nunca antes. metadata.cita/clienta viajan desde
    // mp-crear-preferencia; si no están (ej. un futuro "cobro virtual" sin
    // cita asociada), no hay nada que agendar. estadoPrevio evita repetir
    // esto si Mercado Pago reenvía el mismo aviso de aprobado dos veces.
    if (estado === "aprobado" && estadoPrevio !== "aprobado" && pago.metadata?.cita && pago.metadata?.clienta) {
      const rpcRes = await rest("rpc/crear_reserva_publica", schema, {
        method: "POST",
        body: JSON.stringify({ p_cita: pago.metadata.cita, p_clienta: pago.metadata.clienta }),
      });
      if (!rpcRes.ok) {
        // El pago SÍ quedó registrado como aprobado arriba — eso no se
        // deshace. Si agendar falla (ej. alguien más tomó ese horario
        // mientras se pagaba), se deja constancia en detalle para que el
        // equipo lo agende a mano y contacte a la clienta; no tiene caso
        // que Mercado Pago siga reintentando el mismo webhook por esto.
        const errBody = await rpcRes.text();
        console.error("mp-webhook: pago aprobado pero no se pudo agendar", errBody);
        await rest(`pagos_online?payment_id=eq.${encodeURIComponent(String(pago.id))}`, schema, {
          method: "PATCH", headers: { "Prefer": "return=minimal" },
          body: JSON.stringify({ detalle: { ...payloadActualizado.detalle, reserva_error: errBody } }),
        });
      }
    }

    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error("mp-webhook error:", e);
    return new Response("error interno", { status: 500 });
  }
});
