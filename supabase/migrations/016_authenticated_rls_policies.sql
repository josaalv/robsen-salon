-- Políticas reales por rol para `authenticated` (Supabase Auth).
-- Aditivo: la política anon_all existente NO se toca aquí todavía.
-- Se retira en una migración posterior, una vez verificado que el
-- nuevo frontend con Supabase Auth funciona en producción.

-- ============ USUARIOS ============
create policy "usuarios_select_self_or_gestion" on usuarios for select to authenticated
  using (auth_user_id = auth.uid() or public.current_rol() in ('admin','gerente'));

create policy "usuarios_update_self" on usuarios for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

create policy "usuarios_admin_write" on usuarios for all to authenticated
  using (public.current_rol() = 'admin')
  with check (public.current_rol() = 'admin');

-- ============ CLIENTAS ============
create policy "clientas_select" on clientas for select to authenticated
  using (
    public.current_rol() in ('admin','gerente','recepcion')
    or (public.current_rol() = 'estilista' and id in (
      select cliente_id from citas where est = public.current_estilista_id() and cliente_id is not null
    ))
  );

create policy "clientas_write_gestion" on clientas for all to authenticated
  using (public.current_rol() in ('admin','gerente','recepcion'))
  with check (public.current_rol() in ('admin','gerente','recepcion'));

-- ============ CITAS ============
create policy "citas_select" on citas for select to authenticated
  using (
    public.current_rol() in ('admin','gerente','recepcion')
    or (public.current_rol() = 'estilista' and est = public.current_estilista_id())
  );

create policy "citas_write_gestion" on citas for all to authenticated
  using (public.current_rol() in ('admin','gerente','recepcion'))
  with check (public.current_rol() in ('admin','gerente','recepcion'));

create policy "citas_update_propia_estilista" on citas for update to authenticated
  using (public.current_rol() = 'estilista' and est = public.current_estilista_id())
  with check (public.current_rol() = 'estilista' and est = public.current_estilista_id());

-- ============ VENTAS ============
create policy "ventas_select" on ventas for select to authenticated
  using (
    public.current_rol() in ('admin','gerente','recepcion')
    or (public.current_rol() = 'estilista' and exists (
      select 1 from lineas_venta lv where lv.venta_id = ventas.id and lv.est = public.current_estilista_id()
    ))
  );

create policy "ventas_write_gestion" on ventas for all to authenticated
  using (public.current_rol() in ('admin','gerente','recepcion'))
  with check (public.current_rol() in ('admin','gerente','recepcion'));

create policy "ventas_insert_estilista" on ventas for insert to authenticated
  with check (public.current_rol() = 'estilista');

-- Sin política de delete para estilista: queda bloqueado por defecto (deny-by-default).

-- ============ LINEAS_VENTA ============
create policy "lineas_venta_select" on lineas_venta for select to authenticated
  using (
    public.current_rol() in ('admin','gerente','recepcion')
    or (public.current_rol() = 'estilista' and est = public.current_estilista_id())
  );

create policy "lineas_venta_write_gestion" on lineas_venta for all to authenticated
  using (public.current_rol() in ('admin','gerente','recepcion'))
  with check (public.current_rol() in ('admin','gerente','recepcion'));

create policy "lineas_venta_insert_estilista" on lineas_venta for insert to authenticated
  with check (public.current_rol() = 'estilista' and (est = public.current_estilista_id() or est is null));

-- ============ SERVICIOS ============
create policy "servicios_select_authenticated" on servicios for select to authenticated
  using (public.is_active());

create policy "servicios_write_admin_gerente" on servicios for all to authenticated
  using (public.current_rol() in ('admin','gerente'))
  with check (public.current_rol() in ('admin','gerente'));

-- ============ PRODUCTOS ============
create policy "productos_select_authenticated" on productos for select to authenticated
  using (public.is_active());

create policy "productos_write_admin_gerente" on productos for all to authenticated
  using (public.current_rol() in ('admin','gerente'))
  with check (public.current_rol() in ('admin','gerente'));

-- recepcion/estilista solo pueden mover stock/vendidos (POS), nunca precio/costo.
create policy "productos_update_stock_operativo" on productos for update to authenticated
  using (public.current_rol() in ('recepcion','estilista'))
  with check (
    public.current_rol() in ('recepcion','estilista')
    and precio = (select p2.precio from productos p2 where p2.id = productos.id)
    and costo  = (select p2.costo  from productos p2 where p2.id = productos.id)
  );

-- ============ ESTILISTAS ============
create policy "estilistas_select_authenticated" on estilistas for select to authenticated
  using (public.is_active());

create policy "estilistas_write_admin_gerente" on estilistas for all to authenticated
  using (public.current_rol() in ('admin','gerente'))
  with check (public.current_rol() in ('admin','gerente'));

-- ============ CONFIG ============
create policy "config_select_authenticated" on config for select to authenticated
  using (public.is_active());

create policy "config_write_admin_gerente" on config for all to authenticated
  using (public.current_rol() in ('admin','gerente'))
  with check (public.current_rol() in ('admin','gerente'));

-- ============ BLOQUEOS ============
create policy "bloqueos_select_authenticated" on bloqueos for select to authenticated
  using (public.is_active());

create policy "bloqueos_write_gestion" on bloqueos for all to authenticated
  using (public.current_rol() in ('admin','gerente','recepcion'))
  with check (public.current_rol() in ('admin','gerente','recepcion'));

create policy "bloqueos_write_propio_estilista" on bloqueos for all to authenticated
  using (public.current_rol() = 'estilista' and est = public.current_estilista_id())
  with check (public.current_rol() = 'estilista' and est = public.current_estilista_id());

-- ============ GASTOS ============
create policy "gastos_admin_gerente" on gastos for all to authenticated
  using (public.current_rol() in ('admin','gerente'))
  with check (public.current_rol() in ('admin','gerente'));

-- ============ MOVIMIENTOS ============
create policy "movimientos_select" on movimientos for select to authenticated
  using (public.current_rol() in ('admin','gerente','recepcion'));

create policy "movimientos_insert" on movimientos for insert to authenticated
  with check (public.current_rol() in ('admin','gerente','recepcion','estilista'));

-- ============ PLANTILLAS ============
create policy "plantillas_select_authenticated" on plantillas for select to authenticated
  using (public.is_active());

create policy "plantillas_write_gestion" on plantillas for all to authenticated
  using (public.current_rol() in ('admin','gerente','recepcion'))
  with check (public.current_rol() in ('admin','gerente','recepcion'));
