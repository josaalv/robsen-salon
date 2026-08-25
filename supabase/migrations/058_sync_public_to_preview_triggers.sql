-- Sincroniza en tiempo real: público (producción) → preview (aislado).
-- Un solo sentido, automático, sin aprobación — es la "operación rutinaria
-- del negocio" reflejándose en el entorno de pruebas, no un cambio de
-- código. Regla no negociable: un fallo replicando a preview JAMÁS debe
-- afectar la escritura real en producción — cada función atrapa cualquier
-- excepción, la deja como advertencia en los logs, y deja pasar la
-- operación original sin tocarla.
--
-- SECURITY DEFINER: corre con los privilegios del dueño de la función
-- (bypassa RLS de 'preview'), para que la réplica no dependa de que el rol
-- que hizo la escritura real también cumpla las políticas de 'preview'.

-- ============ config ============
create or replace function public.fn_sync_preview_config()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from preview.config where id = old.id;
    return old;
  end if;
  insert into preview.config (id, agenda_start, agenda_end, slot_min, dias_abiertos, nombre, direccion, tel, whatsapp, anticipo_pct, requerir_anticipo, iva, metodospago, acento, comisiones, escala_comisiones, notifs, logo, permisos)
  values (new.id, new.agenda_start, new.agenda_end, new.slot_min, new.dias_abiertos, new.nombre, new.direccion, new.tel, new.whatsapp, new.anticipo_pct, new.requerir_anticipo, new.iva, new.metodospago, new.acento, new.comisiones, new.escala_comisiones, new.notifs, new.logo, new.permisos)
  on conflict (id) do update set
    agenda_start=excluded.agenda_start, agenda_end=excluded.agenda_end, slot_min=excluded.slot_min,
    dias_abiertos=excluded.dias_abiertos, nombre=excluded.nombre, direccion=excluded.direccion,
    tel=excluded.tel, whatsapp=excluded.whatsapp, anticipo_pct=excluded.anticipo_pct,
    requerir_anticipo=excluded.requerir_anticipo, iva=excluded.iva, metodospago=excluded.metodospago,
    acento=excluded.acento, comisiones=excluded.comisiones, escala_comisiones=excluded.escala_comisiones,
    notifs=excluded.notifs, logo=excluded.logo, permisos=excluded.permisos;
  return new;
exception when others then
  raise warning 'fn_sync_preview_config: % id=%: %', tg_op, coalesce(new.id, old.id), sqlerrm;
  return coalesce(new, old);
end;
$$;
drop trigger if exists trg_sync_preview on config;
create trigger trg_sync_preview after insert or update or delete on config
  for each row execute function public.fn_sync_preview_config();

-- ============ estilistas ============
create or replace function public.fn_sync_preview_estilistas()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from preview.estilistas where id = old.id;
    return old;
  end if;
  insert into preview.estilistas (id, nombre, rol, color, ini, com, horarios, foto, bio, comisiones)
  values (new.id, new.nombre, new.rol, new.color, new.ini, new.com, new.horarios, new.foto, new.bio, new.comisiones)
  on conflict (id) do update set
    nombre=excluded.nombre, rol=excluded.rol, color=excluded.color, ini=excluded.ini, com=excluded.com,
    horarios=excluded.horarios, foto=excluded.foto, bio=excluded.bio, comisiones=excluded.comisiones;
  return new;
exception when others then
  raise warning 'fn_sync_preview_estilistas: % id=%: %', tg_op, coalesce(new.id, old.id), sqlerrm;
  return coalesce(new, old);
end;
$$;
drop trigger if exists trg_sync_preview on estilistas;
create trigger trg_sync_preview after insert or update or delete on estilistas
  for each row execute function public.fn_sync_preview_estilistas();

-- ============ servicios ============
create or replace function public.fn_sync_preview_servicios()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from preview.servicios where id = old.id;
    return old;
  end if;
  insert into preview.servicios (id, nombre, cat, precio, dur, anticipo, online, prof, descripcion, precio_visible, precio_variable, domicilio, activo)
  values (new.id, new.nombre, new.cat, new.precio, new.dur, new.anticipo, new.online, new.prof, new.descripcion, new.precio_visible, new.precio_variable, new.domicilio, new.activo)
  on conflict (id) do update set
    nombre=excluded.nombre, cat=excluded.cat, precio=excluded.precio, dur=excluded.dur,
    anticipo=excluded.anticipo, online=excluded.online, prof=excluded.prof, descripcion=excluded.descripcion,
    precio_visible=excluded.precio_visible, precio_variable=excluded.precio_variable,
    domicilio=excluded.domicilio, activo=excluded.activo;
  return new;
exception when others then
  raise warning 'fn_sync_preview_servicios: % id=%: %', tg_op, coalesce(new.id, old.id), sqlerrm;
  return coalesce(new, old);
end;
$$;
drop trigger if exists trg_sync_preview on servicios;
create trigger trg_sync_preview after insert or update or delete on servicios
  for each row execute function public.fn_sync_preview_servicios();

-- ============ productos ============
create or replace function public.fn_sync_preview_productos()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from preview.productos where id = old.id;
    return old;
  end if;
  insert into preview.productos (id, sku, nombre, marca, cat, uso, costo, precio, stock, min, vendidos, "comValor", "comTipo", foto, notas, proveedor)
  values (new.id, new.sku, new.nombre, new.marca, new.cat, new.uso, new.costo, new.precio, new.stock, new.min, new.vendidos, new."comValor", new."comTipo", new.foto, new.notas, new.proveedor)
  on conflict (id) do update set
    sku=excluded.sku, nombre=excluded.nombre, marca=excluded.marca, cat=excluded.cat, uso=excluded.uso,
    costo=excluded.costo, precio=excluded.precio, stock=excluded.stock, min=excluded.min,
    vendidos=excluded.vendidos, "comValor"=excluded."comValor", "comTipo"=excluded."comTipo",
    foto=excluded.foto, notas=excluded.notas, proveedor=excluded.proveedor;
  return new;
exception when others then
  raise warning 'fn_sync_preview_productos: % id=%: %', tg_op, coalesce(new.id, old.id), sqlerrm;
  return coalesce(new, old);
end;
$$;
drop trigger if exists trg_sync_preview on productos;
create trigger trg_sync_preview after insert or update or delete on productos
  for each row execute function public.fn_sync_preview_productos();

-- ============ usuarios ============
create or replace function public.fn_sync_preview_usuarios()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from preview.usuarios where id = old.id;
    return old;
  end if;
  insert into preview.usuarios (id, nombre, rol, ini, color, email, tel, activo, ultimo, avatar, auth_user_id, estilista_id)
  values (new.id, new.nombre, new.rol, new.ini, new.color, new.email, new.tel, new.activo, new.ultimo, new.avatar, new.auth_user_id, new.estilista_id)
  on conflict (id) do update set
    nombre=excluded.nombre, rol=excluded.rol, ini=excluded.ini, color=excluded.color, email=excluded.email,
    tel=excluded.tel, activo=excluded.activo, ultimo=excluded.ultimo, avatar=excluded.avatar,
    auth_user_id=excluded.auth_user_id, estilista_id=excluded.estilista_id;
  return new;
exception when others then
  raise warning 'fn_sync_preview_usuarios: % id=%: %', tg_op, coalesce(new.id, old.id), sqlerrm;
  return coalesce(new, old);
end;
$$;
drop trigger if exists trg_sync_preview on usuarios;
create trigger trg_sync_preview after insert or update or delete on usuarios
  for each row execute function public.fn_sync_preview_usuarios();

-- ============ clientas ============
create or replace function public.fn_sync_preview_clientas()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from preview.clientas where id = old.id;
    return old;
  end if;
  insert into preview.clientas (id, nombre, tel, estado, ultima, ticket, fav, est, visitas, gasto, ini, cumple, ciclo, notas, formulas, email, fotos)
  values (new.id, new.nombre, new.tel, new.estado, new.ultima, new.ticket, new.fav, new.est, new.visitas, new.gasto, new.ini, new.cumple, new.ciclo, new.notas, new.formulas, new.email, new.fotos)
  on conflict (id) do update set
    nombre=excluded.nombre, tel=excluded.tel, estado=excluded.estado, ultima=excluded.ultima,
    ticket=excluded.ticket, fav=excluded.fav, est=excluded.est, visitas=excluded.visitas,
    gasto=excluded.gasto, ini=excluded.ini, cumple=excluded.cumple, ciclo=excluded.ciclo,
    notas=excluded.notas, formulas=excluded.formulas, email=excluded.email, fotos=excluded.fotos;
  return new;
exception when others then
  raise warning 'fn_sync_preview_clientas: % id=%: %', tg_op, coalesce(new.id, old.id), sqlerrm;
  return coalesce(new, old);
end;
$$;
drop trigger if exists trg_sync_preview on clientas;
create trigger trg_sync_preview after insert or update or delete on clientas
  for each row execute function public.fn_sync_preview_clientas();

-- ============ bloqueos ============
create or replace function public.fn_sync_preview_bloqueos()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from preview.bloqueos where id = old.id;
    return old;
  end if;
  insert into preview.bloqueos (id, est, h, fin, nota, fecha)
  values (new.id, new.est, new.h, new.fin, new.nota, new.fecha)
  on conflict (id) do update set
    est=excluded.est, h=excluded.h, fin=excluded.fin, nota=excluded.nota, fecha=excluded.fecha;
  return new;
exception when others then
  raise warning 'fn_sync_preview_bloqueos: % id=%: %', tg_op, coalesce(new.id, old.id), sqlerrm;
  return coalesce(new, old);
end;
$$;
drop trigger if exists trg_sync_preview on bloqueos;
create trigger trg_sync_preview after insert or update or delete on bloqueos
  for each row execute function public.fn_sync_preview_bloqueos();

-- ============ gastos ============
create or replace function public.fn_sync_preview_gastos()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from preview.gastos where id = old.id;
    return old;
  end if;
  insert into preview.gastos (id, concepto, monto, fecha, categoria)
  values (new.id, new.concepto, new.monto, new.fecha, new.categoria)
  on conflict (id) do update set
    concepto=excluded.concepto, monto=excluded.monto, fecha=excluded.fecha, categoria=excluded.categoria;
  return new;
exception when others then
  raise warning 'fn_sync_preview_gastos: % id=%: %', tg_op, coalesce(new.id, old.id), sqlerrm;
  return coalesce(new, old);
end;
$$;
drop trigger if exists trg_sync_preview on gastos;
create trigger trg_sync_preview after insert or update or delete on gastos
  for each row execute function public.fn_sync_preview_gastos();

-- ============ citas ============
create or replace function public.fn_sync_preview_citas()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from preview.citas where id = old.id;
    return old;
  end if;
  insert into preview.citas (id, h, dur, cl, cliente_id, tel, email, srv, servicio_id, est, estado, total, ant, notas, fecha, servicios)
  values (new.id, new.h, new.dur, new.cl, new.cliente_id, new.tel, new.email, new.srv, new.servicio_id, new.est, new.estado, new.total, new.ant, new.notas, new.fecha, new.servicios)
  on conflict (id) do update set
    h=excluded.h, dur=excluded.dur, cl=excluded.cl, cliente_id=excluded.cliente_id, tel=excluded.tel,
    email=excluded.email, srv=excluded.srv, servicio_id=excluded.servicio_id, est=excluded.est,
    estado=excluded.estado, total=excluded.total, ant=excluded.ant, notas=excluded.notas,
    fecha=excluded.fecha, servicios=excluded.servicios;
  return new;
exception when others then
  raise warning 'fn_sync_preview_citas: % id=%: %', tg_op, coalesce(new.id, old.id), sqlerrm;
  return coalesce(new, old);
end;
$$;
drop trigger if exists trg_sync_preview on citas;
create trigger trg_sync_preview after insert or update or delete on citas
  for each row execute function public.fn_sync_preview_citas();

-- ============ ventas ============
create or replace function public.fn_sync_preview_ventas()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from preview.ventas where id = old.id;
    return old;
  end if;
  insert into preview.ventas (id, ticket, fecha, cliente, cliente_id, pago, estado, descuento, anticipo, cita_id, saldo_cobrado_en, saldo_cobrado_monto, created_at, pagos)
  values (new.id, new.ticket, new.fecha, new.cliente, new.cliente_id, new.pago, new.estado, new.descuento, new.anticipo, new.cita_id, new.saldo_cobrado_en, new.saldo_cobrado_monto, new.created_at, new.pagos)
  on conflict (id) do update set
    ticket=excluded.ticket, fecha=excluded.fecha, cliente=excluded.cliente, cliente_id=excluded.cliente_id,
    pago=excluded.pago, estado=excluded.estado, descuento=excluded.descuento, anticipo=excluded.anticipo,
    cita_id=excluded.cita_id, saldo_cobrado_en=excluded.saldo_cobrado_en,
    saldo_cobrado_monto=excluded.saldo_cobrado_monto, created_at=excluded.created_at, pagos=excluded.pagos;
  return new;
exception when others then
  raise warning 'fn_sync_preview_ventas: % id=%: %', tg_op, coalesce(new.id, old.id), sqlerrm;
  return coalesce(new, old);
end;
$$;
drop trigger if exists trg_sync_preview on ventas;
create trigger trg_sync_preview after insert or update or delete on ventas
  for each row execute function public.fn_sync_preview_ventas();

-- ============ lineas_venta ============
create or replace function public.fn_sync_preview_lineas_venta()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from preview.lineas_venta where id = old.id;
    return old;
  end if;
  insert into preview.lineas_venta (id, venta_id, tipo, nombre, est, cant, precio, com, producto_id, com_monto)
  values (new.id, new.venta_id, new.tipo, new.nombre, new.est, new.cant, new.precio, new.com, new.producto_id, new.com_monto)
  on conflict (id) do update set
    venta_id=excluded.venta_id, tipo=excluded.tipo, nombre=excluded.nombre, est=excluded.est,
    cant=excluded.cant, precio=excluded.precio, com=excluded.com, producto_id=excluded.producto_id,
    com_monto=excluded.com_monto;
  return new;
exception when others then
  raise warning 'fn_sync_preview_lineas_venta: % id=%: %', tg_op, coalesce(new.id, old.id), sqlerrm;
  return coalesce(new, old);
end;
$$;
drop trigger if exists trg_sync_preview on lineas_venta;
create trigger trg_sync_preview after insert or update or delete on lineas_venta
  for each row execute function public.fn_sync_preview_lineas_venta();

-- ============ cierres_caja ============
create or replace function public.fn_sync_preview_cierres_caja()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from preview.cierres_caja where id = old.id;
    return old;
  end if;
  insert into preview.cierres_caja (id, fecha, usuario_id, usuario_nombre, total_efectivo, total_transferencia, total_tarjeta, total_pendiente, anticipos_cobrados, saldos_cobrados, ventas_total, efectivo_contado, diferencia, notas, cerrado_en)
  values (new.id, new.fecha, new.usuario_id, new.usuario_nombre, new.total_efectivo, new.total_transferencia, new.total_tarjeta, new.total_pendiente, new.anticipos_cobrados, new.saldos_cobrados, new.ventas_total, new.efectivo_contado, new.diferencia, new.notas, new.cerrado_en)
  on conflict (id) do update set
    fecha=excluded.fecha, usuario_id=excluded.usuario_id, usuario_nombre=excluded.usuario_nombre,
    total_efectivo=excluded.total_efectivo, total_transferencia=excluded.total_transferencia,
    total_tarjeta=excluded.total_tarjeta, total_pendiente=excluded.total_pendiente,
    anticipos_cobrados=excluded.anticipos_cobrados, saldos_cobrados=excluded.saldos_cobrados,
    ventas_total=excluded.ventas_total, efectivo_contado=excluded.efectivo_contado,
    diferencia=excluded.diferencia, notas=excluded.notas, cerrado_en=excluded.cerrado_en;
  return new;
exception when others then
  raise warning 'fn_sync_preview_cierres_caja: % id=%: %', tg_op, coalesce(new.id, old.id), sqlerrm;
  return coalesce(new, old);
end;
$$;
drop trigger if exists trg_sync_preview on cierres_caja;
create trigger trg_sync_preview after insert or update or delete on cierres_caja
  for each row execute function public.fn_sync_preview_cierres_caja();

-- Funciones de trigger, nunca deben invocarse directo vía RPC (mismo
-- criterio ya aplicado a fn_audit_log en 024_endurecer_funciones.sql).
-- Postgres ya rechaza invocarlas fuera de un trigger — esto es limpieza
-- del advisor de seguridad (quedaban expuestas como RPC por PostgREST).
revoke execute on function public.fn_sync_preview_config() from public, anon, authenticated;
revoke execute on function public.fn_sync_preview_estilistas() from public, anon, authenticated;
revoke execute on function public.fn_sync_preview_servicios() from public, anon, authenticated;
revoke execute on function public.fn_sync_preview_productos() from public, anon, authenticated;
revoke execute on function public.fn_sync_preview_usuarios() from public, anon, authenticated;
revoke execute on function public.fn_sync_preview_clientas() from public, anon, authenticated;
revoke execute on function public.fn_sync_preview_bloqueos() from public, anon, authenticated;
revoke execute on function public.fn_sync_preview_gastos() from public, anon, authenticated;
revoke execute on function public.fn_sync_preview_citas() from public, anon, authenticated;
revoke execute on function public.fn_sync_preview_ventas() from public, anon, authenticated;
revoke execute on function public.fn_sync_preview_lineas_venta() from public, anon, authenticated;
revoke execute on function public.fn_sync_preview_cierres_caja() from public, anon, authenticated;
