# Radar Consultoria — Arquitetura de Agentes de Alta Performance

> Estrutura de agentes da **Radar Assessoria Empresarial** para atender clientes de
> consultoria. Um **Orquestrador** distribui as demandas; agentes especialistas têm
> escopo, competências e entregáveis bem definidos.
>
> Relação com o resto do JARVIS: esta suíte é **voltada ao cliente** (produto da Radar).
> A suíte **operacional SKAL** (`.claude/agents/cobranca.md`, Financeiro, Produção…)
> roda a empresa do Jorge. As duas compartilham o **Núcleo comum** (não inventar dados;
> Fato/Cálculo/Interpretação/Recomendação; nenhuma ação de alto impacto sem autorização).

## 0. Orquestrador de Consultoria
Recebe a demanda, diagnostica, seleciona os especialistas, controla qualidade e consolida
a resposta. Entregáveis: plano de trabalho, diagnóstico integrado, recomendações
priorizadas, relatório executivo. → `.claude/agents/consultoria-orquestrador.md`

## Especialistas (1–33)

### Estratégia e inteligência empresarial
| Nº | Agente | Entregável-chave |
|---|---|---|
| 2 | Diagnóstico Empresarial | Diagnóstico 360°, causas-raiz, oportunidades |
| 3 | Estratégia Corporativa | Mapa estratégico, objetivos, plano de crescimento |
| 4 | Inteligência de Mercado | Relatório de mercado, mapa competitivo, tendências |
| 5 | Modelagem de Negócios | Business Model Canvas, proposta de valor, plano de validação |

### Finanças e desempenho econômico
| Nº | Agente | Entregável-chave |
|---|---|---|
| 6 | Diagnóstico Financeiro | Diagnóstico financeiro, mapa de riscos, indicadores |
| 7 | Planejamento Financeiro e Controladoria | Orçamento, projeções, painel de acompanhamento |
| 8 | Custos, Margens e Precificação | Modelo de precificação, plano de rentabilidade |
| 9 | Valuation e Viabilidade de Investimentos | Valuation, estudo de viabilidade, recomendação |

### Vendas, marketing e clientes
| Nº | Agente | Entregável-chave |
|---|---|---|
| 10 | Estratégia Comercial | Plano comercial, funil, metas, cadência |
| 11 | Marketing Estratégico | Plano de marketing, posicionamento, campanhas |
| 12 | Customer Experience e Retenção | Mapa da jornada, plano de retenção, indicadores |
| 13 | Propostas e Negociações | Proposta comercial, estratégia de negociação, matriz de objeções |

### Operações e produtividade
| Nº | Agente | Entregável-chave |
|---|---|---|
| 14 | Excelência Operacional | Mapa de processos, plano de eficiência |
| 15 | Produtividade e Redução de Custos | Plano de redução de custos, metas de economia |
| 16 | Supply Chain e Compras | Estratégia de compras, política de estoques |
| 17 | Qualidade e Padronização | Procedimentos, padrões, sistema de controle |

### Pessoas, liderança e organização
| Nº | Agente | Entregável-chave |
|---|---|---|
| 18 | Estrutura Organizacional | Organograma, descrições de cargos, matriz de responsabilidades |
| 19 | Gestão de Pessoas e Performance | Modelo de avaliação, trilhas, sistema de performance |
| 20 | Liderança Executiva | Plano de liderança, rotinas de gestão, protocolos decisórios |
| 21 | Cultura e Gestão da Mudança | Plano de mudança, mapa de stakeholders, comunicação |

### Gestão, dados e execução
| Nº | Agente | Entregável-chave |
|---|---|---|
| 22 | Indicadores e Business Intelligence | Árvore de indicadores, dashboard executivo |
| 23 | OKRs e Gestão de Metas | Matriz de OKRs, scorecards, calendário |
| 24 | PMO e Gestão de Projetos | Plano do projeto, cronograma, matriz de riscos |
| 25 | Implementação e Planos de Ação | Plano de ação 5W2H, roadmap, acompanhamento |
| 26 | Reuniões Executivas | Pauta, briefing, ata executiva, pendências |

### Governança, riscos e inovação
| Nº | Agente | Entregável-chave |
|---|---|---|
| 27 | Governança Empresarial | Modelo de governança, matriz de alçadas, comitês |
| 28 | Riscos e Compliance | Matriz de riscos, controles, plano de mitigação |
| 29 | Inovação e Transformação Digital | Roadmap digital, portfólio de inovação, automação |
| 30 | Cenários e Gestão de Crises | Cenários, plano de contingência, protocolo de crise |

### Comunicação e produção de entregáveis
| Nº | Agente | Entregável-chave |
|---|---|---|
| 31 | Relatórios Executivos | Relatórios, pareceres, sumários executivos |
| 32 | Apresentações Estratégicas | Roteiro, apresentação executiva, notas do apresentador |
| 33 | Revisor de Qualidade | Parecer de qualidade, correções, versão final validada |

## Núcleo inicial recomendado (10 — para começar enxuto)
Permite executar projetos completos de diagnóstico, planejamento, transformação e acompanhamento:
1. **Orquestrador de Consultoria** (0)
2. **Diagnóstico Empresarial** (2)
3. **Estratégia Corporativa** (3)
4. **Diagnóstico Financeiro** (6)
5. **Estratégia Comercial** (10)
6. **Excelência Operacional** (14)
7. **Gestão de Pessoas e Performance** (19)
8. **Indicadores e Business Intelligence** (22)
9. **PMO e Implementação** (24/25)
10. **Revisor de Qualidade** (33)

## Modelo de configuração de cada agente (10 pontos obrigatórios)
Todo agente desta suíte é escrito com:
1. **Papel** — quem representa.
2. **Missão** — que resultado deve produzir.
3. **Escopo** — o que pode executar.
4. **Limites** — o que não deve fazer.
5. **Metodologias** — ferramentas e modelos que aplica.
6. **Dados de entrada** — o que precisa receber.
7. **Processo de análise** — sequência lógica obrigatória.
8. **Formato de saída** — estrutura padronizada dos entregáveis.
9. **Critérios de qualidade** — como valida o próprio trabalho.
10. **Handoff** — quando transfere a demanda para outro agente.
