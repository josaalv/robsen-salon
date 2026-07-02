-- Servicios desactivables sin borrar
alter table servicios add column if not exists activo boolean not null default true;

-- Protección real contra clientas duplicadas por teléfono (bloqueo exacto en BD)
alter table clientas add column if not exists tel_normalizado text
  generated always as (regexp_replace(coalesce(tel,''), '[^0-9]', '', 'g')) stored;
create unique index if not exists idx_clientas_tel_unico
  on clientas(tel_normalizado) where tel_normalizado <> '';

-- Estado "no_asistio" para citas, distinto de "cancelada"
alter table citas add constraint citas_estado_valido
  check (estado in ('pend','conf','pay','done','canc','no_asistio'));

-- Validaciones mínimas en base de datos (no solo en el frontend)
alter table citas add constraint citas_total_no_negativo check (total >= 0);
alter table citas add constraint citas_anticipo_no_negativo check (ant >= 0);
alter table citas add constraint citas_anticipo_no_mayor_total check (ant <= total);
alter table ventas add constraint ventas_descuento_no_negativo check (descuento >= 0);
alter table ventas add constraint ventas_anticipo_no_negativo check (anticipo >= 0);
alter table productos add constraint productos_precio_no_negativo check (precio >= 0);
alter table productos add constraint productos_stock_no_negativo check (stock >= 0);
alter table servicios add constraint servicios_precio_no_negativo check (precio >= 0);

-- Evita citas encimadas de la misma estilista a nivel de base de datos
-- (el frontend ya lo evita, esto es la red de seguridad real).
create or replace function public.fn_check_cita_solapada()
returns trigger
language plpgsql
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

create trigger trg_citas_no_solapar
  before insert or update on citas
  for each row execute function public.fn_check_cita_solapada();
