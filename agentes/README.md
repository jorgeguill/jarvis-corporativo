# Agentes Especializados do JARVIS

Cada arquivo desta pasta é um **agente focado** do JARVIS — um assistente com papel,
entradas, saídas e regras próprias, derivado do [`PROMPT-MESTRE-JARVIS.md`](../PROMPT-MESTRE-JARVIS.md).

## Como usar

**Opção A — um Projeto do Claude por agente (recomendado):** crie um Projeto dedicado
(ex.: "JARVIS Financeiro") e cole o conteúdo do arquivo correspondente como instrução.
Assim cada área tem seu próprio espaço, memória e documentos.

**Opção B — um assistente só:** use o `PROMPT-MESTRE-JARVIS.md` e acione o agente por
comando, ex.: *"Jarvis Cobrança, gere a régua de inadimplência da semana."*

Todos os agentes herdam o **núcleo comum**: não inventar dados, separar
Fato/Cálculo/Interpretação/Recomendação, marcar `DADO A CONFIRMAR`, e nunca executar
ação de alto impacto sem autorização do Jorge.

## Índice

| # | Agente | Área | Fase do roadmap |
|---|---|---|---|
| 00 | [Coordenador](./00-coordenador.md) | Orquestra e consolida os demais | Todas |
| 14 | [Diretoria](./14-diretoria.md) | Relatórios e decisões executivas | Fase 3 |
| 01 | [Financeiro](./01-financeiro.md) | Caixa, contas, DRE, orçamento | Fase 2 |
| 03 | [Cobrança](./03-cobranca.md) | Crédito, inadimplência, régua | Fase 2 |
| 02 | [Controladoria](./02-controladoria.md) | Plano de contas, custos, indicadores | Fase 3 |
| 04 | [Comercial](./04-comercial.md) | Vendas, margem, representantes | Fase 4 |
| 05 | [Produção](./05-producao.md) | Argamassa/rejunte, eficiência, custo/ton | Fase 4 |
| 06 | [Logística](./06-logistica.md) | Frota, rotas, entregas | Fase 4 |
| 07 | [Compras](./07-compras.md) | Cotações, fornecedores, estoque | Fase 4 |
| 08 | [RH e DP](./08-rh.md) | Quadro, escalas, CIPA, NR-1 | Fase 4 |
| 10 | [NetSuite](./10-netsuite.md) | Migração TOTVS RM → Oracle NetSuite | Fase 5 |
| 09 | [Incentivos Fiscais](./09-incentivos-fiscais.md) | SUDENE, ICMS, Lei do Bem | Fase 6 |
| 13 | [Radar](./13-radar.md) | Consultoria: diagnósticos e propostas | Fase 6 |
| 11 | [Auditoria](./11-auditoria.md) | Acessos, segregação, trilha | Contínua |
| 12 | [Contratos](./12-contratos.md) | Cláusulas, prazos, minutas | Contínua |

## Ordem sugerida de ativação

Seguindo o prompt mestre: **Financeiro + Cobrança + Diretoria** primeiro (base confiável),
depois Controladoria, Produção/Logística/Comercial/Compras/RH, NetSuite, e por fim
Incentivos + Radar. Auditoria e Contratos são transversais e podem ser acionados a qualquer momento.
