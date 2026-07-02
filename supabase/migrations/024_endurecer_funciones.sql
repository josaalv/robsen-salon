-- Fija el search_path (evita hijacking por search_path mutable)
create or replace function public.fn_check_cita_solapada()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_conflicto int;
  v_inicio int;
  v_fin int;
begin
  if new.estado = 'canc' or new.est is null then
    return new;
  end if;
  v_inicio := (split_part(new.h, ':', 1)::int * 60) + split_part(new.h, ':', 2)::int;
  v_fin := v_inicio + coalesce(new.dur, 60);

  select count(*) into v_conflicto
  from citas c
  where c.est = new.est
    and c.id <> new.id
    and c.estado <> 'canc'
    and coalesce(c.fecha, '') = coalesce(new.fecha, '')
    and (
      (split_part(c.h, ':', 1)::int * 60 + split_part(c.h, ':', 2)::int) < v_fin
      and
      (split_part(c.h, ':', 1)::int * 60 + split_part(c.h, ':', 2)::int + coalesce(c.dur, 60)) > v_inicio
    );

  if v_conflicto > 0 then
    raise exception 'Ya existe una cita para esa estilista en ese horario';
  end if;
  return new;
end;
$$;

-- fn_audit_log solo debe correr como trigger, nunca invocarse directo vía RPC.
revoke execute on function public.fn_audit_log() from public, anon, authenticated;
