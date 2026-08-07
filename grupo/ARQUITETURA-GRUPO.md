# Arquitetura de Agentes — Grupo Kalfix (multi-empresa, segregada)

> Objetivo: **um único conjunto de especialistas compartilhados + 7 coordenadores independentes +
> 1 coordenador executivo**, com resultados totalmente segregados por empresa/unidade e consolidação
> só quando autorizada. Regras comuns em `POLITICAS-GRUPO.md` (não repetir nos agentes).

## Empresas e unidades
- **SKAL** — unidades: Matriz, Teresina, Parnaíba, Cascavel
- **KALFIX** · **QUIMIKA** · **FCK** — unidade: Geral

## Coordenadores (8) — `.claude/agents/coord-*.md`
| Coordenador | empresa_id | unidade_id | Bases autorizadas |
|---|---|---|---|
| SKAL Matriz | SKAL | MATRIZ | Comum + SKAL Matriz |
| SKAL Teresina | SKAL | TERESINA | Comum + SKAL Teresina |
| SKAL Parnaíba | SKAL | PARNAIBA | Comum + SKAL Parnaíba |
| SKAL Cascavel | SKAL | CASCAVEL | Comum + SKAL Cascavel |
| KALFIX | KALFIX | GERAL | Comum + KALFIX |
| QUIMIKA | QUIMIKA | GERAL | Comum + QUIMIKA |
| FCK | FCK | GERAL | Comum + FCK |
| **Executivo do Grupo** | GRUPO_KALFIX | TODAS | só resumos autorizados (sem acesso direto às bases) |

## Especialistas compartilhados (pool único — sem cópia por empresa)
Existem **uma vez só**; recebem o contexto (empresa_id, unidade_id, modo) e trabalham como serviço
sem memória empresarial própria. Pool-alvo:
`financeiro · controladoria · contabil · fiscal · tributario · juridico · cobranca · comercial ·
compras · operacoes · producao · logistica · rh · engenharia · qualidade · manutencao · projetos ·
auditoria · riscos`.

**Mapeamento para o que já existe** (reaproveita a suíte de consultoria e operacional):
- financeiro → `consultoria-diagnostico-financeiro` · controladoria → `consultoria-controladoria`
- tributario/fiscal → `consultoria-tributario` · cobranca → `cobranca` · compras → `consultoria-supply-chain`
- comercial → `consultoria-estrategia-comercial` · operacoes/producao → `consultoria-excelencia-operacional`
- rh → `consultoria-pessoas-performance` · riscos → `consultoria-riscos-compliance` · auditoria → `consultoria-revisor-qualidade`
- **A criar** (lacunas): `especialista-contabil`, `especialista-juridico`, `especialista-engenharia`,
  `especialista-manutencao`, `especialista-projetos`, `especialista-logistica`, `especialista-permutas`.

> Nota: os agentes `skal-*` operacionais criados antes viram um **caso particular** deste modelo
> (SKAL como empresa). Na visão de grupo, o pool compartilhado + o contexto os substitui — migração gradual.

## Bases de dados
`BASE_COMUM_GRUPO` (políticas, padrões, glossário, indicadores liberados p/ o grupo) +
`BASE_SKAL_MATRIZ` · `BASE_SKAL_TERESINA` · `BASE_SKAL_PARNAIBA` · `BASE_SKAL_CASCAVEL` ·
`BASE_KALFIX` · `BASE_QUIMIKA` · `BASE_FCK`.
Todo registro leva metadados: `empresa_id, unidade_id, tipo_dado, nivel_sigilo, origem, documento_id`.
Toda consulta (vetorial, SQL, memória, ferramenta) filtra por `empresa_id`+`unidade_id`.

## Ponto crítico herdado: PERMUTAS
Controle hoje precário: contratos não lançados, tratados como venda, baixados como "permuta" — o
valor pode entrar como se fosse caixa, mas o que entra é **imóvel** (muitas vezes fora do patrimônio,
desconhecido da contabilidade). Risco: **caixa e faturamento superavaliados + patrimônio oculto**.
Dono no modelo: `especialista-permutas` + Contábil + Auditoria + Controladoria. Ver `PERMUTAS.md` (a criar).

## Camada de infraestrutura (honesto)
O que os agentes garantem hoje é o isolamento **organizacional/prompt**. A garantia forte (gateway de
contexto assinado, RLS, namespaces vetoriais, DLP, secrets por escopo, auditoria) é **infraestrutura**
a construir quando os dados entrarem em sistemas próprios. Esta pasta define a organização e as regras;
a infra é a fase seguinte.
