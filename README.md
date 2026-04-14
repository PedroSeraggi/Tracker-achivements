# 🏆 Steam Trophy Tracker — React + TypeScript + Zustand

## ⚡ Como rodar (passo a passo)

> Você precisa de **2 terminais** abertos na mesma pasta do projeto.

---

### Passo 1 — Instale as dependências (uma vez só)

```bash
npm install
```

---


**Como obter a Steam API Key:**
1. Acesse https://steamcommunity.com/dev/apikey
2. Em "Nome do domínio" coloque: `localhost`
3. Clique em Registrar e copie a chave

---

### Passo 3 — Terminal 1: inicie o backend

```bash
npm run server
```

Deve aparecer:
```
🏆  Steam Trophy Tracker backend rodando!
   API:    http://localhost:3000
   Login:  http://localhost:3000/auth/steam
   React:  http://localhost:5173
```

---

### Passo 4 — Terminal 2: inicie o frontend

```bash
npm run dev
```

Acesse **http://localhost:5173** e clique em "Entrar com a Steam".

---

## ❌ Erros comuns e soluções

| Erro | Causa | Solução |
|------|-------|---------|
| `Cannot find module 'dotenv'` | `npm install` não rodou | Rode `npm install` |
| `ECONNREFUSED` no browser | Backend não está rodando | Rode `npm run server` em outro terminal |
| `STEAM_API_KEY não encontrada` | Arquivo `.env` ausente | Crie o `.env` conforme o Passo 2 |
| Jogos não carregam | Perfil privado | Steam → Privacidade → Detalhes do Jogo → **Público** |
| Erro 500 no callback | `BASE_URL` errada | Confirme que é `http://localhost:3000` sem barra no final |

---

## 📁 Estrutura do projeto

```
projeto/
├── server.js          ← Backend Express (Terminal 1: npm run server)
├── package.json       ← Dependências unificadas (frontend + backend)
├── .env               ← Suas configs privadas (não sobe pro Git!)
├── .env.example       ← Modelo do .env
├── vite.config.ts     ← Dev server React (:5173 com proxy para :3000)
├── tsconfig.json
├── index.html
└── src/
    ├── App.tsx
    ├── main.tsx
    ├── index.css
    ├── types/
    ├── store/
    ├── api/
    ├── hooks/
    └── components/
```

---

## 🚀 Deploy / Produção

```bash
# 1. Gera o build do React na pasta dist/
npm run build

# 2. Sobe o servidor em produção (serve o dist/ automaticamente)
NODE_ENV=production node server.js
```

Em produção só precisa de **um terminal / um processo**.
