# Briefing oficial — Arquitetura de Agentes do Grupo Kalfix

> Versão compacta de referência (economiza tokens, define toda a arquitetura). A implementação
> está em `ARQUITETURA-GRUPO.md`, `POLITICAS-GRUPO.md` e nos agentes `.claude/agents/coord-*`.

Criar arquitetura de agentes para o Grupo Kalfix com foco em **segregação de dados** e **economia de tokens**.

**ESTRUTURA**
- SKAL: Matriz, Filial Teresina, Filial Parnaíba, Filial Cascavel
- KALFIX · QUIMIKA · FCK

**7 COORDENADORES**: SKAL Matriz, SKAL Teresina, SKAL Parnaíba, SKAL Cascavel, KALFIX, QUIMIKA, FCK.
**Recomendado**: 1 Coordenador Executivo do Grupo para análises consolidadas.

**REGRA PRINCIPAL**: não duplicar os especialistas (Financeiro, Jurídico, Fiscal, Contábil, RH,
Compras, Comercial, Operações etc.) — são **compartilhados** por todos os coordenadores.

**Toda chamada informa**: `empresa_id`, `unidade_id`, `modo` (individual ou consolidado).
Exemplos: SKAL/MATRIZ · SKAL/TERESINA · SKAL/PARNAIBA · SKAL/CASCAVEL · KALFIX/GERAL · QUIMIKA/GERAL · FCK/GERAL.

**ISOLAMENTO**: cada coordenador e agente só consulta/responde dados da sua empresa/unidade; não
misturar memória, documentos, indicadores ou resultados entre empresas. Consolidação só quando
explicitamente autorizada, preferencialmente via Coordenador Executivo.

**BASES**: Base comum do Grupo + Base SKAL Matriz/Teresina/Parnaíba/Cascavel + Base KALFIX/QUIMIKA/FCK.
Cada coordenador acessa apenas: **Base comum + sua base específica**.

**ECONOMIA DE TOKENS**: não repetir regras longas; centralizar regras comuns; enviar aos especialistas
só tarefa + empresa + unidade + dados necessários; não repassar histórico inteiro; especialistas
retornam só conclusão, números essenciais, riscos e ações.

**Objetivo final**: 1 conjunto único de especialistas compartilhados + 7 coordenadores independentes
+ 1 executivo opcional, com resultados totalmente segregados por empresa/unidade e consolidação só quando autorizada.
