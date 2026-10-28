-- Corrige el corte de caja para citas con apartado (anticipo cobrado al
-- agendar). Hasta ahora, al completar la cita (cobrar el resto en el POS),
-- el código del cliente borraba la venta de apartado original y creaba una
-- venta nueva con el total completo, fechada el día en que se completa la
-- cita — no el día en que de verdad se cobró el anticipo. Dos problemas:
--
-- 1. El anticipo (cobrado quizá días antes, con su propio método de pago)
--    desaparecía del corte de ESE día — el dinero que de verdad entró a caja
--    esa fecha ya no quedaba registrado ahí.
-- 2. El corte del día en que se completa la cita contaba el TOTAL (anticipo
--    + saldo) bajo el método elegido al cerrar el ticket — como si todo se
--    hubiera cobrado ese día con ese único método. Si el anticipo se cobró
--    con un medio distinto (o en otra fecha), el corte de caja no cuadraba:
--    "faltaba" dinero que en realidad nunca se perdió, solo estaba mal
--    atribuido.
--
-- Esta función actualiza la venta de apartado EN SU LUGAR en vez de
-- borrarla y recrearla — exactamente el mismo patrón que ya usa
-- "cobrar saldo" para ventas 'parcial' normales (ver VentaDetalle en
-- src/screens/Ventas.tsx): la venta conserva su `fecha` original (el día
-- del anticipo, con su método real), y se guarda `saldo_cobrado_en` +
-- `saldo_cobrado_monto` con el día y método del saldo — el corte de caja ya
-- sabe separar ambos eventos por fecha (ver CierreCajaModal, creadasHoy vs
-- saldosHoy). El ticket no cambia: el apartado ya se creó vía
-- crear_venta_con_lineas y ya tiene un número real asignado.

create or replace function public.completar_venta_apartado(
  p_venta_id text,
  p_lineas jsonb,
  p_cliente_id text,
  p_descuento numeric,
  p_pago text,
  p_pagos jsonb,
  p_saldo_cobrado_monto numeric
)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
  v_linea_vieja record;
  v_linea_nueva jsonb;
  v_cant int;
  v_precio numeric;
  v_num_lineas int;
  v_filas_actualizadas int;
  v_result jsonb;
begin
  if not exists (select 1 from ventas where id = p_venta_id) then
    raise exception 'Venta % no encontrada', p_venta_id;
  end if;

  v_num_lineas := jsonb_array_length(coalesce(p_lineas, '[]'::jsonb));
  if v_num_lineas = 0 then
    raise exception 'Una venta debe tener al menos una línea';
  end if;

  -- Las líneas del apartado se reemplazan por las del ticket final (pudo
  -- agregarse un producto u otro servicio en el POS) — se repone el stock
  -- de cualquier producto que ya estuviera en el apartado antes de borrar
  -- sus líneas, igual que hace eliminar_venta.
  for v_linea_vieja in
    select producto_id, cant from lineas_venta
    where venta_id = p_venta_id and tipo = 'producto' and producto_id is not null
  loop
    update productos set stock = stock + v_linea_vieja.cant, vendidos = greatest(0, vendidos - v_linea_vieja.cant)
      where id = v_linea_vieja.producto_id;
  end loop;

  delete from lineas_venta where venta_id = p_venta_id;

  for v_linea_nueva in select * from jsonb_array_elements(p_lineas) loop
    v_cant := (v_linea_nueva->>'cant')::int;
    v_precio := (v_linea_nueva->>'precio')::numeric;
    if v_cant is null or v_cant <= 0 then
      raise exception 'Cada línea debe tener una cantidad mayor a cero';
    end if;
    if v_precio is null or v_precio < 0 then
      raise exception 'Cada línea debe tener un precio válido';
    end if;

    insert into lineas_venta (venta_id, tipo, nombre, producto_id, est, cant, precio, com, com_monto)
    values (
      p_venta_id, v_linea_nueva->>'tipo', v_linea_nueva->>'nombre',
      nullif(v_linea_nueva->>'producto_id', ''), nullif(v_linea_nueva->>'est', ''),
      v_cant, v_precio, coalesce((v_linea_nueva->>'com')::numeric, 0),
      nullif(v_linea_nueva->>'com_monto', '')::numeric
    );

    if v_linea_nueva->>'tipo' = 'producto' and nullif(v_linea_nueva->>'producto_id', '') is not null then
      update productos set stock = stock - v_cant, vendidos = vendidos + v_cant
        where id = v_linea_nueva->>'producto_id';
      get diagnostics v_filas_actualizadas = row_count;
      if v_filas_actualizadas = 0 then
        raise exception 'Producto % no encontrado', v_linea_nueva->>'producto_id';
      end if;

      insert into movimientos (id, fecha, prod, tipo, cant, motivo, ref)
      values (
        'mv' || replace(gen_random_uuid()::text, '-', ''),
        to_char(now(), 'DD Mon · HH24:MI'),
        v_linea_nueva->>'nombre', 'salida', v_cant,
        'Venta · ' || (select ticket from ventas where id = p_venta_id),
        p_venta_id
      );
    end if;
  end loop;

  -- `fecha` NO se toca — es la clave de la que depende el corte de caja
  -- para saber en qué día se cobró el anticipo.
  update ventas set
    cliente_id = nullif(p_cliente_id, ''),
    descuento = coalesce(p_descuento, 0),
    pago = p_pago,
    pagos = case when jsonb_typeof(p_pagos) = 'array' then p_pagos else null end,
    estado = 'pagada',
    saldo_cobrado_en = now(),
    saldo_cobrado_monto = p_saldo_cobrado_monto
  where id = p_venta_id;

  select jsonb_build_object(
    'venta', to_jsonb(v.*),
    'lineas', coalesce((select jsonb_agg(to_jsonb(l.*)) from lineas_venta l where l.venta_id = v.id), '[]'::jsonb)
  ) into v_result
  from ventas v where v.id = p_venta_id;

  return v_result;
end;
$function$;

grant execute on function public.completar_venta_apartado(text, jsonb, text, numeric, text, jsonb, numeric) to authenticated;

-- Misma función para el esquema preview (ver 057_clone_public_to_preview_schema.sql).
create or replace function preview.completar_venta_apartado(
  p_venta_id text,
  p_lineas jsonb,
  p_cliente_id text,
  p_descuento numeric,
  p_pago text,
  p_pagos jsonb,
  p_saldo_cobrado_monto numeric
)
returns jsonb
language plpgsql
set search_path to 'preview'
as $function$
declare
  v_linea_vieja record;
  v_linea_nueva jsonb;
  v_cant int;
  v_precio numeric;
  v_num_lineas int;
  v_filas_actualizadas int;
  v_result jsonb;
begin
  if not exists (select 1 from ventas where id = p_venta_id) then
    raise exception 'Venta % no encontrada', p_venta_id;
  end if;

  v_num_lineas := jsonb_array_length(coalesce(p_lineas, '[]'::jsonb));
  if v_num_lineas = 0 then
    raise exception 'Una venta debe tener al menos una línea';
  end if;

  for v_linea_vieja in
    select producto_id, cant from lineas_venta
    where venta_id = p_venta_id and tipo = 'producto' and producto_id is not null
  loop
    update productos set stock = stock + v_linea_vieja.cant, vendidos = greatest(0, vendidos - v_linea_vieja.cant)
      where id = v_linea_vieja.producto_id;
  end loop;

  delete from lineas_venta where venta_id = p_venta_id;

  for v_linea_nueva in select * from jsonb_array_elements(p_lineas) loop
    v_cant := (v_linea_nueva->>'cant')::int;
    v_precio := (v_linea_nueva->>'precio')::numeric;
    if v_cant is null or v_cant <= 0 then
      raise exception 'Cada línea debe tener una cantidad mayor a cero';
    end if;
    if v_precio is null or v_precio < 0 then
      raise exception 'Cada línea debe tener un precio válido';
    end if;

    insert into lineas_venta (venta_id, tipo, nombre, producto_id, est, cant, precio, com, com_monto)
    values (
      p_venta_id, v_linea_nueva->>'tipo', v_linea_nueva->>'nombre',
      nullif(v_linea_nueva->>'producto_id', ''), nullif(v_linea_nueva->>'est', ''),
      v_cant, v_precio, coalesce((v_linea_nueva->>'com')::numeric, 0),
      nullif(v_linea_nueva->>'com_monto', '')::numeric
    );

    if v_linea_nueva->>'tipo' = 'producto' and nullif(v_linea_nueva->>'producto_id', '') is not null then
      update productos set stock = stock - v_cant, vendidos = vendidos + v_cant
        where id = v_linea_nueva->>'producto_id';
      get diagnostics v_filas_actualizadas = row_count;
      if v_filas_actualizadas = 0 then
        raise exception 'Producto % no encontrado', v_linea_nueva->>'producto_id';
      end if;

      insert into movimientos (id, fecha, prod, tipo, cant, motivo, ref)
      values (
        'mv' || replace(gen_random_uuid()::text, '-', ''),
        to_char(now(), 'DD Mon · HH24:MI'),
        v_linea_nueva->>'nombre', 'salida', v_cant,
        'Venta · ' || (select ticket from ventas where id = p_venta_id),
        p_venta_id
      );
    end if;
  end loop;

  update ventas set
    cliente_id = nullif(p_cliente_id, ''),
    descuento = coalesce(p_descuento, 0),
    pago = p_pago,
    pagos = case when jsonb_typeof(p_pagos) = 'array' then p_pagos else null end,
    estado = 'pagada',
    saldo_cobrado_en = now(),
    saldo_cobrado_monto = p_saldo_cobrado_monto
  where id = p_venta_id;

  select jsonb_build_object(
    'venta', to_jsonb(v.*),
    'lineas', coalesce((select jsonb_agg(to_jsonb(l.*)) from lineas_venta l where l.venta_id = v.id), '[]'::jsonb)
  ) into v_result
  from ventas v where v.id = p_venta_id;

  return v_result;
end;
$function$;

grant execute on function preview.completar_venta_apartado(text, jsonb, text, numeric, text, jsonb, numeric) to authenticated;
