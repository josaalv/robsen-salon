-- La validación de traslape de citas debe operar por servicio, no por el
-- agregado de la cita. Antes usaba new.est + new.dur (suma), lo que reservaba
-- toda la duración de una cita multi-servicio en un solo empleado. Ahora cada
-- servicio puede tener su propio empleado (est) y hora (h) en el jsonb
-- `servicios`; se expanden en bloques y se compara bloque contra bloque del
-- mismo empleado y día. Retrocompatible: una cita sin est/h por servicio se
-- trata como un único bloque con el est/h/dur de la cita.
create or replace function public.fn_check_cita_solapada()
returns trigger
language plpgsql
as $$
declare
  v_new_blocks jsonb;
  v_nb jsonb;
  v_ob jsonb;
  v_other record;
  v_est text;
  v_ns int; v_ne int;
  v_os int; v_oe int;
begin
  if new.estado = 'canc' then
    return new;
  end if;

  if new.servicios is not null and jsonb_array_length(new.servicios) > 0
     and exists (select 1 from jsonb_array_elements(new.servicios) s
                 where s->>'est' is not null or s->>'h' is not null) then
    select jsonb_agg(jsonb_build_object(
             'est', coalesce(s->>'est', new.est),
             'h',   coalesce(s->>'h', new.h),
             'dur', coalesce((s->>'dur')::int, new.dur, 60)))
      into v_new_blocks
      from jsonb_array_elements(new.servicios) s;
  else
    v_new_blocks := jsonb_build_array(
      jsonb_build_object('est', new.est, 'h', new.h, 'dur', coalesce(new.dur, 60)));
  end if;

  for v_nb in select * from jsonb_array_elements(v_new_blocks) loop
    v_est := v_nb->>'est';
    if v_est is null then continue; end if;
    v_ns := (split_part(v_nb->>'h', ':', 1)::int * 60) + split_part(v_nb->>'h', ':', 2)::int;
    v_ne := v_ns + coalesce((v_nb->>'dur')::int, 60);

    for v_other in
      select c.id, c.est, c.h, c.dur, c.servicios
      from citas c
      where c.id <> new.id
        and c.estado <> 'canc'
        and coalesce(c.fecha, '') = coalesce(new.fecha, '')
    loop
      if v_other.servicios is not null and jsonb_array_length(v_other.servicios) > 0
         and exists (select 1 from jsonb_array_elements(v_other.servicios) s
                     where s->>'est' is not null or s->>'h' is not null) then
        for v_ob in select * from jsonb_array_elements(v_other.servicios) loop
          if coalesce(v_ob->>'est', v_other.est) = v_est then
            v_os := (split_part(coalesce(v_ob->>'h', v_other.h), ':', 1)::int * 60)
                    + split_part(coalesce(v_ob->>'h', v_other.h), ':', 2)::int;
            v_oe := v_os + coalesce((v_ob->>'dur')::int, v_other.dur, 60);
            if v_os < v_ne and v_oe > v_ns then
              raise exception 'Ya existe una cita para esa estilista en ese horario';
            end if;
          end if;
        end loop;
      elsif v_other.est = v_est then
        v_os := (split_part(v_other.h, ':', 1)::int * 60) + split_part(v_other.h, ':', 2)::int;
        v_oe := v_os + coalesce(v_other.dur, 60);
        if v_os < v_ne and v_oe > v_ns then
          raise exception 'Ya existe una cita para esa estilista en ese horario';
        end if;
      end if;
    end loop;
  end loop;

  return new;
end;
$$;
