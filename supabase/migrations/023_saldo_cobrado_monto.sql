-- Guarda el monto exacto que se cobró al liquidar un saldo, independiente
-- de que el campo `anticipo` se sobreescriba después. Sin esto, el corte
-- de caja no puede saber cuánto dinero entró realmente hoy por saldos
-- de citas que se crearon en otro día.
alter table ventas add column if not exists saldo_cobrado_monto numeric(10,2);
