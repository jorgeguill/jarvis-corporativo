-- R.A.D.A.R. Cognitive OS — Fase 1 · Fundação
-- Migração 001 · modelo canônico (Data Fabric) + Event Bus + Memória
-- Postgres puro (roda no Neon). Idempotente: pode rodar mais de uma vez.
--
-- Regras transversais desde o dia 1:
--   · multiempresa  -> toda tabela de dados carrega empresa_id
--   · observável    -> created_at + trace_id em tudo que é escrito
--   · fonte única   -> cada número de negócio vive UMA vez (ver UNIQUE em fato)

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()

-- ============================================================= DIMENSÕES
CREATE TABLE IF NOT EXISTS empresa (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      text NOT NULL UNIQUE,              -- 'SKAL','KALFIX','QUIMIKA','FCK'
  nome        text NOT NULL,
  ativo       boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS unidade (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL REFERENCES empresa(id),
  codigo      text NOT NULL,                     -- 'MATRIZ','TERESINA',...
  nome        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, codigo)
);

-- Plano de contas / natureza — aqui a classificação custo/despesa e fixo/variável
-- vira DADO (não prompt). Base do forecast recorrente.
CREATE TABLE IF NOT EXISTS conta (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   uuid NOT NULL REFERENCES empresa(id),
  codigo       text,
  nome         text NOT NULL,
  classe       text NOT NULL CHECK (classe IN ('custo','despesa','receita','tributo')),
  comportamento text NOT NULL DEFAULT 'variavel'
                 CHECK (comportamento IN ('fixo','variavel','semi')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, codigo)
);

CREATE TABLE IF NOT EXISTS parceiro (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL REFERENCES empresa(id),
  tipo        text NOT NULL CHECK (tipo IN ('cliente','fornecedor','ambos')),
  nome        text NOT NULL,
  doc         text,                              -- cnpj/cpf
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================= PROVENIÊNCIA
CREATE TABLE IF NOT EXISTS fonte (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo        text NOT NULL CHECK (tipo IN ('firebase','upload','totvs','banco','manual','seed')),
  nome        text NOT NULL,
  config      jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ingestao (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fonte_id     uuid REFERENCES fonte(id),
  empresa_id   uuid REFERENCES empresa(id),
  arquivo      text,
  status       text NOT NULL DEFAULT 'ok' CHECK (status IN ('ok','erro','parcial')),
  linhas       integer DEFAULT 0,
  detalhe      jsonb DEFAULT '{}',
  trace_id     uuid,
  iniciado_em  timestamptz NOT NULL DEFAULT now(),
  concluido_em timestamptz
);

-- ============================================================= FATOS (o coração)
-- O número de negócio vive AQUI, uma única vez. A UNIQUE abaixo é a garantia
-- estrutural contra o bug 152×124 (o mesmo fato divergindo em vários lugares).
-- CONVENÇÃO CANÔNICA: valores monetários em REAIS CHEIOS (unidade_med = 'BRL'),
-- nunca em milhares. A formatação (÷1000, "R$ mil") é responsabilidade da tela.
CREATE TABLE IF NOT EXISTS fato (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL REFERENCES empresa(id),
  unidade_id  uuid REFERENCES unidade(id),
  metrica     text NOT NULL,                     -- 'folha_liquida','caixa','inadimplencia'
  valor       numeric NOT NULL,
  unidade_med text,                              -- 'BRL','BRL_mil','t','%','L/ton'
  data_ref    date NOT NULL,
  fonte_id    uuid REFERENCES fonte(id),
  confianca   numeric NOT NULL DEFAULT 1.0 CHECK (confianca >= 0 AND confianca <= 1),
  detalhe     jsonb NOT NULL DEFAULT '{}',
  trace_id    uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, unidade_id, metrica, data_ref)
);
CREATE INDEX IF NOT EXISTS idx_fato_lookup ON fato (empresa_id, metrica, data_ref DESC);

-- Contas a pagar / a receber (linhas). recorrencia_id liga o que se repete mês a mês.
CREATE TABLE IF NOT EXISTS lancamento (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid NOT NULL REFERENCES empresa(id),
  unidade_id    uuid REFERENCES unidade(id),
  tipo          text NOT NULL CHECK (tipo IN ('a_pagar','a_receber')),
  parceiro_id   uuid REFERENCES parceiro(id),
  conta_id      uuid REFERENCES conta(id),
  valor         numeric NOT NULL,
  vencimento    date,
  previsao_baixa date,
  status        text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','baixado','cancelado')),
  doc_ref       text,
  recorrencia_id uuid,                           -- agrupa a mesma despesa recorrente
  origem        text,
  fonte_id      uuid REFERENCES fonte(id),
  trace_id      uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lanc_venc ON lancamento (empresa_id, tipo, vencimento);
CREATE INDEX IF NOT EXISTS idx_lanc_recorr ON lancamento (empresa_id, recorrencia_id);

-- ============================================================= EVENT BUS
-- O sistema nervoso. Todo fato relevante vira um evento tipado (§4).
CREATE TABLE IF NOT EXISTS evento (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo         text NOT NULL,                    -- FATO_ATUALIZADO, COMPROMISSO_FUTURO_DETECTADO,...
  origem       text NOT NULL,                    -- 'tick/detector-recorrencia'
  empresa_id   uuid REFERENCES empresa(id),
  unidade_id   uuid REFERENCES unidade(id),
  entidade_tipo text,                            -- 'conta','fato','lancamento'
  entidade_id  text,
  severidade   smallint NOT NULL DEFAULT 1 CHECK (severidade BETWEEN 1 AND 5),
  valor        numeric,
  contexto     jsonb NOT NULL DEFAULT '{}',
  evidencia    jsonb NOT NULL DEFAULT '{}',
  chave_dedupe text,                             -- evita reemitir o mesmo alerta
  processado_em timestamptz,
  trace_id     uuid,
  ts           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_evento_feed ON evento (empresa_id, ts DESC);
-- não reemitir o mesmo evento lógico (mesma chave) — o tick é idempotente
CREATE UNIQUE INDEX IF NOT EXISTS uq_evento_dedupe
  ON evento (empresa_id, tipo, chave_dedupe) WHERE chave_dedupe IS NOT NULL;

-- ============================================================= MEMÓRIA
-- Corporate Memory (§7): o que o sistema sabe e descobre, com referências.
CREATE TABLE IF NOT EXISTS memoria (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid REFERENCES empresa(id),
  tipo        text NOT NULL CHECK (tipo IN ('evento','problema','investigacao','decisao','licao','conhecimento')),
  titulo      text NOT NULL,
  corpo       text,
  refs        jsonb NOT NULL DEFAULT '{}',       -- {fato:[...], evento:[...]}
  trace_id    uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_memoria_emp ON memoria (empresa_id, created_at DESC);

-- Decision Ledger (§8): append-only. Recomendação/evidência na F1; resultado real na F4.
CREATE TABLE IF NOT EXISTS decisao (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        uuid REFERENCES empresa(id),
  problema          text NOT NULL,
  objetivo          text,
  contexto          jsonb DEFAULT '{}',
  indicadores       jsonb DEFAULT '{}',
  hipoteses         jsonb DEFAULT '{}',
  evidencias        jsonb DEFAULT '{}',
  alternativas      jsonb DEFAULT '{}',
  riscos            jsonb DEFAULT '{}',
  impacto_financeiro numeric,
  recomendacao      text,
  confianca         numeric CHECK (confianca IS NULL OR (confianca >= 0 AND confianca <= 1)),
  responsavel       text,
  aprovacao         text NOT NULL DEFAULT 'pendente'
                      CHECK (aprovacao IN ('pendente','aprovada','rejeitada','n/a')),
  acao_definida     text,
  resultado_esperado text,
  resultado_real    text,                        -- preenchido na F4
  desvio            text,
  licao             text,
  status            text NOT NULL DEFAULT 'aberta'
                      CHECK (status IN ('aberta','decidida','executada','encerrada')),
  trace_id          uuid,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_decisao_emp ON decisao (empresa_id, created_at DESC);

-- Ação (§21): schema criado na F1; ciclo de vida completo na F4.
CREATE TABLE IF NOT EXISTS acao (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decisao_id   uuid REFERENCES decisao(id),
  empresa_id   uuid REFERENCES empresa(id),
  descricao    text NOT NULL,
  responsavel  text,
  prazo        date,
  prioridade   smallint DEFAULT 3,
  kpi          text,
  status       text NOT NULL DEFAULT 'pendente'
                 CHECK (status IN ('pendente','em_andamento','concluida','cancelada')),
  evidencia    jsonb DEFAULT '{}',
  resultado    text,
  trace_id     uuid,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Situação (§5): stub na F1 (o tick grava alertas leves aqui); engine de
-- correlação completa é F2.
CREATE TABLE IF NOT EXISTS situacao (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   uuid REFERENCES empresa(id),
  titulo       text NOT NULL,
  descricao    text,
  severidade   smallint NOT NULL DEFAULT 1 CHECK (severidade BETWEEN 1 AND 5),
  urgencia     text DEFAULT 'media',
  confianca    numeric DEFAULT 1.0,
  eventos_ref  jsonb DEFAULT '[]',
  status       text NOT NULL DEFAULT 'aberta'
                 CHECK (status IN ('aberta','monitorando','resolvida')),
  chave_dedupe text,
  trace_id     uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_situacao_dedupe
  ON situacao (empresa_id, chave_dedupe) WHERE chave_dedupe IS NOT NULL;
