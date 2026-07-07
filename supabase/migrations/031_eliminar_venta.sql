-- Borrado transaccional de una venta. Al crear una venta con productos se
-- descuenta el stock, se incrementa `vendidos` y se registra un movimiento de
-- salida (ver crear_venta_con_lineas). Borrar la venta debe revertir todo eso,
-- si no el inventario queda corrupto. Se hace en una sola transacción; si algo
-- falla, no se borra nada.
create or replace function public.eliminar_venta(p_venta_id text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_linea record;
  v_ticket text;
begin
  select ticket into v_ticket from ventas where id = p_venta_id;
  if v_ticket is null then
    raise exception 'Venta % no encontrada', p_venta_id;
  end if;

  -- Reponer el stock de cada producto vendido y registrar el movimiento inverso.
  for v_linea in
    select producto_id, nombre, cant
    from lineas_venta
    where venta_id = p_venta_id and tipo = 'producto' and producto_id is not null
  loop
    update productos
      set stock = stock + v_linea.cant,
          vendidos = greatest(0, vendidos - v_linea.cant)
      where id = v_linea.producto_id;

    insert into movimientos (id, fecha, prod, tipo, cant, motivo, ref)
    values (
      'mv' || replace(gen_random_uuid()::text, '-', ''),
      to_char(now(), 'DD Mon · HH24:MI'),
      v_linea.nombre, 'entrada', v_linea.cant,
      'Cancelación · ' || v_ticket, p_venta_id
    );
  end loop;

  -- lineas_venta cae por ON DELETE CASCADE.
  delete from ventas where id = p_venta_id;
end;
$$;

grant execute on function public.eliminar_venta(text) to authenticated;
