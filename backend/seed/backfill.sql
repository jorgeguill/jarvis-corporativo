-- R.A.D.A.R. — backfill inicial (versão SQL, para colar no editor do Neon).
-- Idempotente: pode rodar de novo sem duplicar. Roda DEPOIS do 001_init.sql.
-- Valores em REAIS CHEIOS (convenção canônica). Mesmos números do painel.

-- 1) As 4 empresas do grupo
INSERT INTO empresa (codigo, nome) VALUES
  ('SKAL',    'SKAL Engenharia'),
  ('KALFIX',  'KALFIX'),
  ('QUIMIKA', 'QUIMIKA Industrial'),
  ('FCK',     'F.C.K. Ind. e Com. Mat. Construção')
ON CONFLICT (codigo) DO UPDATE SET nome = EXCLUDED.nome;

-- 2) Fonte "seed" (só cria se ainda não existir)
INSERT INTO fonte (tipo, nome)
SELECT 'seed', 'backfill inicial'
WHERE NOT EXISTS (SELECT 1 FROM fonte WHERE tipo = 'seed' AND nome = 'backfill inicial');

-- 3) Fatos confirmados da SKAL (reais cheios)
INSERT INTO fato (empresa_id, metrica, valor, unidade_med, data_ref, fonte_id, confianca)
SELECT e.id, v.metrica, v.valor, 'BRL', v.data_ref::date,
       (SELECT id FROM fonte WHERE tipo = 'seed' AND nome = 'backfill inicial' LIMIT 1), 1
FROM empresa e
CROSS JOIN (VALUES
    ('folha_liquida',      124300, '2026-07-01'),
    ('caixa',              651200, '2026-08-25'),
    ('inadimplencia',      797500, '2026-08-26'),
    ('tributos_estaduais', 263800, '2026-08-17'),
    ('tributos_federais',  213600, '2026-08-31')
  ) AS v(metrica, valor, data_ref)
WHERE e.codigo = 'SKAL'
ON CONFLICT (empresa_id, unidade_id, metrica, data_ref)
DO UPDATE SET valor = EXCLUDED.valor, confianca = EXCLUDED.confianca;

-- 4) Memória inicial
INSERT INTO memoria (empresa_id, tipo, titulo, corpo)
SELECT id, 'conhecimento', 'Backfill inicial do painel',
       'Fatos migrados do data.js para a base. Fonte unica de verdade a partir daqui.'
FROM empresa WHERE codigo = 'SKAL';

-- 5) Conferência (o que você deve ver)
SELECT e.codigo, f.metrica, f.valor, f.unidade_med, f.data_ref
FROM fato f JOIN empresa e ON e.id = f.empresa_id
ORDER BY e.codigo, f.metrica;
