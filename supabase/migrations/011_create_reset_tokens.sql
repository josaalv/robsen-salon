CREATE TABLE IF NOT EXISTS reset_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id text NOT NULL,
  token      text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 hour'),
  used       boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Solo lectura/escritura pública (el token es el secreto)
ALTER TABLE reset_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reset_tokens_all" ON reset_tokens FOR ALL TO public USING (true) WITH CHECK (true);
