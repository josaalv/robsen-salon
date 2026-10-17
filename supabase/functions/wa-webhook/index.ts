// wa-webhook — recibe de YCloud los estados de entrega (✓✓ / leído), las
// respuestas de las clientas, y (gracias a coexistence) también los mensajes
// que el personal manda a mano desde la app de WhatsApp Business en el
// celular. Público (YCloud no manda JWT): se verifica con la firma
// YCloud-Signature, no con un token en la URL como hacía Meta directo.
// Escribe con service role.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const YCLOUD_API_KEY = Deno.env.get("YCLOUD_API_KEY");
// Se guarda al registrar el endpoint con la acción 'register-webhook' de
// wa-templates (POST /v2/webhookEndpoints) — YCloud la regresa una sola vez,
// hay que capturarla ahí y guardarla aquí como secreto aparte.
const WEBHOOK_SECRET = Deno.env.get("YCLOUD_WEBHOOK_SECRET");

const MEDIA_TIPOS = ["image", "audio", "video", "document", "sticker"];

const STATUS_MAP: Record<string, string> = {
  sent: "enviado", delivered: "entregado", read: "leido", failed: "fallido",
};

// Verifica la firma YCloud-Signature: "t=<unix>,s=<hex>" sobre
// "<t>.<cuerpo crudo>" con HMAC-SHA256 y el secreto del webhook. Nunca se
// procesa un evento sin esta verificación — es un endpoint público, sin JWT,
// y escribe en la base con service role.
async function verificarFirma(rawBody: string, header: string | null): Promise<boolean> {
  if (!WEBHOOK_SECRET || !header) return false;
  const partes = Object.fromEntries(header.split(",").map(p => p.trim().split("=", 2))) as { t?: string; s?: string };
  if (!partes.t || !partes.s || !/^\d+$/.test(partes.t)) return false;
  // Tolerancia de 5 min contra reproducción de un payload viejo.
  if (Math.abs(Date.now() / 1000 - Number(partes.t)) > 300) return false;

  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const firma = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${partes.t}.${rawBody}`));
  const firmaHex = Array.from(new Uint8Array(firma)).map(b => b.toString(16).padStart(2, "0")).join("");

  if (firmaHex.length !== partes.s.length) return false;
  let diff = 0;
  for (let i = 0; i < firmaHex.length; i++) diff |= firmaHex.charCodeAt(i) ^ partes.s.charCodeAt(i);
  return diff === 0;
}

// Extrae un texto legible de cualquier tipo de mensaje entrante — antes solo
// se leía msg.text/msg.button/interactive.button_reply y todo lo demás
// (reacciones, medios, ubicación, mensajes no soportados) caía en cuerpo
// vacío. Cada rama deja algo legible en su lugar.
// deno-lint-ignore no-explicit-any
function extraerTexto(msg: any, btn: any): string {
  if (msg.text?.body) return msg.text.body;
  if (msg.button?.text) return msg.button.text;
  if (btn?.title) return btn.title;
  const listReply = msg.interactive?.list_reply;
  if (listReply?.title) return listReply.title;
  if (msg.reaction) return `[Reacción${msg.reaction.emoji ? ': ' + msg.reaction.emoji : ''}]`;
  const MEDIA_LABEL: Record<string, string> = {
    image: 'Imagen', video: 'Video', audio: 'Audio', document: 'Documento', sticker: 'Sticker',
  };
  for (const [tipo, etiqueta] of Object.entries(MEDIA_LABEL)) {
    // deno-lint-ignore no-explicit-any
    const media = (msg as any)[tipo];
    if (media) return media.caption ? `[${etiqueta}] ${media.caption}` : `[${etiqueta}]`;
  }
  if (msg.location) return '[Ubicación compartida]';
  if (msg.contacts) return '[Contacto compartido]';
  if (msg.type === 'unsupported' || msg.errors) return '[Mensaje no compatible con esta bandeja]';
  return '[Mensaje sin texto]';
}

// YCloud ya manda un link firmado y descargable directo en el payload del
// mensaje entrante (msg.image.link, etc.) — a diferencia de Meta, que solo
// mandaba un media_id y había que resolverlo a URL en un paso aparte. Solo
// hace falta bajar los bytes (con la misma API key) y subirlos a wa-media.
async function descargarYSubirMedia(link: string, mimeType: string, mediaId: string, tel: string): Promise<string | null> {
  if (!YCLOUD_API_KEY) return null;
  try {
    const fileRes = await fetch(link, { headers: { "X-API-Key": YCLOUD_API_KEY } });
    if (!fileRes.ok) return null;
    const bytes = await fileRes.arrayBuffer();
    const ext = (mimeType.split("/")[1] || "bin").split(";")[0];
    const path = `${tel}/${Date.now()}-${mediaId}.${ext}`;
    const upRes = await fetch(`${SUPA_URL}/storage/v1/object/wa-media/${path}`, {
      method: "POST",
      headers: { "apikey": SERVICE, "Authorization": `Bearer ${SERVICE}`, "Content-Type": mimeType || "application/octet-stream" },
      body: bytes,
    });
    return upRes.ok ? path : null;
  } catch {
    return null;
  }
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
  // YCloud no usa el handshake GET de Meta (hub.mode/verify_token) — el
  // endpoint se registra directo contra su API (ver acción 'register-webhook'
  // en wa-templates), así que aquí solo hace falta manejar POST.
  if (req.method !== "POST") return new Response("ok", { status: 200 });

  const rawBody = await req.text();
  const firmaOk = await verificarFirma(rawBody, req.headers.get("YCloud-Signature"));
  if (!firmaOk) return new Response("forbidden", { status: 403 });

  try {
    const body = JSON.parse(rawBody);
    const tipo = String(body.type || "");

    // 1) Estados de entrega de nuestros envíos.
    if (tipo === "whatsapp.message.updated") {
      const wm = body.whatsappMessage ?? {};
      const estado = STATUS_MAP[String(wm.status || "")];
      const wamid = wm.wamid;
      if (estado && wamid) {
        await rest(`wa_mensajes?wa_message_id=eq.${encodeURIComponent(wamid)}`, {
          method: "PATCH", headers: { "Prefer": "return=minimal" },
          body: JSON.stringify({ estado, updated_at: new Date().toISOString() }),
        });
      }
      return new Response("ok", { status: 200 });
    }

    // 2) Mensajes que el personal manda A MANO desde la app de WhatsApp
    // Business del celular — esto solo existe gracias a coexistence. Antes
    // esos mensajes eran invisibles para el CRM; ahora se reflejan en la
    // bandeja de Conversaciones igual que los automáticos.
    if (tipo === "whatsapp.smb.message.echoes") {
      const wm = body.whatsappMessage ?? {};
      const texto = wm.text?.body ?? '[Mensaje sin texto]';
      await rest(`wa_mensajes`, {
        method: "POST", headers: { "Prefer": "return=minimal" },
        body: JSON.stringify({
          tel: String(wm.to ?? ''), flujo: "saliente_app", cuerpo: texto, estado: "enviado",
          wa_message_id: wm.wamid ?? null, enviado_at: wm.sendTime ?? new Date().toISOString(),
          requiere_aprobacion: false, creado_por: "staff_app",
        }),
      });
      return new Response("ok", { status: 200 });
    }

    // 3) Respuestas entrantes de las clientas.
    if (tipo === "whatsapp.inbound_message.received") {
      const msg = body.whatsappInboundMessage ?? {};
      const from = String(msg.from ?? "");
      if (!from) return new Response("ok", { status: 200 });

      // Clic en botón de confirmar/cancelar cita (mensaje interactivo de
      // prueba, id fijo del tipo "confirmar_<citaId>" / "cancelar_<citaId>").
      // Se resuelve por id, no por texto — evita que "Cancelar cita" se
      // confunda con CANCELAR de baja de WhatsApp (son cosas distintas).
      const btn = msg.interactive?.button_reply;
      const btnMatch = btn?.id ? /^(confirmar|cancelar)_(.+)$/.exec(String(btn.id)) : null;
      if (btnMatch) {
        const [, accion, citaId] = btnMatch;
        await rest(`citas?id=eq.${encodeURIComponent(citaId)}`, {
          method: "PATCH", headers: { "Prefer": "return=minimal" },
          body: JSON.stringify({ estado: accion === "confirmar" ? "conf" : "canc" }),
        });
      }

      // Clic en botón de una PLANTILLA aprobada (recordatorio_24h real). El
      // payload ahí es fijo — el mismo texto para cualquiera que la reciba —
      // así que se resuelve la cita por teléfono + recordatorio_24h más
      // reciente (RPC wa_resolver_boton_plantilla), no por un id embebido.
      const btnPlantilla = msg.button?.text as string | undefined;
      const resueltoPorPlantilla = btnPlantilla === "Confirmar" || btnPlantilla === "Cancelar";
      if (resueltoPorPlantilla) {
        const accion = btnPlantilla === "Confirmar" ? "confirmar" : "cancelar";
        await rest(`rpc/wa_resolver_boton_plantilla`, {
          method: "POST",
          body: JSON.stringify({ p_from: from, p_accion: accion }),
        });
      }

      const texto = extraerTexto(msg, btn);
      // Interpreta CONFIRMO / BAJA en texto libre (flujo original). Se omite
      // si ya se resolvió por botón arriba, para que "Cancelar" no dispare
      // además la baja de WhatsApp (misma palabra, otro significado).
      if (!btnMatch && !resueltoPorPlantilla) {
        await rest(`rpc/wa_inbound`, {
          method: "POST",
          body: JSON.stringify({ p_from: from, p_texto: texto }),
        });
      }

      // Si el mensaje trae un archivo, se descarga (YCloud ya da un link
      // firmado directo) y se sube a wa-media.
      const tipoMedia = MEDIA_TIPOS.find(t => msg[t]);
      let mediaPath: string | null = null;
      if (tipoMedia) {
        const m = msg[tipoMedia];
        if (m?.link) mediaPath = await descargarYSubirMedia(m.link, m.mime_type || "application/octet-stream", m.id, from);
      }

      await rest(`wa_mensajes`, {
        method: "POST", headers: { "Prefer": "return=minimal" },
        body: JSON.stringify({
          tel: from, flujo: "entrante", cuerpo: texto, estado: "respondido",
          media_path: mediaPath, media_tipo: tipoMedia ?? null,
          requiere_aprobacion: false, creado_por: "clienta",
        }),
      });
      return new Response("ok", { status: 200 });
    }

    // Cualquier otro tipo de evento (revisión de plantilla, actualización de
    // WABA, etc.) se reconoce con 200 sin acción — evita que YCloud reintente
    // por un tipo que no manejamos todavía.
    return new Response("ok", { status: 200 });
  } catch (_e) {
    // Siempre 200 para que YCloud no reintente en bucle por un payload raro.
    return new Response("ok", { status: 200 });
  }
});
