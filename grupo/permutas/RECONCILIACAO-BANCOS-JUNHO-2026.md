# Reconciliação bancária — Junho/2026 (SKAL Filial)

> Base: extratos oficiais **Banco do Brasil (ag. 4249-8, c/c 117295-6)** e **Caixa (ag. 1292,
> op. 578358181-6)**, ambos SKAL ENG IND E COM LTDA, período 01–30/06/2026. Valores extraídos
> linha a linha dos PDFs. Objetivo: comparar **dinheiro que realmente entrou no banco** com o
> que o sistema baixa como "recebido" — e evidenciar que **permuta não gera dinheiro em banco**.

## Banco do Brasil — Filial (Junho/2026)

| Movimento | Valor | Lançamentos |
|---|---:|---:|
| **Entradas reais (crédito)** | **R$ 2.886.866,84** | 376 |
| **Saídas reais (débito)** | **R$ 2.680.151,03** | 525 |
| (à parte) Aplicações/Resgates automáticos "BB Rende Fácil" | aplicado 96.049,96 · resgatado 135.995,38 | — |

**Entradas por origem:**
- Cobrança (boletos) — R$ 2.257.966,57 (21) — principal fonte de caixa.
- Pix recebido — R$ 281.664,31 (211).
- Transferências recebidas — R$ 246.921,57 (41).
- Cielo (cartão) — R$ 48.167,05 (Crédito 36.160,90 + demais 12.006,15).
- Pix QR Code — R$ 28.069,10 (63).
- Recebimentos diversos — R$ 23.982,24.

**Saídas por natureza:**
- Pagamentos (boletos/fornecedores) — R$ 1.171.170,84 (211).
- Pix enviado — R$ 738.309,33 (193).
- **Impostos — R$ 417.005,88 (24)** — carga tributária relevante no mês.
- Fatura cartão de crédito — R$ 201.204,79 (dois lançamentos).
- Transferências enviadas — R$ 78.005,60 (16).
- Amortização de empréstimo — R$ 33.082,22; TED 30.000,00; Consórcio 3.119,28; tarifas 1.935,97.

## Caixa Econômica — Filial (Junho/2026)
- **Saldo inicial (01/06):** R$ 722,02 · **Saldo final (30/06):** R$ 26.473,47.
- Conta de movimento pequeno; maiores créditos foram Pix/TED (ex.: 125.000,00 em 03/06 seguido de folha de pagamento de 126.515,41 no mesmo dia) e uma folha de pagamento (DB FOL PAG) recorrente. Essa conta é usada sobretudo para **folha e pagamentos**, não para recebimento de vendas.

## Leitura para o Jorge

1. **O caixa de verdade do SKAL vem de Cobrança (boletos): R$ 2,26 mi só no BB em junho.** É aí que
   a régua de cobrança do POP tem o maior efeito. Pix + transferências + cartão somam mais ~R$ 604 mil.
2. **Impostos consumiram R$ 417 mil no mês** — coerente com o alerta do passivo fiscal (R$ 274 mil
   vencidos) e com a chegada do split payment da Reforma (2027), que tira a folga de empurrar imposto.
3. **Permuta não aparece aqui.** Nenhum desses R$ 2,89 mi é permuta — permuta não entra em banco.
   Quando o ERP baixa uma permuta como "Depósito na Baixa" no caixa 16.09 (caso Gávea, R$ 251.150),
   ele cria um "recebido" que **não tem lastro em extrato**. Por isso a reconciliação banco × ERP é o
   teste que separa dinheiro real de baixa de permuta. Ver `REGISTRO-PERMUTAS.md`.

> Próximo passo sugerido: pegar o "recebido" do ERP em junho e confrontar com os R$ 2,89 mi + Caixa.
> A diferença que não bater com extrato tende a ser exatamente baixa de permuta / baixa não lançada.
> `DADO A CONFIRMAR`: relatório de recebimentos do ERP de junho/2026.
