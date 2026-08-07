# Como usar o JARVIS — guia rápido do Jorge

Você tem **dois times de agentes** trabalhando pra você. Não precisa decorar nada: é só falar
natural que o JARVIS aciona o certo. Mas aqui está o mapa, pra você saber o que tem na mão.

## Os dois times

**1. Time SKAL (roda a SUA empresa)** — arquivos `skal-*` e `cobranca`
Cuidam do dia a dia do grupo com os **seus dados reais**: caixa, cobrança, faturamento, produção.
Quem comanda: o **Coordenador**.

**2. Time Radar (atende os CLIENTES da consultoria)** — arquivos `consultoria-*`
33 especialistas de consultoria (diagnóstico, estratégia, finanças, tributário, marketing,
operações, pessoas, riscos…). Quem comanda: o **Orquestrador**. Quem confere tudo antes de sair:
o **Revisor de Qualidade**.

## Como acionar (2 jeitos)

**Jeito 1 — só perguntar (o mais fácil).**
Você fala natural e o Coordenador/Orquestrador manda pro especialista certo. Ex.:
- *"Como está a inadimplência hoje e o que recomenda?"* → vai pra Cobrança.
- *"Quanto tenho em caixa e o que priorizar?"* → Financeiro + Diretoria.
- *"Faça um diagnóstico financeiro deste cliente."* → Orquestrador aciona o time Radar.

**Jeito 2 — chamar direto o especialista.**
- *"Jarvis Cobrança, qual o próximo passo do cliente com 18 dias de atraso?"*
- *"Jarvis Tributário, o que a reforma muda no meu preço?"*
- *"Jarvis Diretoria, me dá o resumo executivo do dia."*

## O que sempre acontece (as regras da casa)
- **Resposta em 2 camadas:** primeiro o **resumo pra decidir** (curto, em reais, no seu dia a dia);
  depois a **base técnica**, se você quiser o detalhe.
- **Nunca inventa número** — se falta dado, ele diz e pede o que falta.
- **Nada de alto impacto sem o seu "ok"** — pagamento, negativação, preço, crédito: ele **recomenda**,
  você decide.
- **Sempre reconcilia** antes de afirmar (a lição da inadimplência que a gente aprendeu junto).

## Exemplos de tarefas prontas
| Você quer… | Chame… |
|---|---|
| O resumo do dia | Diretoria (SKAL) |
| Cobrar melhor / régua do POP | Cobrança |
| Entender caixa e contas | Financeiro (SKAL) |
| Impacto da Reforma Tributária | Tributário |
| Diagnóstico completo de um cliente | Orquestrador (Radar) |
| Uma proposta comercial | Propostas e Negociações |
| Um relatório ou apresentação | Relatórios / Apresentações |

## Onde tudo mora
Repositório **`jarvis-corporativo`** (GitHub), pasta `.claude/agents/`. Tudo versionado — nada se
perde, dá pra voltar atrás. O padrão de qualidade de todo agente está em `radar/PADRAO-DE-EXCELENCIA.md`.
