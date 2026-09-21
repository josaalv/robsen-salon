# Pendientes operativos

Cosas que quedaron pausadas por decisión explícita del usuario (no por
olvido) — cuando se retome cada una, seguir estos pasos tal cual, no
reinventarlos.

## Mercado Pago — activar credenciales reales de producción

**Estado:** pausado el 2026-09 por surgir cosas más urgentes. El sistema
sigue funcionando con el Access Token de **prueba** (`TEST-...`) en
`MERCADOPAGO_ACCESS_TOKEN` — nadie ha pagado de verdad todavía en
`/agendar`, los "pagos" actuales son simulados por el sandbox de Mercado
Pago.

**Disparador para retomar:** el usuario pide "recordar pagos mercadopago"
o algo similar (activar Mercado Pago, credenciales reales, cobrar de
verdad, etc.) — dar este mismo paso a paso, no uno nuevo improvisado.

### Dónde vive cada credencial

- **Access Tokens (prueba y real):** se generan en el panel de
  desarrollador de Mercado Pago.
- **Dónde se guardan para que el sistema los use:** como *secrets* de
  Edge Functions en Supabase (NO son secrets de GitHub — esos son solo
  para el build/FTP, ver `DEPLOY.md`). Las funciones que los leen son
  `mp-crear-preferencia` y `mp-webhook`, buscando exactamente estos dos
  nombres:
  - `MERCADOPAGO_ACCESS_TOKEN` → producción (real)
  - `MERCADOPAGO_ACCESS_TOKEN_TEST` → prueba (sandbox)

### Paso a paso

1. **Panel de Mercado Pago Developers:**
   `https://www.mercadopago.com.mx/developers/panel/app`
   Iniciar sesión con la cuenta de Mercado Pago del salón (la que recibe
   los cobros). Si no existe una "aplicación" todavía, crearla — modelo
   de integración "Pagos online" / "Checkout Pro" (es lo que ya usa
   `mp-crear-preferencia`).

2. **Pestaña de Credenciales** dentro de la aplicación — hay dos
   secciones:
   - **Credenciales de prueba:** Access Token que empieza `TEST-...`.
     Copiarlo completo.
   - **Credenciales de producción:** Access Token que empieza
     `APP_USR-...`. Si la cuenta aún no completó la activación/
     verificación de negocio (RFC, cuenta bancaria de retiro, tipo de
     actividad), Mercado Pago pide completar eso primero antes de
     mostrar el token real — es un flujo dentro de su propio sitio, no
     algo saltable desde aquí.

3. **Secrets de Edge Functions en Supabase:**
   `https://supabase.com/dashboard/project/pkpwrifwrntjztprwcwp/functions/secrets`
   (proyecto `robsen-salon`, ref `pkpwrifwrntjztprwcwp`).

4. **Agregar** (si no existe) el secret `MERCADOPAGO_ACCESS_TOKEN_TEST`
   con el valor `TEST-...`.

5. **Reemplazar** el valor del secret existente `MERCADOPAGO_ACCESS_TOKEN`
   por el token real `APP_USR-...`.

   No hace falta redeploy manual — las Edge Functions leen los secrets en
   cada invocación (`Deno.env.get(...)`), el cambio aplica de inmediato.

6. **Avisar a Claude** cuando ambos estén guardados, para hacer una
   verificación controlada antes de que cualquier clienta real pague:
   - Crear una preferencia de pago de prueba contra el entorno real (sin
     cobro real) para confirmar que Mercado Pago acepta el token nuevo.
   - Revisar logs de `mp-crear-preferencia` y `mp-webhook` por errores de
     token faltante o inválido.
   - Solo después de eso, dar por bueno que `/agendar` puede cobrar de
     verdad.

### Pendiente relacionado: apartados en línea no generan venta local

Al corregir (2026-09) el corte de caja para apartados cobrados en
mostrador (ver `completar_venta_apartado` en
`supabase/migrations/068_completar_venta_apartado.sql` y
`completarApartado` en `src/data/store.ts`), quedó identificado — pero
sin resolver todavía, a propósito, porque las credenciales reales de
Mercado Pago siguen pausadas (arriba) — el mismo problema para los
anticipos cobrados **en línea** desde `/agendar`:

- Una cita agendada y pagada en línea vía Mercado Pago hoy solo guarda el
  monto del anticipo en `citas.ant` — **no** crea un registro en `ventas`
  (a diferencia de un apartado de mostrador, que sí pasa por
  `crear_venta_con_lineas` y aparece en "Apartados de citas" en Ventas).
- Por eso ese dinero no aparece en el corte de caja del día en que
  Mercado Pago lo cobró — solo se ve cuando alguien completa la cita en
  el POS, y en ese momento se atribuiría al método que se elija ahí
  (mostrador), no a "Mercado Pago", si no se corrige.
- `src/screens/Agenda.tsx` (formulario de cita) ya evita el peor síntoma
  mientras tanto: no crea un apartado local automáticamente para un
  anticipo que llegó por otra vía y no fue tocado en el formulario (ver
  comentario "antOriginal" en `guardar()`), así no se le atribuye al
  personal de mostrador un dinero que nunca cobraron.
- **Cuando se retomen las credenciales reales de Mercado Pago:** falta
  que `mp-webhook` (Edge Function) cree su propio registro de venta con
  `estado: 'apartado'` y `pago: 'Mercado Pago'` (o similar) en el momento
  en que confirma el pago — igual que hace Agenda.tsx para un apartado de
  mostrador — para que ese anticipo aparezca en "Apartados de citas" y el
  corte lo cuente el día real en que se cobró, no el día en que se
  complete la cita en el salón.
