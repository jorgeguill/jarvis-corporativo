# Registro de Permutas — Controle do Grupo (SKAL / Kalfix)

> Fonte única do controle de permutas. Cada contrato de permuta (material × imóvel) é
> registrado aqui com os campos abaixo, para separar **permuta de caixa** e garantir que o
> **imóvel recebido entre no patrimônio**. Segue `grupo/POLITICAS-GRUPO.md` e o especialista
> `especialista-permutas`.
>
> **Regra de ouro:** baixa de permuta **não é dinheiro em caixa**. É troca de material por
> imóvel. Lançar como "Depósito na Baixa" no caixa infla caixa e faturamento e esconde o ativo.

## Por que este controle existe (dito pelo Jorge)

Normalmente a permuta é ~50% do contrato: material do SKAL contra imóvel da construtora. Hoje o
controle está precário — os contratos **não estão lançados no sistema**, são tratados como venda
e a baixa é feita na modalidade permuta. A preocupação: ao baixar, os valores **entram no caixa
como se fosse espécie**, mas o dinheiro nunca entra — entra imóvel, que **dificilmente é
registrado como patrimônio**, e a contabilidade **provavelmente desconhece** muitos desses contratos.

## Campos de cada contrato

| Campo | O que é |
|---|---|
| Construtora | Contraparte |
| Empresa/Unidade | SKAL Matriz/Filial, Kalfix, etc. (segregação) |
| % permuta | Percentual do contrato pago em imóvel |
| Valor do contrato | Valor total de material |
| Material fornecido | Já entregue (com NF) |
| Material a fornecer | Saldo a entregar |
| Imóvel | Empreendimento, unidade, matrícula |
| Valor do imóvel | Valor de referência do imóvel recebido |
| Registrado no patrimônio? | S/N — **campo crítico** |
| Contabilidade ciente? | S/N |
| Como está baixado no ERP | Conta/caixa e modalidade |

---

## Contratos identificados (dados reais recebidos em 07/08/2026)

### 1. GÁVEA CONSTRUÇÕES LTDA — **ACHADO CRÍTICO CONFIRMADO**
- **Empresa:** SKAL Engenharia (fornecimento de material) + Kalfix (serviço de engenharia na mesma obra).
- **Obra / imóvel:** Vistamar Coqueiro, em Luís Correia/PI ("apartamento na praia").
- **Como está baixado hoje:** 28 notas fiscais (dez/2023 a nov/2024) baixadas como **"Depósito na Baixa"** no **caixa 16.09**, histórico *"Encontro de contas com apartamento na praia"*.
- **Valor:** **R$ 251.150,00** (fonte: planilha `Gavea_Permuta.XLSX`).
- **Problema:** esse valor foi registrado **como se fosse dinheiro entrando no caixa**, mas nenhum real entrou em banco — a contrapartida foi **apartamento**. Infla caixa e faturamento.
- **Pendências:** (a) identificar qual/quais unidades da obra Vistamar Coqueiro cabem ao SKAL; (b) valor de referência do(s) imóvel(is); (c) verificar se está no patrimônio; (d) verificar se a contabilidade tem o contrato. Kalfix tem "Relatório de Medição Final" da mesma obra (blocos 1 e 2) — cruzar.
- **Status registro no patrimônio:** `DADO A CONFIRMAR` (forte suspeita de NÃO).

### 2. VANGUARDA ENGENHARIA LTDA — SKAL comprador de imóvel
- **Contrato:** Instrumento Particular de Promessa de Compra e Venda, **Contrato nº 163, unidade 2003**.
- **Imóvel:** Empreendimento **STUDIO V – DOM SEVERINO**, Av. Dom Severino nº 2571, Teresina/PI.
- **Papel do SKAL:** **Promissário Comprador** (representado por Franklin Kalume Brígido).
- **Vínculo com permuta:** Vanguarda também é devedora no ACOMPCOB (R$ 49.340) — provável **encontro de contas** material × imóvel.
- **Pendências:** valor do imóvel, saldo, se a aquisição está registrada no ativo, e se a dívida da Vanguarda é abatida contra este imóvel. `DADO A CONFIRMAR`.
- **Arquivo:** `CONTRATO_STDVDS2003 ... Assinado.pdf`.

### 3. MACEDO FORTES — Residencial Morena / Broder Park (Bloco 1, Casa 163)
- **Contrato de permuta** (arquivo escaneado, sem camada de texto — precisa leitura/OCR para extrair valores).
- **Pendências:** % permuta, valor, imóvel/matrícula. `DADO A CONFIRMAR`.
- **Arquivo:** `CONTRATO_PERMUTA__MACEDO_FORTES__RESIDENCIAL_MORENA_BRODER_PARK_BLOCO_1_CASA_163.pdf`.

### 4. Condomínio VILLAGE DO SOL NASCENTE — Loja 01, Turu
- Documento escaneado (sem texto) — precisa leitura/OCR.
- **Arquivo:** `SKAL_Condom_nio_Village_do_Sol_Nascente_Loja_01_Turu.pdf`.

### 5. FRANKLIN CHAKAL II — lotes 48, 49a e 49b
- Documento de 170 páginas (escaneado) — precisa leitura/OCR dirigida.
- **Arquivo:** `SKAL_FRANKLIN_CHAKAL_II__lotes_48_49a_e_49b.pdf`.

### 6. RIVELLO (SKAL 409)
- Documento escaneado — precisa leitura/OCR.
- **Arquivo:** `Rivello__SKAL_ENGENHARIA_INDUSTRIA_E_COMERCIO_LTDA_409.pdf`.

### Tabelas de referência de preço de imóvel
- **VISTA MAR** (1ª Fase e versão "Janeiro Oficial 05/01/22") — tabelas de preços das unidades, úteis para atribuir **valor de referência** aos imóveis recebidos em permuta.

---

## Ações recomendadas (nada é executado sem autorização do Jorge)

1. **Parar de tratar baixa de permuta como caixa.** Criar/confirmar uma conta contábil de
   permuta separada do caixa físico; a baixa de permuta credita "Imóveis a receber por permuta",
   não "Caixa".
2. **Levantar o passivo do achado Gávea (R$ 251.150):** identificar o(s) imóvel(is), avaliar,
   e registrar no ativo imobilizado com matrícula.
3. **Cadastrar cada contrato de permuta no sistema** com os campos deste registro.
4. **Alinhar com a contabilidade** — confirmar quais contratos ela desconhece.
5. **Cruzar Kalfix × SKAL na obra Vistamar Coqueiro** (medição final Kalfix + fornecimento SKAL).

> Impacto potencial: caixa e faturamento históricos podem estar **superavaliados** pelo montante
> das permutas baixadas como dinheiro; em contrapartida há **ativos imobiliários não registrados**.
> Só a Gávea já são R$ 251.150 nesse padrão. É correção contábil e patrimonial, com efeito fiscal
> — encaminhar via `especialista-contabil`, `especialista-juridico` e `consultoria-tributario`.
