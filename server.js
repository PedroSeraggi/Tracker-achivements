// ══════════════════════════════════════════════════════════
//  Steam Trophy Tracker — Servidor Node.js
//  Autenticação via Steam OpenID + Proxy da API Steam
// ══════════════════════════════════════════════════════════

require('dotenv').config();

const express    = require('express');
const session    = require('express-session');
const passport   = require('passport');
const Steam      = require('passport-steam').Strategy;
const fetch      = require('node-fetch');
const path       = require('path');

const app     = express();
const PORT    = process.env.PORT    || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// ── Validação de variáveis obrigatórias ──
if (!process.env.STEAM_API_KEY || process.env.STEAM_API_KEY === 'SUA_CHAVE_AQUI') {
  console.error('\n❌ ERRO: STEAM_API_KEY não configurada!');
  console.error('   Copie o arquivo .env.example para .env e preencha sua chave.\n');
  process.exit(1);
}

// ══════════════════════════════════════════════════════════
//  PASSPORT — Steam OpenID
// ══════════════════════════════════════════════════════════

passport.use(new Steam(
  {
    returnURL : `${BASE_URL}/auth/steam/callback`,
    realm     : `${BASE_URL}/`,
    apiKey    : process.env.STEAM_API_KEY,
  },
  // Callback chamado após autenticação bem-sucedida
  (identifier, profile, done) => {
    // profile._json contém todos os dados do perfil Steam
    const user = {
      steamId      : profile.id,
      personaname  : profile.displayName,
      avatar       : profile._json.avatarfull || profile._json.avatar || '',
      profileurl   : profile._json.profileurl || '',
      realname     : profile._json.realname   || '',
      loccountrycode: profile._json.loccountrycode || '',
    };
    return done(null, user);
  }
));

// Serializa o usuário para a sessão (salva apenas o steamId)
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// ══════════════════════════════════════════════════════════
//  MIDDLEWARES
// ══════════════════════════════════════════════════════════

app.use(express.json());

// Sessão com cookie seguro
app.use(session({
  secret           : process.env.SESSION_SECRET || 'steam-tracker-dev-secret',
  resave           : false,
  saveUninitialized: false,
  cookie           : {
    maxAge  : 7 * 24 * 60 * 60 * 1000, // 7 dias
    secure  : BASE_URL.startsWith('https'),
    httpOnly: true,
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// Servir os arquivos estáticos do projeto (HTML, CSS, JS)
app.use(express.static(path.join(__dirname)));

// ══════════════════════════════════════════════════════════
//  ROTAS DE AUTENTICAÇÃO
// ══════════════════════════════════════════════════════════

// Inicia o fluxo OpenID — redireciona para a Steam
app.get('/auth/steam', passport.authenticate('steam', { failureRedirect: '/' }));

// Callback após login na Steam
app.get(
  '/auth/steam/callback',
  passport.authenticate('steam', { failureRedirect: '/?login_error=1' }),
  (req, res) => {
    // Login bem-sucedido — volta para a página principal
    res.redirect('/');
  }
);

// Logout
app.post('/api/logout', (req, res) => {
  req.logout(() => {
    req.session.destroy();
    res.json({ ok: true });
  });
});

// ══════════════════════════════════════════════════════════
//  ROTAS DA API
// ══════════════════════════════════════════════════════════

// Middleware: garante que o usuário está autenticado
function requireAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ error: 'Não autenticado', redirect: '/auth/steam' });
}

// Retorna os dados do usuário logado
app.get('/api/me', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({
      steamId      : req.user.steamId,
      personaname  : req.user.personaname,
      avatar       : req.user.avatar,
      profileurl   : req.user.profileurl,
      realname     : req.user.realname,
      loccountrycode: req.user.loccountrycode,
    });
  } else {
    res.json({ steamId: null });
  }
});

// ── Proxy para a API da Steam ──────────────────────────────
// O frontend envia a URL da Steam sem a API Key.
// O servidor adiciona a chave e repassa a requisição.
app.get('/api/steam', requireAuth, async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Parâmetro url obrigatório' });

  try {
    // Reconstrói a URL adicionando a API Key do servidor
    const targetUrl = new URL(decodeURIComponent(url));
    targetUrl.searchParams.set('key', process.env.STEAM_API_KEY);

    const response = await fetch(targetUrl.toString(), {
      headers: { 'Accept': 'application/json' },
      timeout: 15000,
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Steam API retornou ${response.status}` });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Erro no proxy Steam:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════
//  INICIAR SERVIDOR
// ══════════════════════════════════════════════════════════

app.listen(PORT, () => {
  console.log('\n🏆 Steam Trophy Tracker rodando!');
  console.log(`   Acesse: ${BASE_URL}`);
  console.log(`   Para logar com a Steam: ${BASE_URL}/auth/steam\n`);
});
