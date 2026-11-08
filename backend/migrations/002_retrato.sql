-- R.A.D.A.R. — Migração 002 · Retratos de importação (página /import)
-- Objetivo: deixar o Jorge atualizar os dados sozinho (sem código, sem merge),
-- subindo o Excel/CSV do TOTVS/banco na página /import, que grava AQUI.
-- Postgres puro (roda no Neon). Idempotente: pode rodar mais de uma vez.
--
-- Fluxo: /import (navegador do Jorge) -> POST /api/import -> grava:
--   (1) KPIs monetários em `fato` (metrica canônica, unidade_med='BRL',
--       valor em REAIS CHEIOS) — é o que o painel sobrepõe via overlayFromDB
--       quando DATA_SOURCE='neon'.
--   (2) o retrato completo (aging, cronograma, quebras) em `retrato.payload`.
-- Re-subir o mesmo tipo/data SUBSTITUI (não duplica) — ver UNIQUE abaixo.

-- Garante as empresas-âncora (o /api/import também faz upsert, isto é só rede de segurança).
INSERT INTO empresa (codigo, nome) VALUES
  ('SKAL','SKAL Engenharia'),
  ('KALFIX','Kalfix'),
  ('QUIMIKA','Quimika'),
  ('FCK','FCK')
ON CONFLICT (codigo) DO NOTHING;

-- Retrato = uma foto datada de um relatório (inadimplencia, caixa, carteira, folha).
-- O painel lê o retrato MAIS RECENTE de cada tipo; o histórico fica para tendência.
CREATE TABLE IF NOT EXISTS retrato (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL REFERENCES empresa(id),
  tipo        text NOT NULL,                 -- 'inadimplencia','caixa','carteira','folha'
  data_ref    date NOT NULL,                 -- a data do RETRATO (não a de importação)
  payload     jsonb NOT NULL DEFAULT '{}',   -- total + quebras (aging, cronograma, bancos, devedores)
  fonte       text,                          -- nome do arquivo enviado
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- re-subir o mesmo tipo no mesmo dia substitui o retrato daquele dia
  UNIQUE (empresa_id, tipo, data_ref)
);
CREATE INDEX IF NOT EXISTS idx_retrato_latest ON retrato (empresa_id, tipo, data_ref DESC);
