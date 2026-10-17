-- Completa los triggers de WhatsApp por estado de cita: ya existían para
-- creación (confirmacion_cita) y cierre (post_visita), pero no para los
-- dos estados donde más falta hace avisarle a la clienta — cancelación y
-- no-show — dejándola sin saber qué pasó con su cita o sin invitación a
-- reagendar. Mismo patrón que 049_wa_triggers_flujos.sql: trigger de BD
-- (no del frontend, hay más de un camino para cambiar el estado de una
-- cita), security definer, respeta wa_optin y modo_prueba.
--
-- WhatsApp queda fuera de preview a propósito (ver docs/DEPLOY.md) — estos
-- triggers solo se crean en el esquema public.

-- Plantillas nuevas en el catálogo versionado (ver wa-templates/index.ts,
-- donde se sometieron a aprobación de Meta vía YCloud).
insert into wa_plantillas (nombre, idioma, categoria, flujo, cuerpo, estado_meta, activa)
values
  ('cita_cancelada', 'es_MX', 'utility',
   'cancelacion',
   'Hola {{1}} 💛 Tu cita de {{2}} del {{3}} a las {{4}} quedó cancelada. Si fue un error o quieres reagendar, escríbenos por aquí.',
   'pendiente', true),
  ('cita_no_asistio', 'es_MX', 'utility',
   'no_asistio',
   'Hola {{1}}, notamos que no pudiste llegar a tu cita de {{2}} de hoy. Esperamos que todo esté bien — si quieres reagendar, aquí estamos 💛',
   'pendiente', true)
on conflict (nombre, idioma) do nothing;

-- 1) cita_cancelada: al pasar una cita a 'canc'.
create or replace function wa_trigger_cita_cancelada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meses     text[] := array['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  v_prueba    boolean;
  v_test10    text;
  v_tel       text;
  v_nombre    text;
  v_fecha_fmt text;
begin
  v_tel := nullif(new.tel, '');
  if v_tel is null and new.cliente_id is not null then
    select tel into v_tel from clientas where id = new.cliente_id;
  end if;
  if v_tel is null then return new; end if;

  if new.cliente_id is not null
     and not coalesce((select wa_optin from clientas where id = new.cliente_id), true) then
    return new;
  end if;

  select wa_modo_prueba, right(regexp_replace(coalesce(wa_test_tel,''),'\D','','g'),10)
    into v_prueba, v_test10
    from config where id = 'main';
  if v_prueba and right(regexp_replace(v_tel,'\D','','g'),10) <> v_test10 then
    return new;
  end if;

  select nombre into v_nombre from clientas where id = new.cliente_id;
  v_nombre := coalesce(v_nombre, new.cl);

  v_fecha_fmt := case when new.fecha is not null
    then to_char(new.fecha::date, 'DD') || ' ' || v_meses[extract(month from new.fecha::date)::int]
    else 'hoy' end;

  insert into wa_mensajes (clienta_id, tel, flujo, plantilla, variables, cuerpo, estado, requiere_aprobacion, cita_id, creado_por)
  values (
    new.cliente_id, v_tel, 'cancelacion', 'cita_cancelada',
    jsonb_build_object('1', split_part(v_nombre,' ',1), '2', new.srv, '3', v_fecha_fmt, '4', new.h),
    format('Hola %s 💛 Tu cita de %s del %s a las %s quedó cancelada. Si fue un error o quieres reagendar, escríbenos por aquí.',
           split_part(v_nombre,' ',1), new.srv, v_fecha_fmt, new.h),
    'aprobado', false, new.id, 'trigger'
  );
  return new;
end $$;

revoke all on function wa_trigger_cita_cancelada() from public, anon, authenticated;

drop trigger if exists trg_wa_cita_cancelada on citas;
create trigger trg_wa_cita_cancelada
after update of estado on citas
for each row
when (old.estado is distinct from 'canc' and new.estado = 'canc')
execute function wa_trigger_cita_cancelada();

-- 2) cita_no_asistio: al pasar una cita a 'no_asistio'.
create or replace function wa_trigger_cita_no_asistio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prueba boolean;
  v_test10 text;
  v_tel    text;
  v_nombre text;
begin
  v_tel := nullif(new.tel, '');
  if v_tel is null and new.cliente_id is not null then
    select tel into v_tel from clientas where id = new.cliente_id;
  end if;
  if v_tel is null then return new; end if;

  if new.cliente_id is not null
     and not coalesce((select wa_optin from clientas where id = new.cliente_id), true) then
    return new;
  end if;

  select wa_modo_prueba, right(regexp_replace(coalesce(wa_test_tel,''),'\D','','g'),10)
    into v_prueba, v_test10
    from config where id = 'main';
  if v_prueba and right(regexp_replace(v_tel,'\D','','g'),10) <> v_test10 then
    return new;
  end if;

  select nombre into v_nombre from clientas where id = new.cliente_id;
  v_nombre := coalesce(v_nombre, new.cl);

  insert into wa_mensajes (clienta_id, tel, flujo, plantilla, variables, cuerpo, estado, requiere_aprobacion, cita_id, creado_por)
  values (
    new.cliente_id, v_tel, 'no_asistio', 'cita_no_asistio',
    jsonb_build_object('1', split_part(v_nombre,' ',1), '2', new.srv),
    format('Hola %s, notamos que no pudiste llegar a tu cita de %s de hoy. Esperamos que todo esté bien — si quieres reagendar, aquí estamos 💛',
           split_part(v_nombre,' ',1), new.srv),
    'aprobado', false, new.id, 'trigger'
  );
  return new;
end $$;

revoke all on function wa_trigger_cita_no_asistio() from public, anon, authenticated;

drop trigger if exists trg_wa_cita_no_asistio on citas;
create trigger trg_wa_cita_no_asistio
after update of estado on citas
for each row
when (old.estado is distinct from 'no_asistio' and new.estado = 'no_asistio')
execute function wa_trigger_cita_no_asistio();
