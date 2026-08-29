# R.A.D.A.R. Cognitive OS — Fase 1 (backend)

Fundação do sistema operacional cognitivo: **Data Fabric + Event Bus + Memória**.
Isolado do painel em produção (`painel-vercel/`) — **nada aqui afeta o app no ar**
até a gente decidir ligar. Infra decidida: **Neon** (Postgres serverless).

## O que já existe aqui

```
backend/
  migrations/001_init.sql   modelo canônico + eventos + memória (schema completo)
  lib/
    db.js                   conexão Neon (driver serverless, via DATABASE_URL)
    auth.js                 reaproveita o login HMAC do app; cronOk p/ o tick
    http.js                 helpers de resposta
    detectors.js            DETECTORES PROATIVOS — código puro, sem LLM (o valor da fase)
  api/
    facts.js                GET  série/valor de uma métrica
    events.js               GET  feed de eventos
    ingest.js               POST entrada de dados (substitui editar o data.js)
    decisions.js            GET/POST  Decision Ledger
    tick.js                 CRON  o laço proativo
  seed/
    migrate.js              aplica as migrações no Neon
    backfill.js             leva os literais do data.js para o banco (idempotente)
  test/detectors.test.js    testes dos detectores — rodam SEM banco
```

## Rodar já, sem banco (prova de que funciona)

```bash
cd backend
node test/detectors.test.js      # 11 testes: o 13º nasce sozinho, desvio, recorrência ausente
```

## Passo 0 → 2 (quando a conta Neon existir)

1. **Criar o projeto no Neon** (neon.tech) e copiar a connection string.
2. Exportar e instalar:
   ```bash
   export DATABASE_URL="postgres://...neon.tech/...?sslmode=require"
   npm install
   ```
3. **Passo 0 — schema + tenants + backfill:**
   ```bash
   npm run migrate     # cria as tabelas
   npm run backfill    # cria as 4 empresas e semeia os fatos da SKAL
   ```
4. **Passo 2 — ligar o painel na base:** `painel-vercel/api/data.js#buildData()` passa a
   ler de `fato`/`evento` com flag `DATA_SOURCE=db|literals` (fallback aos literais).
   Só depois de conferir paridade a chave vira. **Enquanto isso o painel continua idêntico.**
5. **Tick proativo:** configurar `Vercel Cron` chamando `/api/tick` + `CRON_SECRET`.

## Variáveis de ambiente

| Var | Para quê |
|---|---|
| `DATABASE_URL` | conexão Neon (Postgres) |
| `CRON_SECRET` | protege o `/api/tick` (chamado só pelo cron) |
| `RADAR_USERS` / `RADAR_SECRET` | já existem — os endpoints herdam o login atual |

## Convenção canônica

- **Dinheiro em reais cheios** (`unidade_med = 'BRL'`): folha = `124300`, não `124.3`.
  A tela é que divide por mil e formata. O banco nunca mistura "cheio" e "mil".

## Garantias

- **Fonte única:** `UNIQUE(empresa, unidade, metrica, data_ref)` em `fato` — o bug 152×124
  é impossível por construção.
- **Idempotente:** migração, backfill e tick podem rodar de novo sem duplicar.
- **Sem risco ao que está no ar:** este diretório não é servido pela Vercel; o painel
  atual não referencia nada daqui.
- **Detecção sem LLM:** os detectores são código determinístico (§35). O LLM entra
  depois, só para redigir alertas novos, com teto de custo.
