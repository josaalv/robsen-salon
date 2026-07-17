-- Procesa una respuesta entrante de WhatsApp: da de baja (BAJA/STOP) o confirma
-- citas (CONFIRMO) haciendo match por los últimos 10 dígitos del teléfono.
-- SECURITY DEFINER + search_path fijo; solo la invoca el webhook (service role).
create or replace function wa_inbound(p_from text, p_texto text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last10 text := right(regexp_replace(coalesce(p_from,''), '\D', '', 'g'), 10);
  v_txt    text := upper(coalesce(p_texto,''));
  v_optout int := 0;
  v_conf   int := 0;
begin
  if v_last10 = '' then
    return jsonb_build_object('optout', 0, 'confirmadas', 0);
  end if;

  if v_txt ~ '(BAJA|STOP|CANCELAR)' then
    update clientas
      set wa_optin = false, wa_optout_at = now()
      where right(regexp_replace(coalesce(tel,''),'\D','','g'),10) = v_last10;
    get diagnostics v_optout = row_count;
  end if;

  if v_txt ~ '(CONFIRMO|CONFIRMAR|CONFIRMADO|CONFIRMA)' then
    update citas
      set estado = 'conf'
      where right(regexp_replace(coalesce(tel,''),'\D','','g'),10) = v_last10
        and estado = 'pend';
    get diagnostics v_conf = row_count;
  end if;

  return jsonb_build_object('optout', v_optout, 'confirmadas', v_conf);
end $$;

revoke all on function wa_inbound(text, text) from anon, authenticated;
