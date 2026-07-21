# Painel JARVIS — Aplicativo PWA

Interface inicial do **JARVIS Corporativo** (SKAL · Grupo Kalfix · Radar). App em
arquivo único (HTML + CSS + JS), instalável no celular e com cache offline.

## 📦 Arquivos

- `index.html` — Aplicativo completo (painel de configuração, módulos, pendências, alertas)
- `manifest.json` — Configuração PWA (nome, ícone, cores)
- `sw.js` — Service Worker (cache offline)

## 🧭 O que o painel faz hoje

- **Configuração** — os 12 itens do *Painel Inicial de Configuração* (empresas, usuários,
  sistemas, integrações, processos prioritários, indicadores, regras de aprovação, segurança…),
  salvos localmente no dispositivo.
- **Módulos** — os 14 módulos funcionais do JARVIS, para referência rápida.
- **Pendências** — registrar/remover pendências (descrição, responsável, prazo, prioridade),
  salvas no `localStorage`.
- **Alertas** — gatilhos-modelo dos alertas prioritários.

> Os dados ficam **apenas no dispositivo** (`localStorage`). Sincronização em equipe e
> alertas reais dependem das integrações (NetSuite, TOTVS, banco) previstas na Fase 7.

## 🚀 Publicar em 5 minutos

**Vercel (recomendado):** login com GitHub → *New Project* → importar este repositório →
*Root Directory* = `painel/` → **Deploy**. Recebe um link `https://…vercel.app`.

**Netlify:** arraste os 3 arquivos em netlify.com. **GitHub Pages:** Settings → Pages →
deploy da pasta `painel/`.

## 📱 Instalar no celular

- **Android (Chrome):** abrir o link → Menu → *Instalar aplicativo*.
- **iPhone (Safari):** abrir o link → Compartilhar → *Adicionar à Tela de Início*.

## 🔒 Confidencialidade

Uso interno. Não insira senhas, tokens ou credenciais no painel — apenas dados de
configuração. Nenhuma ação de alto impacto é executada sem validação humana.

---

**Dúvidas?** Jorge — Radar Assessoria Empresarial.
