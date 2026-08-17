// wa-responder — manda texto libre a una clienta desde la bandeja de
// conversaciones del CRM. Solo funciona dentro de la ventana de 24h de
// servicio al cliente (Meta exige plantilla aprobada fuera de esa ventana);
// se valida antes de llamar a Meta para dar un error claro en vez del
// código crudo de la API.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GRAPH = "https://graph.facebook.com/v21.0";
const PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || "1252418747952067";
const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VENTANA_MS = 24 * 60 * 60 * 1000;

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), { status, headers: { "Content-Type": "application/json" } });
}

function normTel(raw: string): string {
  const d = String(raw || "").replace(/\D/g, "");
  if (d.length === 10) return "52" + d;
  if (d.length === 11 && d.startsWith("1")) return "52" + d.slice(1);
  return d;
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

// El bucket wa-media es privado (igual que fotos-clientas) — para que Meta
// pueda descargar el archivo hace falta una URL firmada temporal; 10 min le
// sobra de margen a Meta para ir por el archivo antes de que expire.
async function signedUrlWaMedia(path: string): Promise<string | null> {
  const res = await fetch(`${SUPA_URL}/storage/v1/object/sign/wa-media/${path}`, {
    method: "POST",
    headers: { "apikey": SERVICE, "Authorization": `Bearer ${SERVICE}`, "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: 600 }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.signedURL ? `${SUPA_URL}/storage/v1${data.signedURL}` : null;
}

Deno.serve(async (req: Request) => {
  try {
    const token = Deno.env.get("WHATSAPP_TOKEN");
    if (!token) return json({ error: "Falta el secreto WHATSAPP_TOKEN." }, 500);

    const body = await req.json().catch(() => ({}));
    const telRaw = String(body.tel || "");
    const texto = typeof body.texto === "string" ? body.texto.trim() : "";
    const media = body.media as { path?: string; tipo?: string; caption?: string } | undefined;
    if (!telRaw || (!texto && !media?.path)) return json({ error: "Faltan 'tel' y ('texto' o 'media')." }, 400);

    const MEDIA_TIPOS = ["image", "audio", "video", "document"];
    if (media?.path && !MEDIA_TIPOS.includes(media.tipo || "")) {
      return json({ error: "Tipo de media no soportado." }, 400);
    }

    const last10 = telRaw.replace(/\D/g, "").slice(-10);
    // Último mensaje entrante de esa clienta — determina si la ventana de
    // 24h de servicio al cliente sigue abierta (Meta la exige para texto
    // libre; fuera de ella solo se puede mandar una plantilla aprobada).
    const q = `wa_mensajes?flujo=eq.entrante&select=tel,created_at&order=created_at.desc&limit=200`;
    const resEntrantes = await rest(q);
    const entrantes = await resEntrantes.json();
    const ultimo = Array.isArray(entrantes)
      ? entrantes.find((m: { tel: string }) => String(m.tel || "").replace(/\D/g, "").slice(-10) === last10)
      : null;
    if (!ultimo) {
      return json({ error: "Esta clienta no tiene mensajes entrantes registrados — no se puede abrir la ventana de 24h sin que ella haya escrito primero." }, 409);
    }
    const desdeUltimo = Date.now() - new Date(ultimo.created_at).getTime();
    if (desdeUltimo > VENTANA_MS) {
      return json({ error: "La ventana de 24h desde su último mensaje ya cerró. Para contactarla de nuevo hay que usar una plantilla aprobada, no texto libre." }, 409);
    }

    const to = normTel(telRaw);

    let payload: Record<string, unknown>;
    let cuerpoLog: string;
    if (media?.path) {
      const signedUrl = await signedUrlWaMedia(media.path);
      if (!signedUrl) return json({ error: "No se pudo generar el enlace del archivo — verifica que se haya subido correctamente." }, 500);
      const tipo = media.tipo!;
      const mediaObj: Record<string, unknown> = { link: signedUrl };
      // Meta solo acepta "caption" en image/video/document, no en audio.
      if (media.caption && tipo !== "audio") mediaObj.caption = media.caption;
      payload = { messaging_product: "whatsapp", to, type: tipo, [tipo]: mediaObj };
      const MEDIA_LABEL: Record<string, string> = { image: "Imagen", audio: "Audio", video: "Video", document: "Documento" };
      cuerpoLog = media.caption || `[${MEDIA_LABEL[tipo] || tipo}]`;
    } else {
      payload = { messaging_product: "whatsapp", to, type: "text", text: { body: texto } };
      cuerpoLog = texto;
    }

    const res = await fetch(`${GRAPH}/${PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    const nowIso = new Date().toISOString();

    if (res.ok) {
      const wamid = data?.messages?.[0]?.id ?? null;
      await rest(`wa_mensajes`, {
        method: "POST", headers: { "Prefer": "return=minimal" },
        body: JSON.stringify({
          tel: to, flujo: "saliente_libre", cuerpo: cuerpoLog, estado: "enviado",
          media_path: media?.path ?? null, media_tipo: media?.tipo ?? null,
          wa_message_id: wamid, enviado_at: nowIso, requiere_aprobacion: false, creado_por: "staff",
        }),
      });
      return json({ ok: true, wamid }, 200);
    } else {
      const err = JSON.stringify(data?.error ?? data).slice(0, 500);
      await rest(`wa_mensajes`, {
        method: "POST", headers: { "Prefer": "return=minimal" },
        body: JSON.stringify({
          tel: to, flujo: "saliente_libre", cuerpo: cuerpoLog, estado: "fallido",
          media_path: media?.path ?? null, media_tipo: media?.tipo ?? null,
          error: err, requiere_aprobacion: false, creado_por: "staff",
        }),
      });
      return json({ ok: false, error: err }, 400);
    }
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
