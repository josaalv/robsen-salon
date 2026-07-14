-- Comisión de monto fijo por servicio. Hasta ahora la comisión de cada línea
-- era solo un porcentaje (col `com`). Se agrega `com_monto`: cuando está
-- presente, el empleado gana ese monto fijo por unidad de esa línea, sin
-- importar el precio ni el descuento. Si es null, se usa el porcentaje.
alter table lineas_venta add column if not exists com_monto numeric;

-- El RPC de venta debe persistir com_monto por línea.
create or replace function public.crear_venta_con_lineas(p_venta jsonb, p_lineas jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_linea jsonb;
  v_num_lineas int;
  v_total numeric := 0;
  v_cant int;
  v_precio numeric;
  v_filas_actualizadas int;
  v_result jsonb;
begin
  v_num_lineas := jsonb_array_length(coalesce(p_lineas, '[]'::jsonb));
  if v_num_lineas = 0 then
    raise exception 'Una venta debe tener al menos una línea';
  end if;

  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    v_cant := (v_linea->>'cant')::int;
    v_precio := (v_linea->>'precio')::numeric;
    if v_cant is null or v_cant <= 0 then
      raise exception 'Cada línea debe tener una cantidad mayor a cero';
    end if;
    if v_precio is null or v_precio < 0 then
      raise exception 'Cada línea debe tener un precio válido';
    end if;
    v_total := v_total + v_precio * v_cant;
  end loop;

  if v_total < 0 then
    raise exception 'El total de la venta no puede ser negativo';
  end if;

  insert into ventas (id, ticket, fecha, cliente, cliente_id, pago, estado, descuento, anticipo, cita_id)
  values (
    p_venta->>'id', p_venta->>'ticket', p_venta->>'fecha', p_venta->>'cliente',
    nullif(p_venta->>'cliente_id', ''), p_venta->>'pago', p_venta->>'estado',
    coalesce((p_venta->>'descuento')::numeric, 0), coalesce((p_venta->>'anticipo')::numeric, 0),
    nullif(p_venta->>'cita_id', '')
  );

  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    insert into lineas_venta (venta_id, tipo, nombre, producto_id, est, cant, precio, com, com_monto)
    values (
      p_venta->>'id',
      v_linea->>'tipo',
      v_linea->>'nombre',
      nullif(v_linea->>'producto_id', ''),
      nullif(v_linea->>'est', ''),
      (v_linea->>'cant')::int,
      (v_linea->>'precio')::numeric,
      coalesce((v_linea->>'com')::numeric, 0),
      nullif(v_linea->>'com_monto', '')::numeric
    );

    if v_linea->>'tipo' = 'producto' and nullif(v_linea->>'producto_id', '') is not null then
      update productos
        set stock = stock - (v_linea->>'cant')::int,
            vendidos = vendidos + (v_linea->>'cant')::int
        where id = v_linea->>'producto_id';
      get diagnostics v_filas_actualizadas = row_count;
      if v_filas_actualizadas = 0 then
        raise exception 'Producto % no encontrado', v_linea->>'producto_id';
      end if;

      insert into movimientos (id, fecha, prod, tipo, cant, motivo, ref)
      values (
        'mv' || replace(gen_random_uuid()::text, '-', ''),
        to_char(now(), 'DD Mon · HH24:MI'),
        v_linea->>'nombre',
        'salida',
        (v_linea->>'cant')::int,
        'Venta · ' || (p_venta->>'ticket'),
        p_venta->>'id'
      );
    end if;
  end loop;

  select jsonb_build_object(
    'venta', to_jsonb(v.*),
    'lineas', coalesce((select jsonb_agg(to_jsonb(l.*)) from lineas_venta l where l.venta_id = v.id), '[]'::jsonb)
  ) into v_result
  from ventas v where v.id = p_venta->>'id';

  return v_result;
end;
$$;

grant execute on function public.crear_venta_con_lineas(jsonb, jsonb) to authenticated;
