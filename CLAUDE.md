# CLAUDE.md — memória operacional do JARVIS / R.A.D.A.R.

Repositório do **JARVIS Corporativo de Jorge Ferreira** (SKAL · Grupo Kalfix · Radar
Assessoria Empresarial). Trate o usuário como **Jorge**.

## Persona (regras inegociáveis)

Fonte única da identidade: **[`PROMPT-MESTRE-JARVIS.md`](./PROMPT-MESTRE-JARVIS.md)**. Na prática:

- Respostas diretas, técnicas, de dono, com conclusão e ação recomendada. Sem enrolação.
- **Nunca invente** número/data/saldo/cláusula. Sem base: *"DADO A CONFIRMAR"* + o que falta e de onde vem.
- Separe **Fato / Cálculo / Interpretação / Recomendação**. Duas camadas (decidir + técnica).
- **Não execute** alto impacto (pagamento, crédito, negativação, cadastro fiscal/bancário, RH, preço) sem "ok" do Jorge.
- **Nunca** peça ou exponha senha/token/credencial no chat. Segredos vivem **só** no painel da Vercel (env vars).
- Achou erro: *"Jorge, este ponto apresenta uma inconsistência."* + a correção.

---

## R.A.D.A.R. — o app em produção (o que ficou concreto)

PWA vanilla-JS + funções serverless (Node, sem npm no deploy) que virou um **Business OS
proativo**: percebe (vigia), debate (Conselho de agentes) e recomenda, sobre os dados reais
da SKAL num banco de verdade.

- **Repo:** `jorgeguill/SIGA---AREIA-E-LEO-` (redireciona p/ `jorgeguill/jarvis-corporativo`). Subpasta que a Vercel serve: **`painel-vercel/`**.
- **Vercel:** projeto **`jarvis-radar`**, time **`siga-kalfix`** (`team_GcUWH8OVBZpk4n8dSDgPhhrt`), plano **hobby**. Produção: **`https://jarvis-radar.vercel.app`** (painel em `/m`).
- **Banco:** **Neon** (Postgres serverless) via cliente HTTP artesanal (`api/_neon.js`, sem npm). Tabelas em `backend/migrations/001_init.sql`. `fato` usa **`NULLS NOT DISTINCT`** no UNIQUE (a maioria dos fatos tem `unidade_id` NULL).
- **Fluxo de trabalho:** branch **`claude/jarvis-corporativo-jorge-musja7`** → PR → **squash-merge no `main`** → Vercel faz deploy automático (~1-2 min). Após squash, `force-with-lease` na branch é ok (ela só tinha história já mesclada).

### Endpoints (`painel-vercel/api/`)
| Arquivo | Rota | Função |
|---|---|---|
| `_ai.js` | — (helper) | **Camada única de IA.** Gemini com LISTA de modelos (fallback) + Anthropic. **Único lugar do nome do modelo.** |
| `_auth.js` | — | `authOk` (token HMAC) + `cronOk` (CRON_SECRET Bearer). |
| `_neon.js` | — | Cliente SQL-over-HTTP do Neon. |
| `_vigia.js` | — | `contexto('SKAL')` (situação completa) + `scan()` (achados via IA). |
| `_especialistas.js` | — | Os 12 agentes do Conselho + Challenger + Coordenador. |
| `data.js` | `/api/data` | KPIs/eventos; `overlayFromDB` sobrepõe valores do Neon com fallback total aos literais. |
| `conselho.js` | `/api/conselho?q=` | Conselho multiagente (lotes de 3 + retry). Precisa `authOk`. |
| `tick.js` | `/api/tick` | Cron diário `0 9 * * *`: detectores + vigia. `cronOk`/`authOk`. `maxDuration 60`. |
| `events.js` | `/api/events` | Eventos formatados. |
| `chat.js` | `/api/chat` | Cérebro do chat (já tinha fallback de modelo próprio). |
| `dbcheck.js` | `/api/dbcheck` | Termômetro do banco (público, sem valores). |
| `aicheck.js` | `/api/aicheck` | Termômetro da IA (público): diz qual modelo responde e por que falha. Sem chave. |
| `tts.js`, `login.js` | | Voz / login. |

### O Conselho (design que resolveu o "eco")
12 especialistas em paralelo → Challenger (contraditório) → Coordenador (síntese JSON).
**Princípio central que corrigiu tudo:** cada cadeira **fica na própria função** e traz a
**métrica + o cálculo + o número que só ela produz**. O **macro (Selic/câmbio/setor) é
EXCLUSIVO da cadeira de Mercado** — as outras não repetem, sob pena de serem descartadas
pela Auditoria/Coordenador. Cadeiras: Financeiro(CFO), Controladoria, Cobrança, Comercial,
Suprimentos, Fiscal, RH, Produção, Logística, Jurídico, Permutas&Ativos, Mercado&Estratégia.

### Segredos (env vars — só no painel da Vercel, nunca no chat)
`DATABASE_URL` (Neon), `CRON_SECRET`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY` (fallback).
Opcionais: `GEMINI_MODELS_FLASH`/`GEMINI_MODELS_PRO`, `ANTHROPIC_MODEL_FLASH` (padrão
`claude-sonnet-5`) / `ANTHROPIC_MODEL_PRO` (padrão `claude-opus-5`).

### `backend/` = só REFERÊNCIA (não é deployado)
Guarda o schema (`migrations/001_init.sql`), o seed que o Jorge rodou no Neon
(`seed/backfill.sql`) e os testes (`test/detectors.test.js`). As cópias `backend/api` e
`backend/lib` são **duplicatas mortas** da lógica que hoje vive em `painel-vercel/`.
O detector vivo é `painel-vercel/lib/detectors.js`.

---

## Restrições do ambiente (o que atrapalha — não reaprender)
- **Não alcanço o app daqui:** WebFetch a `jarvis-radar.vercel.app` = EGRESS_BLOCKED. A MCP da
  Vercel **não enxerga** este projeto (hobby) — `list_projects` volta vazio, `web_fetch_vercel_url`
  falha. **Quem testa em produção é o Jorge**, abrindo as URLs. Diagnóstico é via `/api/dbcheck`
  e `/api/aicheck` (ele manda print).
- `git push`/`fetch` por HTTPS **funciona**. GitHub via MCP (`mcp__github__*`) funciona.
- Escrever no Neon a partir daqui é bloqueado → migração/seed roda no **navegador do Jorge** (SQL editor do Neon).

## Dados-âncora da SKAL (valores em uso — confirmar contra ERP)
Faturamento médio ~**R$ 2,9 mi/mês** (meses futuros ainda faturam). Folha líquida ~**R$ 124,3 mil**
+ encargos ~R$ 70 mil; 76 colaboradores (22 produção). Centro de custo Matéria-Prima ~R$ 22,8 mi.
Inadimplência **R$ 797,5 mil** (+90: R$ 640 mil / 81%; 0-90: ~R$ 157 mil). Fiscais: estaduais
~R$ 264 mil, federais ~R$ 214 mil; incentivo ICMS abate ~R$ 383 mil/mês. Forno secou **15.139 t**
vs **17.983 t** consumidas (~15% déficit). Permutas mapeadas ~R$ 3,76 mi. Cimento CP V ~R$ 495/t
(Apodi ~56% das compras); HPMC ~R$ 17/kg. BB Giro ~R$ 400 mil.

---

## Lições / bugs / desperdícios (NÃO repetir)
- **Nome de modelo Gemini caduca.** `gemini-2.5-flash`/`-pro` viraram **404** ("não disponível
  para novos usuários"). Por isso o `_ai.js` tem LISTA de modelos com fallback e é o único lugar
  do nome. Nunca cravar um modelo Gemini solto de novo.
- **Tier gratuito do Gemini estoura** com o Conselho: **429** (cota) e **503** (sobrecarga).
  O Jorge **não tem verba** para cota paga nem `ANTHROPIC_API_KEY` → a solução tem que caber
  no gratuito. **Correção que ficou:** o Conselho não faz mais 1 chamada por agente (eram 14);
  faz um **painel agrupado** — 2 chamadas para os 12 (6 por chamada) + Challenger + Coordenador
  = **~4 chamadas/convocação**, tudo no modelo **flash** (o `pro` gratuito é o que mais dá 429).
  Isso corta cota E desperdício (o contexto ia 12×; agora vai 2×). Não voltar ao padrão de
  1-chamada-por-agente.
- **Falha de IA tem que ser VISÍVEL.** Nunca "(sem resposta)" mudo — mostrar o motivo
  (`⚠️ IA não respondeu (motivo)`) e apontar `/api/aicheck`. Foi assim que achamos os bugs acima.
- **Conselho virava eco:** dar o mesmo contexto macro a todos os agentes faz os 12 repetirem
  Selic/câmbio/cimento. Correção: cada um na sua cadeira, macro só em Mercado (ver acima).
- **Construir às cegas custa caro.** Não dá pra testar o app daqui; toda mudança de runtime
  só se valida com o Jorge abrindo a URL. Preferir **um endpoint de diagnóstico** (dbcheck/aicheck)
  a adivinhar. Menos ciclos de deploy no escuro.
- **Celular corrompe colagem.** Seed manual no Neon pelo celular do Jorge já corrompeu
  `folha_liquida`→`insumo_líquido`. Preferir normalização no código (o `tick.js` renomeia server-side).
- **Não mandar HTML grande inline no deploy** do outro projeto (Painel do Forno) — lá é padrão
  de loaders por SHA; ver o skill `deploy-painel-forno`. (Projeto diferente, não confundir.)
