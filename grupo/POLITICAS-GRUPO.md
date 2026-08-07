# Políticas do Grupo Kalfix — Registro Central (economia de tokens)

> Fonte única das regras comuns. Todo coordenador e especialista **referencia este arquivo**
> em vez de repetir as regras. Carregar só: referência a estas políticas + tarefa + empresa +
> unidade + dados necessários + formato de saída.

## 1. Contexto obrigatório (toda solicitação carrega)
```json
{ "empresa_id": "SKAL", "unidade_id": "MATRIZ", "modo": "individual",
  "coordenador_id": "coord_skal_matriz", "solicitante_id": "usuario_x",
  "autorizacao_consolidacao": false, "correlation_id": "uuid" }
```
- **modo**: `individual` (uma empresa/unidade) · `consolidado` (várias, só com autorização) ·
  `consolidado_grupo` (exclusivo do Coordenador Executivo).
- Sem `empresa_id`, `unidade_id` ou autorização compatível com o modo → **a execução falha**.

## 2. Isolamento (regra número 1)
- Cada coordenador/especialista só consulta e responde com dados **da sua empresa/unidade**.
- Não misturar memória, documentos, indicadores ou resultados entre empresas.
- Consulta sem escopo (`empresa_id`+`unidade_id`) → **rejeitada**, nunca executada por padrão.
- Bases autorizadas = **Base comum do Grupo + a base específica da empresa/unidade**. Nada além.

## 3. Roteamento (tabela de autorização)
| Origem | Destino | Permitido |
|---|---|---|
| Coordenador local | Especialistas | Sim, só na sua empresa/unidade |
| Coordenador Executivo | Coordenadores | Sim, mediante autorização registrada |
| Coordenador local | Dados de outra empresa | **Não** |
| Especialista | Memória de outra empresa | **Não** |
| Qualquer agente | Consulta sem escopo | **Não** |

O coordenador **decide quais especialistas chamar antes de executar**. Pergunta simples (ex.: contas
a pagar) não aciona Jurídico, Fiscal, RH e Operações juntos.

## 4. Formato de resposta do especialista (curto — só o essencial)
```json
{ "empresa_id": "...", "unidade_id": "...", "especialidade": "...",
  "conclusao": "...", "numeros_essenciais": { }, "riscos": [ ], "acoes": [ ], "fontes": [ ] }
```
Nunca devolver histórico completo, documentos inteiros ou explicação genérica já conhecida.

## 5. Consolidação (só autorizada)
Fluxo: usuário pede → gateway valida → Executivo cria plano → cada coordenador local produz
**resumo segregado** → Executivo recebe só os resumos autorizados → calcula o consolidado →
registra empresas, unidades e fontes. O Executivo recebe **resumos padronizados**, não acesso
direto às bases (menos risco e menos tokens).

## 6. Economia de tokens
Referência às políticas (não repetir) · tarefa + empresa + unidade + dados mínimos · resumos
progressivos (não histórico integral) · recuperação por relevância + filtro de metadados · cache
de políticas/indicadores estáveis · respostas em JSON · limite de documentos · modelo menor para
roteamento/extração, modelo forte só para análise/consolidação.

## 7. Segurança — nota honesta sobre camadas
A segregação **não pode depender só do prompt do agente**. A garantia real exige infraestrutura:
identidade/gateway assinando o contexto, Row-Level Security no banco, namespaces na busca vetorial,
memória por empresa/unidade, validação de contexto em cada ferramenta, secrets por escopo, logs de
auditoria e DLP. **Estado atual:** os coordenadores aplicam o isolamento **no nível de prompt/organização**
(recusam cross-company). A camada de infraestrutura entra quando os dados migrarem para sistemas
próprios (banco, ERP integrado) — é a próxima fase, não uma garantia já ativa. Registrar isso é parte da governança.
