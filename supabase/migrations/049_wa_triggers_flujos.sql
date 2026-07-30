-- Activa los 3 flujos aprobados por Meta que hasta ahora no tenían ningún
-- disparador (confirmacion_cita, post_visita, bienvenida). Van por trigger
-- de base de datos, no desde el frontend, porque hay al menos dos caminos
-- para crear una cita (Agenda.tsx interno y Booking.tsx público) y un
-- trigger es la única forma de cubrir ambos sin duplicar la llamada.
-- Mismo patrón que wa_encolar(): security definer, respeta wa_optin y el
-- modo prueba (config.wa_modo_prueba / wa_test_tel).

-- 1) confirmacion_cita: al crear una cita.
create or replace function wa_trigger_confirmacion_cita()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meses      text[] := array['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  v_prueba     boolean;
  v_test10     text;
  v_tel        text;
  v_nombre     text;
  v_est_nombre text;
  v_fecha_fmt  text;
begin
  if new.fecha is null then return new; end if;

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

  select split_part(nombre,' ',1) into v_est_nombre from estilistas where id = new.est;
  v_est_nombre := coalesce(v_est_nombre, 'tu estilista');

  v_fecha_fmt := to_char(new.fecha::date, 'DD') || ' ' || v_meses[extract(month from new.fecha::date)::int];

  insert into wa_mensajes (clienta_id, tel, flujo, plantilla, variables, cuerpo, estado, requiere_aprobacion, cita_id, creado_por)
  values (
    new.cliente_id, v_tel, 'confirmacion', 'confirmacion_cita',
    jsonb_build_object('1', split_part(v_nombre,' ',1), '2', new.srv, '3', v_fecha_fmt, '4', new.h, '5', v_est_nombre),
    format('Hola %s 💛 Confirmamos tu cita de %s el %s a las %s con %s en Robsen Salón & Spa. Responde CONFIRMO para apartar tu lugar.',
           split_part(v_nombre,' ',1), new.srv, v_fecha_fmt, new.h, v_est_nombre),
    'aprobado', false, new.id, 'trigger'
  );
  return new;
end $$;

-- PUBLIC explícito además de anon/authenticated: son miembros implícitos de
-- PUBLIC, así que si PUBLIC conserva el grant (comportamiento por defecto de
-- Postgres al crear una función) igual queda ejecutable vía RPC pese al
-- revoke de arriba. Confirmado con get_advisors tras aplicar esta migración.
revoke all on function wa_trigger_confirmacion_cita() from public, anon, authenticated;

drop trigger if exists trg_wa_confirmacion_cita on citas;
create trigger trg_wa_confirmacion_cita
after insert on citas
for each row execute function wa_trigger_confirmacion_cita();

-- 2) post_visita: al cerrar una cita (estado pasa a 'done').
create or replace function wa_trigger_post_visita()
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
  if exists (select 1 from wa_mensajes m where m.flujo = 'post_visita' and m.cita_id = new.id and m.estado <> 'cancelado') then
    return new;
  end if;

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
    new.cliente_id, v_tel, 'post_visita', 'post_visita',
    jsonb_build_object('1', split_part(v_nombre,' ',1), '2', new.srv),
    format('Gracias por visitarnos, %s ✨ Fue un placer consentirte con tu %s. Nos encantará verte pronto en Robsen Salón & Spa 💛',
           split_part(v_nombre,' ',1), new.srv),
    'aprobado', false, new.id, 'trigger'
  );
  return new;
end $$;

revoke all on function wa_trigger_post_visita() from public, anon, authenticated;

drop trigger if exists trg_wa_post_visita on citas;
create trigger trg_wa_post_visita
after update of estado on citas
for each row
when (old.estado is distinct from 'done' and new.estado = 'done')
execute function wa_trigger_post_visita();

-- 3) bienvenida: al dar de alta una clienta.
create or replace function wa_trigger_bienvenida()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prueba boolean;
  v_test10 text;
begin
  if new.tel is null or new.tel = '' then return new; end if;
  if not coalesce(new.wa_optin, true) then return new; end if;

  select wa_modo_prueba, right(regexp_replace(coalesce(wa_test_tel,''),'\D','','g'),10)
    into v_prueba, v_test10
    from config where id = 'main';
  if v_prueba and right(regexp_replace(new.tel,'\D','','g'),10) <> v_test10 then
    return new;
  end if;

  insert into wa_mensajes (clienta_id, tel, flujo, plantilla, variables, cuerpo, estado, requiere_aprobacion, creado_por)
  values (
    new.id, new.tel, 'bienvenida', 'bienvenida',
    jsonb_build_object('1', split_part(new.nombre,' ',1)),
    format('¡Bienvenida a Robsen Salón & Spa, %s! 💛 Gracias por tu confianza. Estamos para consentirte; cualquier duda, escríbenos por aquí. ✨',
           split_part(new.nombre,' ',1)),
    'aprobado', false, 'trigger'
  );
  return new;
end $$;

revoke all on function wa_trigger_bienvenida() from public, anon, authenticated;

drop trigger if exists trg_wa_bienvenida on clientas;
create trigger trg_wa_bienvenida
after insert on clientas
for each row execute function wa_trigger_bienvenida();
