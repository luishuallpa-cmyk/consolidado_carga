-- Rutas de entrega del día (desde liquidación / cobranza)
-- Los vendedores consultan solo su vendedor_codigo

CREATE TABLE IF NOT EXISTS public.rutas_entrega (
  id bigserial PRIMARY KEY,
  fecha date NOT NULL,
  vendedor_codigo text NOT NULL,
  camion text,
  placa text,
  cliente_codigo text NOT NULL,
  cliente_nombre text,
  direccion text,
  latitud double precision,
  longitud double precision,
  num_cp text,
  saldo numeric,
  consolidado text,
  actualizado_en timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rutas_fecha_vend
  ON public.rutas_entrega (fecha, vendedor_codigo);

CREATE INDEX IF NOT EXISTS idx_rutas_geo
  ON public.rutas_entrega (latitud, longitud)
  WHERE latitud IS NOT NULL;

ALTER TABLE public.rutas_entrega ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rutas_select_auth" ON public.rutas_entrega;
CREATE POLICY "rutas_select_auth" ON public.rutas_entrega
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "rutas_write_auth" ON public.rutas_entrega;
CREATE POLICY "rutas_write_auth" ON public.rutas_entrega
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE public.rutas_entrega IS
  'Paradas del reparto (Excel liquidación) con GPS del catálogo de clientes';
