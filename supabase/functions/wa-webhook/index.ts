// wa-webhook — recibe de Meta los estados de entrega (✓✓ / leído) y las
// respuestas de las clientas (CONFIRMO / BAJA). Público (Meta no manda JWT):
// la verificación GET usa WHATSAPP_VERIFY_TOKEN. Escribe con service role.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN") || "robsen-verify-2026";
const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN");

const MEDIA_TIPOS = ["image", "audio", "video", "document", "sticker"];

const STATUS_MAP: Record<string, string> = {
  sent: "enviado", delivered: "entregado", read: "leido", failed: "fallido",
};

// Extrae un texto legible de cualquier tipo de mensaje entrante que manda
// Meta — antes solo se leía msg.text/msg.button/interactive.button_reply y
// todo lo demás (reacciones, medios, ubicación, listas, mensajes no
// soportados) caía en cuerpo vacío: se guardaba en wa_mensajes igual pero
// sin nada que mostrar, apareciendo como una burbuja en blanco en la bandeja
// de Conversaciones. Cada rama deja algo legible en su lugar.
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

// Descarga un archivo entrante (foto, audio, documento, sticker) de los
// servidores de Meta y lo sube al bucket privado wa-media. Meta solo manda
// un media_id en el webhook — hay que resolverlo a una URL temporal (con el
// mismo token de la app) y bajar los bytes ahí mismo, en el servidor, porque
// esa URL exige el token de WhatsApp para descargar (no se le puede pasar
// directo al navegador del staff). Si algo falla se regresa null — nunca
// bloquea el registro del mensaje en la bitácora.
async function descargarYSubirMedia(mediaId: string, mimeType: string, tel: string): Promise<string | null> {
  if (!WHATSAPP_TOKEN) return null;
  try {
    const metaRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: { "Authorization": `Bearer ${WHATSAPP_TOKEN}` },
    });
    if (!metaRes.ok) return null;
    const metaData = await metaRes.json();
    if (!metaData?.url) return null;
    const fileRes = await fetch(metaData.url, { headers: { "Authorization": `Bearer ${WHATSAPP_TOKEN}` } });
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
  const url = new URL(req.url);

  // 1) Verificación del webhook (Meta manda un GET al configurarlo).
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      return new Response(challenge ?? "", { status: 200 });
    }
    return new Response("forbidden", { status: 403 });
  }

  // 2) Eventos (POST).
  try {
    const body = await req.json();
    // deno-lint-ignore no-explicit-any
    for (const entry of (body.entry ?? []) as any[]) {
      for (const change of (entry.changes ?? [])) {
        const value = change.value ?? {};

        // 2a) Estados de entrega de nuestros envíos.
        for (const st of (value.statuses ?? [])) {
          const estado = STATUS_MAP[st.status];
          if (!estado || !st.id) continue;
          await rest(`wa_mensajes?wa_message_id=eq.${encodeURIComponent(st.id)}`, {
            method: "PATCH", headers: { "Prefer": "return=minimal" },
            body: JSON.stringify({ estado, updated_at: new Date().toISOString() }),
          });
        }

        // 2b) Respuestas entrantes de las clientas.
        for (const msg of (value.messages ?? [])) {
          const from = String(msg.from ?? "");
          if (!from) continue;

          // Clic en botón de confirmar/cancelar cita (mensaje interactivo de
          // prueba, id fijo del tipo "confirmar_<citaId>" / "cancelar_<citaId>",
          // solo funciona dentro de la ventana de 24h de servicio al cliente).
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

          // Clic en botón de una PLANTILLA aprobada (recordatorio_24h real,
          // fuera de la ventana de 24h). El payload ahí es fijo — el mismo
          // texto para cualquiera que la reciba — así que se resuelve la
          // cita por teléfono + recordatorio_24h más reciente (RPC
          // wa_resolver_boton_plantilla), no por un id embebido.
          const btnPlantilla = msg.button?.text as string | undefined;
          // true en cuanto se identifica como clic de botón de plantilla,
          // haya o no encontrado una cita que actualizar — es un botón
          // estructurado, nunca debe interpretarse además como texto libre.
          const resueltoPorPlantilla = btnPlantilla === "Confirmar" || btnPlantilla === "Cancelar";
          if (resueltoPorPlantilla) {
            const accion = btnPlantilla === "Confirmar" ? "confirmar" : "cancelar";
            await rest(`rpc/wa_resolver_boton_plantilla`, {
              method: "POST",
              body: JSON.stringify({ p_from: from, p_accion: accion }),
            });
          }

          const texto = extraerTexto(msg, btn);
          // Interpreta CONFIRMO / BAJA en texto libre (flujo original). Se
          // omite si ya se resolvió por botón (de cita o de plantilla)
          // arriba, para que "Cancelar" no dispare además la baja de
          // WhatsApp (que usa la misma palabra con otro significado).
          if (!btnMatch && !resueltoPorPlantilla) {
            await rest(`rpc/wa_inbound`, {
              method: "POST",
              body: JSON.stringify({ p_from: from, p_texto: texto }),
            });
          }

          // Si el mensaje trae un archivo (foto/audio/video/documento/
          // sticker), se descarga y se sube a wa-media — así queda
          // disponible en Conversaciones y no solo como una etiqueta.
          const tipoMedia = MEDIA_TIPOS.find(t => msg[t]);
          let mediaPath: string | null = null;
          if (tipoMedia) {
            const m = msg[tipoMedia];
            mediaPath = await descargarYSubirMedia(m.id, m.mime_type || "application/octet-stream", from);
          }

          // Registra la respuesta en la bitácora.
          await rest(`wa_mensajes`, {
            method: "POST", headers: { "Prefer": "return=minimal" },
            body: JSON.stringify({
              tel: from, flujo: "entrante", cuerpo: texto, estado: "respondido",
              media_path: mediaPath, media_tipo: tipoMedia ?? null,
              requiere_aprobacion: false, creado_por: "clienta",
            }),
          });
        }
      }
    }
    return new Response("ok", { status: 200 });
  } catch (_e) {
    // Siempre 200 para que Meta no reintente en bucle por un payload raro.
    return new Response("ok", { status: 200 });
  }
});
