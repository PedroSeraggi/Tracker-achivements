# 🏆 Steam Trophy Tracker

Acompanhe suas conquistas Steam com login oficial via conta Steam (OpenID).

---

## Como funciona o login?

O sistema usa **Steam OpenID** — o mesmo protocolo que sites como GOG, Humble Bundle e outros usam para o botão "Entrar com a Steam". Você é redirecionado para o site oficial da Steam, faz login lá, e volta ao tracker já autenticado. Sua senha nunca passa pelo nosso servidor.

```
Você clica "Entrar com a Steam"
        ↓
Redireciona para steamcommunity.com
        ↓
Você loga na Steam normalmente
        ↓
Steam devolve seu SteamID para o servidor
        ↓
Dashboard carrega com seus jogos e conquistas
```

---

## Pré-requisitos

Você vai precisar ter instalado:

- **Node.js** (versão 18 ou mais nova)
  - Baixe em: https://nodejs.org — escolha a versão LTS
  - Para verificar se já tem: abra o terminal e digite `node --version`

---

## Passo a Passo

### Passo 1 — Baixe o Node.js (se ainda não tiver)

Acesse https://nodejs.org, clique em **"LTS"** e instale normalmente.

Após instalar, abra o terminal (Prompt de Comando no Windows, Terminal no Mac/Linux) e confirme:

```bash
node --version
# deve mostrar algo como: v20.11.0

npm --version
# deve mostrar algo como: 10.2.0
```

---

### Passo 2 — Coloque os arquivos em uma pasta

Crie uma pasta para o projeto, por exemplo `steam-tracker`, e coloque todos os arquivos dentro:

```
steam-tracker/
├── server.js
├── package.json
├── .env.example
├── index.html
├── script.js
├── style.css
└── config.js
```

---

### Passo 3 — Abra o terminal na pasta do projeto

**Windows:** Segure Shift + clique direito dentro da pasta → "Abrir janela do PowerShell aqui"

**Mac:** Clique direito na pasta → "Novo Terminal na Pasta"

**Linux:** Clique direito → "Abrir Terminal"

---

### Passo 4 — Instale as dependências

No terminal, dentro da pasta do projeto, execute:

```bash
npm install
```

Vai aparecer uma pasta `node_modules` e um arquivo `package-lock.json`. Isso é normal.

---

### Passo 5 — Crie o arquivo `.env`

Copie o arquivo de exemplo:

**Windows (PowerShell):**
```powershell
copy .env.example .env
```

**Mac / Linux:**
```bash
cp .env.example .env
```

Agora abra o arquivo `.env` com qualquer editor de texto (Bloco de Notas, VS Code, etc.) e preencha:

```env
STEAM_API_KEY=sua_chave_aqui
SESSION_SECRET=qualquer_texto_longo_e_aleatorio_aqui
PORT=3000
BASE_URL=http://localhost:3000
```

---

### Passo 6 — Obtenha sua Steam API Key

1. Acesse: https://steamcommunity.com/dev/apikey
2. Faça login com sua conta Steam
3. Em "Nome do domínio", coloque: `localhost`
4. Clique em **Registrar**
5. Copie a chave gerada (parece com: `A1B2C3D4E5F6...`)
6. Cole no `.env` no campo `STEAM_API_KEY`

> ⚠️ **Nunca compartilhe essa chave publicamente.** Ela fica apenas no arquivo `.env` no seu computador — nunca vai para o navegador.

---

### Passo 7 — Inicie o servidor

No terminal, execute:

```bash
npm start
```

Você deve ver:

```
🏆 Steam Trophy Tracker rodando!
   Acesse: http://localhost:3000
```

---

### Passo 8 — Acesse no navegador

Abra: **http://localhost:3000**

Você verá a tela de login com o botão **"Entrar com a Steam"**.

Clique no botão → faça login na Steam → pronto! Suas conquistas serão carregadas automaticamente.

---

## Dicas de uso

**Recarregar dados:** Clique no botão "↺ Atualizar" no dashboard.

**Adicionar mais jogos:** Clique em "+ Adicionar Jogos" para selecionar da sua biblioteca.

**Perfil privado?** Se seus jogos não carregarem, vá em Steam → Configurações → Privacidade → "Detalhes do Jogo" → defina como **Público**.

---

## Para parar o servidor

No terminal onde está rodando, pressione `Ctrl + C`.

---

## Desenvolvimento (hot reload automático)

Se quiser que o servidor reinicie automaticamente ao salvar arquivos:

```bash
npm run dev
```

---

## Publicar na internet (futuramente)

Quando quiser colocar online, as opções mais simples são:

| Plataforma | Gratuito | Facilidade |
|---|---|---|
| **Railway** | Sim (com limites) | ⭐⭐⭐⭐⭐ |
| **Render** | Sim (com limites) | ⭐⭐⭐⭐ |
| **Fly.io** | Sim (com limites) | ⭐⭐⭐ |
| **VPS** (DigitalOcean, etc.) | Não | ⭐⭐ |

Ao publicar, lembre-se de:
1. Mudar `BASE_URL` no `.env` para a URL real do seu site
2. Atualizar a Steam API Key com o domínio real (no site da Steam)
3. Definir `SESSION_SECRET` como um texto muito aleatório e longo

---

## Estrutura dos arquivos

```
server.js     → Servidor Node.js (auth Steam + proxy da API)
index.html    → Interface do tracker
script.js     → Lógica do frontend (jogos, conquistas, perfil)
style.css     → Estilos visuais
config.js     → Compatibilidade (vazio, chave está no .env)
.env          → Suas configurações privadas (não sobe pro Git!)
package.json  → Dependências do Node.js
```
