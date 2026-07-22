# JARVIS Corporativo — Jorge Ferreira

Repositório **exclusivo** da configuração do **JARVIS**, o assistente executivo,
financeiro, administrativo e estratégico de **Jorge Ferreira** —
**SKAL · Grupo Kalfix · Radar Assessoria Empresarial**.

> Uso interno e confidencial. Nenhuma decisão de alto impacto é executada sem
> validação humana; nenhuma credencial ou senha é solicitada ou armazenada em texto aberto.

## Estrutura

| Caminho | Função |
|---|---|
| [`PROMPT-MESTRE-JARVIS.md`](./PROMPT-MESTRE-JARVIS.md) | **Prompt mestre** — identidade, princípios, os 14 módulos funcionais, integrações, memória corporativa, rotinas, alertas, padrões (análise/relatório/planilha/documento), governança e ordem de implantação. Fonte única da configuração. |
| [`CLAUDE.md`](./CLAUDE.md) | Instrução de persona — faz o Claude assumir o JARVIS ao operar neste repositório. |
| [`PROTOCOLO-AUTONOMIA.md`](./PROTOCOLO-AUTONOMIA.md) | Como o JARVIS opera **autônomo**: orquestra os agentes e entrega o **relatório diário** de todas as áreas com foco em progresso. |
| [`ARQUITETURA-RUNTIME.md`](./ARQUITETURA-RUNTIME.md) | O **"corpo"** do JARVIS: voz, execução local, conectores (MCP), memória e segurança — 4 camadas + roteiro de implantação. |
| [`agentes/`](./agentes/) | **Agentes especializados** — um documento por área (Financeiro, Cobrança, Diretoria, Produção…) + o Coordenador, prontos para virar Projetos do Claude. |
| [`painel/`](./painel/) | App **PWA** inicial: Painel Inicial de Configuração, 14 módulos, pendências e alertas. Instalável no celular, offline. |

## Como usar

**Como assistente (Claude):** cole o conteúdo de `PROMPT-MESTRE-JARVIS.md` como
*system prompt* / instrução base do projeto. Ao trabalhar dentro deste repositório,
o `CLAUDE.md` já faz o assistente adotar a persona automaticamente.

**Como painel (celular/desktop):** publique a pasta `painel/` (Vercel, Netlify ou
GitHub Pages) e instale como aplicativo. Ver [`painel/README.md`](./painel/README.md).

## Roadmap de implantação

1. **Fase 1** — Estrutura inicial (este repositório). ✅
2. **Fase 2** — Financeiro + Cobrança.
3. **Fase 3** — Diretoria e projetos.
4. **Fase 4** — Produção, estoque e logística.
5. **Fase 5** — Oracle NetSuite (migração TOTVS RM).
6. **Fase 6** — Incentivos fiscais (SUDENE · ICMS · Lei do Bem) e Radar.
7. **Fase 7** — Automação avançada (APIs, agentes, alertas, preditivo).

> Início recomendado: **Financeiro + Cobrança + Diretoria**, criando uma base
> confiável antes de liberar automações operacionais.

---

Radar Assessoria Empresarial · Grupo Kalfix · SKAL Engenharia, Indústria e Comércio Ltda.
