// =============================================================================
//  src/db/db.js
//
//  Módulo SQLite para o leaderboard global.
//  Usa better-sqlite3 (síncrono, zero deps, rápido).
//
//  Instale:  npm install better-sqlite3
//  TypeDefs: npm install --save-dev @types/better-sqlite3
//
//  Uso no server.js:
//    const db = require('./db/db');
// =============================================================================

'use strict';

const path     = require('path');
const fs       = require('fs');
const Database = require('better-sqlite3');

// ─── Caminho do arquivo .db ───────────────────────────────────────────────────
// Fica na raiz do projeto. Em produção, troque por um volume persistente.
const DB_PATH = path.join(__dirname, '..', '..', 'leaderboard.db');

// Garante que o diretório existe
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// WAL mode: muito mais rápido para leituras concorrentes
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Schema ───────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    steam_id      TEXT PRIMARY KEY,
    persona_name  TEXT    NOT NULL,
    avatar_url    TEXT    NOT NULL DEFAULT '',
    profile_url   TEXT    NOT NULL DEFAULT '',
    is_private    INTEGER NOT NULL DEFAULT 0,
    total_ach     INTEGER NOT NULL DEFAULT 0,
    plat_count    INTEGER NOT NULL DEFAULT 0,
    rare_count    INTEGER NOT NULL DEFAULT 0,
    game_count    INTEGER NOT NULL DEFAULT 0,
    updated_at    INTEGER NOT NULL  -- unix ms timestamp
  );

  CREATE INDEX IF NOT EXISTS idx_players_total_ach
    ON players (total_ach DESC);

  CREATE INDEX IF NOT EXISTS idx_players_updated
    ON players (updated_at DESC);
`);

// ─── Prepared statements (compilados uma vez, reutilizados) ──────────────────

const stmts = {

  /** Upsert completo — cria ou atualiza todos os campos */
  upsertPlayer: db.prepare(`
    INSERT INTO players
      (steam_id, persona_name, avatar_url, profile_url, is_private,
       total_ach, plat_count, rare_count, game_count, updated_at)
    VALUES
      (@steamId, @personaName, @avatarUrl, @profileUrl, @isPrivate,
       @totalAch, @platCount, @rareCount, @gameCount, @updatedAt)
    ON CONFLICT(steam_id) DO UPDATE SET
      persona_name = excluded.persona_name,
      avatar_url   = excluded.avatar_url,
      profile_url  = excluded.profile_url,
      is_private   = excluded.is_private,
      total_ach    = excluded.total_ach,
      plat_count   = excluded.plat_count,
      rare_count   = excluded.rare_count,
      game_count   = excluded.game_count,
      updated_at   = excluded.updated_at
  `),

  /** Atualiza apenas os dados de perfil (sem stats) */
  updateProfile: db.prepare(`
    INSERT INTO players
      (steam_id, persona_name, avatar_url, profile_url, is_private,
       total_ach, plat_count, rare_count, game_count, updated_at)
    VALUES
      (@steamId, @personaName, @avatarUrl, @profileUrl, @isPrivate,
       0, 0, 0, 0, @updatedAt)
    ON CONFLICT(steam_id) DO UPDATE SET
      persona_name = excluded.persona_name,
      avatar_url   = excluded.avatar_url,
      profile_url  = excluded.profile_url,
      is_private   = excluded.is_private
    WHERE players.updated_at < excluded.updated_at OR players.updated_at IS NULL
  `),

  /** Leaderboard global com paginação */
  getGlobal: db.prepare(`
    SELECT
      steam_id,
      persona_name,
      avatar_url,
      profile_url,
      is_private,
      total_ach,
      plat_count,
      rare_count,
      game_count,
      updated_at,
      ROW_NUMBER() OVER (ORDER BY total_ach DESC, updated_at DESC) AS rank
    FROM players
    WHERE total_ach > 0
    ORDER BY total_ach DESC, updated_at DESC
    LIMIT  @limit
    OFFSET @offset
  `),

  /** Total de jogadores com total_ach > 0 */
  countGlobal: db.prepare(`
    SELECT COUNT(*) AS total FROM players WHERE total_ach > 0
  `),

  /** Busca jogadores por nome (para a search bar) */
  searchPlayers: db.prepare(`
    SELECT
      steam_id, persona_name, avatar_url, profile_url, is_private,
      total_ach, plat_count, rare_count, game_count, updated_at
    FROM players
    WHERE total_ach > 0
      AND LOWER(persona_name) LIKE '%' || LOWER(@query) || '%'
    ORDER BY total_ach DESC
    LIMIT 50
  `),

  /** Busca um conjunto de steamIds (para o leaderboard de amigos) */
  getByIds: db.prepare(`
    SELECT
      steam_id, persona_name, avatar_url, profile_url, is_private,
      total_ach, plat_count, rare_count, game_count, updated_at
    FROM players
    WHERE steam_id IN (SELECT value FROM json_each(@ids))
  `),

  /** Posição de um jogador específico no ranking global */
  getRankOf: db.prepare(`
    SELECT COUNT(*) + 1 AS rank
    FROM players
    WHERE total_ach > @totalAch
       OR (total_ach = @totalAch AND updated_at < @updatedAt)
  `),

  /** Um jogador pelo steamId */
  getOne: db.prepare(`
    SELECT * FROM players WHERE steam_id = @steamId
  `),
};

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Upserta stats completos do jogador.
 * Chamado pelo endpoint POST /api/leaderboard/register.
 */
function upsertPlayer(data) {
  stmts.upsertPlayer.run({
    steamId    : data.steamId,
    personaName: data.personaName,
    avatarUrl  : data.avatarUrl   ?? '',
    profileUrl : data.profileUrl  ?? '',
    isPrivate  : data.isPrivate   ? 1 : 0,
    totalAch   : data.totalAch    ?? 0,
    platCount  : data.platCount   ?? 0,
    rareCount  : data.rareCount   ?? 0,
    gameCount  : data.gameCount   ?? 0,
    updatedAt  : Date.now(),
  });
}

/**
 * Atualiza apenas o perfil (sem sobrescrever stats).
 * Chamado no login para manter avatar/nome frescos.
 */
function updateProfile(data) {
  stmts.updateProfile.run({
    steamId    : data.steamId,
    personaName: data.personaName,
    avatarUrl  : data.avatarUrl  ?? '',
    profileUrl : data.profileUrl ?? '',
    isPrivate  : data.isPrivate  ? 1 : 0,
    updatedAt  : Date.now(),
  });
}

/**
 * Retorna página do leaderboard global.
 * @param {number} page  - 1-based
 * @param {number} limit - itens por página (default 50)
 * @returns {{ entries: object[], total: number, page: number, pages: number }}
 */
function getGlobalLeaderboard(page = 1, limit = 50) {
  const offset  = (page - 1) * limit;
  const entries = stmts.getGlobal.all({ limit, offset });
  const { total } = stmts.countGlobal.get();

  return {
    entries: entries.map(rowToEntry),
    total,
    page,
    pages: Math.ceil(total / limit),
  };
}

/**
 * Retorna entradas do leaderboard para um conjunto específico de steamIds.
 * Usado pelo leaderboard de amigos.
 * @param {string[]} steamIds
 * @returns {object[]}
 */
function getPlayersByIds(steamIds) {
  if (!steamIds.length) return [];
  const rows = stmts.getByIds.all({ ids: JSON.stringify(steamIds) });
  return rows.map(rowToEntry);
}

/**
 * Busca jogadores por nome.
 * @param {string} query
 * @returns {object[]}
 */
function searchPlayers(query) {
  return stmts.searchPlayers.all({ query }).map(rowToEntry);
}

/**
 * Posição global de um steamId.
 * @param {string} steamId
 * @returns {number | null}
 */
function getGlobalRank(steamId) {
  const player = stmts.getOne.get({ steamId });
  if (!player || !player.total_ach) return null;
  const { rank } = stmts.getRankOf.get({
    totalAch : player.total_ach,
    updatedAt: player.updated_at,
  });
  return rank;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rowToEntry(row) {
  return {
    steamId     : row.steam_id,
    personaName : row.persona_name,
    avatarUrl   : row.avatar_url,
    profileUrl  : row.profile_url,
    isPrivate   : row.is_private === 1,
    totalAch    : row.total_ach   > 0 ? row.total_ach   : null,
    platCount   : row.plat_count  > 0 ? row.plat_count  : null,
    rareCount   : row.rare_count  > 0 ? row.rare_count  : null,
    gameCount   : row.game_count,
    registeredAt: row.updated_at,
    rank        : row.rank ?? null,
  };
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  upsertPlayer,
  updateProfile,
  getGlobalLeaderboard,
  getPlayersByIds,
  searchPlayers,
  getGlobalRank,
  // Expose raw db for advanced queries if needed
  _db: db,
};
