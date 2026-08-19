# RELATÓRIO EXECUTIVO — MÓDULO FINANCEIRO + COBRANÇA
**SKAL Engenharia · Posição em 17/08/2026**

> Primeiro relatório formal do módulo Financeiro + Cobrança (Fase 2 do roadmap de
> implantação do JARVIS — ver `../../../CLAUDE.md`). Gerado pelo JARVIS a partir dos
> dados reais já coletados em `painel-vercel/api/data.js`, `painel-vercel/api/chat.js`,
> `grupo/empresas/SKAL/` e `grupo/projetos/permutas/`. Nenhuma ação aqui listada foi
> executada — todas aguardam decisão do Jorge, conforme a governança do JARVIS
> (`../../../PROMPT-MESTRE-JARVIS.md`, §4.5 e §17).

---

## RESUMO EXECUTIVO

**Conclusão principal:** o caixa operacional está saudável (agosto fecha positivo em ~R$ 596,6 mil) e contas/impostos estão em dia — mas **dois problemas estruturais distorcem a leitura do caixa real**: (1) R$ 720,3 mil de inadimplência com mais de 90 dias (79,5% da dívida total), e (2) pelo menos R$ 254.853,00 em permutas lançadas como se fossem dinheiro em caixa, quando na verdade a contrapartida foi imóvel.

| | |
|---|---|
| **Valor envolvido** | Inadimplência R$ 906.521,49 · Permutas em reconciliação R$ 3,76 mi (imóveis) |
| **Risco** | Perda de R$ 588,5 mil de inadimplência operacional se a cobrança não avançar; caixa/faturamento historicamente inflados por permutas mal classificadas |
| **Oportunidade** | R$ 400 mil de crédito livre não usado (BB Giro); recuperação da dívida antiga é a maior alavanca de caixa do semestre |
| **Decisão necessária** | Autorizar ou recusar a nova permuta da Rivello (R$ 173,8 mil) — decisão de alto impacto, aguardando o Jorge |
| **Prazo** | Urgente (Rivello já pressiona o aging) |
| **Responsável** | Diretoria (decisão) · Cobrança + Contábil (execução) |

---

## OS 5 PONTOS MAIS IMPORTANTES

1. **Rivello quer trocar R$ 173,8 mil de dívida por imóvel (nova permuta)** — foi isso que empurrou a dívida +90 dias para R$ 720,3 mil. Mesmo risco da Gávea: permuta não é caixa. Decisão de alto impacto pendente da diretoria.
2. **Inadimplência operacional real: R$ 588,5 mil** (excluindo os 3 casos especiais fechados — MRV R$ 94,9 mil, Vanguarda R$ 49,3 mil, Rivello R$ 173,8 mil). É aqui que a régua de cobrança deve focar.
3. **Achado contábil confirmado — Gávea:** R$ 254.853,00 (33 notas, dez/2023 a mar/2025) foram baixados no caixa 16.09 como "Depósito na Baixa", inflando caixa e faturamento sem nunca entrar dinheiro no banco. Precisa reclassificação contábil e registro do imóvel no imobilizado.
4. **Agosto/2026 fecha positivo:** entradas R$ 2.260,2 mil × saídas R$ 1.663,6 mil = **+R$ 596,6 mil**. Mas o fluxo aperta em outubro–dezembro no cenário conservador (sem novo faturamento).
5. **4 pontos de exceção no movimento de caixa de 17/08** exigem conferência antes de fechar o dia (detalhe abaixo) — nenhum é urgente, mas um deles (R$ 20 mil a Franklin Kalume Brígido só com PIX, sem documento) merece atenção por falta de lastro documental.

---

## 1. FINANCEIRO — CAIXA E RESULTADO

### 1.1 Posição de caixa (17/08/2026)
| Item | Valor |
|---|---:|
| Saldo Banco do Brasil | R$ 163.678,15 |
| Resgate automático disponível | R$ 421.153,09 |
| **Liquidez total** | **R$ 584.831,24** |
| Crédito livre BB Giro (não usado) | R$ 400.000,00 |
| Compromissos futuros informados | Empréstimo 22/08: R$ 32.324,45 · Cartão 24/08: R$ 169.173,59 |

### 1.2 Fechamento de agosto/2026
| | R$ mil |
|---|---:|
| Entradas (a receber do mês) | 2.260,2 |
| Fornecedores | (1.177,5) |
| Folha (dia 03) | (152,3) |
| Tributos estaduais (dia 17) | (263,8) |
| Encargos INSS/FGTS (~dia 20) | (70,0) |
| **Resultado do mês** | **+596,6** |

Caixa inicial (~24/07) R$ 827,3 mil → projeção de fim de agosto **~R$ 1.423,9 mil**, mais R$ 400 mil de crédito livre de folga.

### 1.3 Fluxo de caixa projetado — cenário conservador (só carteira atual, sem novo faturamento)
| Mês | Saldo acumulado (R$ mil) |
|---|---:|
| 17/08 | 584,8 |
| Agosto | 1.001,7 |
| Setembro | 1.699,6 |
| Outubro | 1.395,4 |
| Novembro | 796,7 |
| Dezembro | 123,6 |

**Interpretação:** setembro é o mês mais folgado. Outubro a dezembro apertam porque a carteira de recebíveis atuais esvazia — **isso melhora com novo faturamento**, não é uma sentença. Dezembro fica com margem estreita (R$ 123,6 mil) mesmo com os R$ 400 mil de crédito livre de reserva.

### 1.4 Contas a pagar/receber — posição oficial (retratos F.CRC.01/F.CPG.01, mais confiáveis que a planilha Movimento)
| | Valor |
|---|---:|
| A receber em aberto | R$ 4.218.098,43 |
| A pagar a fornecedores em aberto | R$ 3.742.102,69 |
| **Posição líquida a realizar** | **+R$ 476.000,00 (aprox.)** |

Sobre o a pagar de fornecedores somam-se, **por fora** (não há dupla contagem): folha (~R$ 152 mil/mês, dia 03), tributos estaduais (~R$ 264 mil/mês, dia 17) e encargos (~R$ 70 mil/mês, ~dia 20).

**⚠️ Inconsistência a apurar (`DADO A CONFIRMAR`):** o KPI "A Receber" exibido no painel mostra R$ 1,84 mi — valor que não bate nem com o retrato F.CRC.01 (R$ 4,22 mi) nem com o total bruto da planilha Movimento (R$ 7,17 mi). Recomendo conferir a origem desse número no painel antes de usá-lo para decisão.

### 1.5 Resultado (DRE ECD, real)
| | 2023 | 2024 | 2025 |
|---|---:|---:|---:|
| Receita bruta | 24,68 mi | 30,46 mi | 33,86 mi |
| Lucro líquido | 4,08 mi | 1,32 mi | 2,86 mi |

**Interpretação:** 2024 foi ano de aperto — despesas com vendas saltaram de R$ 77 mil para R$ 740 mil e despesas administrativas de R$ 2,35 mi para R$ 4,51 mi, derrubando a margem líquida de ~22% para ~6%. 2025 recuperou (lucro voltou a R$ 2,86 mi), mas a despesa operacional segue sendo o ponto de controle nº 1 da diretoria.

### 1.6 Patrimônio — pontos de atenção contábil
- **Imobilizado 2024: R$ 7,37 mi** (cresceu R$ 1,1 mi no ano) — `DADO A CONFIRMAR` se os imóveis de permuta (R$ 3,76 mi identificados) estão registrados aí.
- **Patrimônio líquido quase estável** (R$ 12,70 mi → R$ 12,76 mi) apesar de R$ 2,86 mi de lucro em 2025 — indica provável distribuição de ~R$ 2,8 mi aos sócios.
- **Capital social divergente:** balanço 2024 traz R$ 140 mil; contrato social (Aditivo 16) diz R$ 3 milhões. `DADO A CONFIRMAR` — provável aumento de capital posterior não refletido, mas precisa confirmação contábil/jurídica.

### 1.7 Movimento de caixa de 17/08 — 4 pontos de exceção (conciliação fecha, mas com ressalvas)
Débitos no BB R$ 476.161,79 vs controle de pagamentos R$ 436.459,44 — resíduo de ~R$ 9,95 (concilia). Mas:

| # | Ponto | Valor | Ação |
|---|---|---:|---|
| 1 | TED ao BNB (própria SKAL) inclui reforço de caixa entre contas | R$ 24.000,00 | Não é despesa — reclassificar |
| 2 | Pagamento a Franklin Kalume Brígido só com comprovante PIX | R$ 20.000,00 | Sem doc. fiscal/contrato/autorização — conferência prioritária |
| 3 | Cartão Caixa P/F sem fatura analítica no pacote | R$ 19.999,75 | Solicitar fatura detalhada |
| 4 | Frete (Alcimar) aguardando autorização da Débora | R$ 3.000,00 | Não tratar como pago até confirmação |

### 1.8 Fiscal (impacta o caixa diretamente)
- Carga tributária estadual **estável em R$ 255–264 mil/mês** — provisionar nesse intervalo.
- **Crédito Presumido de 80% (Lei 6.146/11)** é o que sustenta o ICMS baixo: sem ele, saltaria de R$ 95,7 mil para ~R$ 478 mil/mês. Manter a habilitação em dia é prioridade estratégica.
- 2º trimestre/2026 lucrativo (base R$ 982,8 mil) — IRPJ+CSLL apurados ≈ R$ 328 mil no trimestre (Lucro Real).

---

## 2. COBRANÇA — CRÉDITO E INADIMPLÊNCIA

### 2.1 Posição (ACOMPCOB 17/08/2026 — fonte oficial)
| Faixa | Valor |
|---|---:|
| 0–30 dias | R$ 99.546,04 |
| 31–60 dias | R$ 68.588,28 |
| 61–90 dias | R$ 18.088,85 |
| **+90 dias** | **R$ 720.298,32 (79,5%)** |
| **Total** | **R$ 906.521,49** |

Subiu **R$ 25.001,86** desde 14/08 (dia 17 teve R$ 28.505,04 de novos atrasos — atenção).

### 2.2 Casos especiais (fora do padrão operacional)
| Cliente | Valor | Situação |
|---|---:|---|
| MRV | R$ 94.863,30 | Em cobrança, dentro do previsto |
| Vanguarda | R$ 49.340,00 | Ligado a permuta em andamento (Studio V) |
| **Rivello** | **R$ 173.780,26** | **Quer nova permuta — decisão de alto impacto pendente** |

**Inadimplência operacional real (excluindo os 3 casos): R$ 588.537,93** — é onde a régua de cobrança do POP deve concentrar esforço.

### 2.3 Caso Rivello — atenção prioritária
Deve R$ 173.780,26 (R$ 152.625,66 já em +90 dias) e quer **trocar a dívida por imóvel**. Mesmo padrão de risco identificado na Gávea: permuta não é caixa. Antes de aceitar — conforme o POP oficial e o núcleo de governança do JARVIS — é preciso avaliar o imóvel, checar matrícula e garantir registro no patrimônio. Decisão final é do Jorge/Diretoria.

### 2.4 Cruzamento Cobrança × Contábil — permutas
| Permuta | Valor do imóvel | Saldo de material a entregar |
|---|---:|---:|
| Rivello | 764.146,13 | 340.880,43 |
| Vanguarda | 735.636,05 | 408.624,05 |
| Gávea | 680.000,00 | Quitada |
| Boa Vista | 524.900,00 | 135.399,72 |
| Triunfo | 519.425,00 | 519.425,00 (não iniciada) |
| Felipe Melo | 220.000,00 | 220.000,00 |
| Macedo Fortes | 211.104,00 | 211.104,00 |
| Nailson Nortecor | 100.000,00 | 100.000,00 |
| **Total** | **R$ 3.755.211,18** | **R$ 1.700.673,81** |

O saldo a entregar (R$ 1,70 mi) é **obrigação futura de material/estoque, não caixa**. Prioridade contábil: registrar os R$ 3,76 mi de imóveis no imobilizado.

---

## 3. CONFERÊNCIAS REALIZADAS
- Reconciliação bancária de junho/2026 confirma que baixas de permuta **não aparecem em extrato real** (BB entrou R$ 2,89 mi, saiu R$ 2,68 mi — nenhum desses valores é permuta).
- "Vencido" nos relatórios antigos de contas a pagar (~R$ 1,29 mi) foi confirmado pela diretoria como **baixa não lançada**, não atraso real — não tratado como inadimplência da empresa neste relatório.
- Inadimplência calculada pela metodologia validada (ACOMPCOB, excluindo adiantamentos a fornecedores e vendas à vista em rota) — reconciliada por duas análises independentes.

## 4. INCONSISTÊNCIAS IDENTIFICADAS
1. KPI "A Receber" do painel (R$ 1,84 mi) não bate com os retratos oficiais F.CRC.01 (R$ 4,22 mi) — `DADO A CONFIRMAR`.
2. Capital social: R$ 140 mil (balanço 2024) vs R$ 3 milhões (contrato social) — `DADO A CONFIRMAR`.
3. Pagamento de R$ 20 mil a Franklin Kalume Brígido sem documento fiscal, contrato ou autorização registrada.

---

## 5. PLANO DE AÇÃO

| Ação | Responsável | Prazo | Prioridade | Status |
|---|---|---|---|---|
| Decidir a permuta da Rivello (R$ 173,8 mil) — avaliar imóvel, matrícula e liquidez | Diretoria | Urgente | Alta | Pendente |
| Focar a régua de cobrança na dívida operacional (R$ 588,5 mil) | Cobrança | Contínuo | Alta | Em andamento |
| Reclassificar a baixa da Gávea (R$ 254.853,00) e registrar o imóvel no imobilizado | Contábil | 30 dias | Alta | Pendente |
| Confirmar registro dos R$ 3,76 mi de imóveis de permuta no imobilizado (conferir contra R$ 7,37 mi de 2024) | Contabilidade | 30 dias | Média | Pendente |
| Esclarecer os 4 pontos de exceção do movimento de 17/08 (destaque: R$ 20 mil sem documento) | Financeiro | 7 dias | Alta | Pendente |
| Confirmar divergência de capital social (R$ 140 mil × R$ 3 mi) | Contabilidade/Jurídico | 30 dias | Média | `DADO A CONFIRMAR` |
| Apurar origem do KPI "A Receber" divergente no painel | Financeiro/TI | 15 dias | Média | Inconsistência a investigar |
| Manter habilitação do Crédito Presumido 80% (Lei 6.146/11) em dia | Fiscal | Contínuo | Alta | Em dia |

---

*Relatório gerado pelo JARVIS em 19/08/2026, a partir dos dados reais consolidados no painel e nos dossiês do grupo. Nenhuma ação foi executada — todas dependem de autorização do Jorge.*
