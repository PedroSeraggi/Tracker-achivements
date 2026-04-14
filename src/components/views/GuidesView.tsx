import React, { useState, useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Empty } from '../ui';
import type { Guide } from '../../types';
import { generateGuideId } from '../../api/steamApi';

// ─── Guide List ───────────────────────────────────────────────────────────────
const GuidesList: React.FC = () => {
  const guides          = useAppStore((s) => s.guides);
  const games           = useAppStore((s) => s.games);
  const openGuideCreator = useAppStore((s) => s.openGuideCreator);
  const openGuideReader  = useAppStore((s) => s.openGuideReader);
  const deleteGuide      = useAppStore((s) => s.deleteGuide);
  const currentUser      = useAppStore((s) => s.currentUser);
  const addToast         = useAppStore((s) => s.addToast);

  const [search, setSearch]   = useState('');
  const [gameFilter, setGame] = useState('');

  const filtered = useMemo(
    () =>
      guides.filter((g) => {
        const matchText =
          !search ||
          g.title.toLowerCase().includes(search.toLowerCase()) ||
          g.gameName?.toLowerCase().includes(search.toLowerCase());
        const matchGame = !gameFilter || String(g.gameAppId) === gameFilter;
        return matchText && matchGame;
      }),
    [guides, search, gameFilter]
  );

  return (
    <div id="guides-list-view">
      <div className="guides-topbar">
        <div>
          <h2 className="guides-heading">📖 Guias da Comunidade</h2>
          <p className="guides-sub">Crie guias passo a passo para ajudar outros jogadores</p>
        </div>
        <button className="btn-create-guide" onClick={() => openGuideCreator()}>
          + Criar Guia
        </button>
      </div>

      <div className="guides-filter-bar">
        <input
          type="text"
          className="guide-search-input"
          placeholder="🔍 Buscar guias..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="guide-game-select"
          value={gameFilter}
          onChange={(e) => setGame(e.target.value)}
        >
          <option value="">Todos os jogos</option>
          {games.map((g) => (
            <option key={g.appId} value={String(g.appId)}>
              {g.name}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <Empty
          icon="📖"
          title="Nenhum guia encontrado"
          sub="Seja o primeiro a criar um guia!"
        />
      ) : (
        <div className="guides-grid">
          {filtered.map((guide) => (
            <GuideCard
              key={guide.id}
              guide={guide}
              isOwner={guide.authorSteamId === currentUser?.steamId}
              onRead={() => openGuideReader(guide)}
              onEdit={() => openGuideCreator(guide)}
              onDelete={() => { deleteGuide(guide.id); addToast('info', 'Guia removido.'); }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Guide Card ───────────────────────────────────────────────────────────────
interface GuideCardProps {
  guide: Guide;
  isOwner: boolean;
  onRead: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const GuideCard: React.FC<GuideCardProps> = ({ guide, isOwner, onRead, onEdit, onDelete }) => (
  <div className="guide-card" style={{ cursor: 'pointer' }} onClick={onRead}>
    <div className="guide-card-header">
      <div className="guide-card-title">{guide.title}</div>
      {isOwner && (
        <div
          style={{ display: 'flex', gap: 6 }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="btn-sm"
            onClick={onEdit}
            style={{ fontSize: 11, padding: '3px 8px' }}
          >
            ✎
          </button>
          <button
            className="btn-sm"
            onClick={onDelete}
            style={{ fontSize: 11, padding: '3px 8px', color: '#f87171' }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
    {guide.gameName && (
      <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 4 }}>
        🎮 {guide.gameName}
        {guide.achievementName && ` · 🏆 ${guide.achievementName}`}
      </div>
    )}
    <div style={{ fontSize: 12, color: 'var(--txt2)', marginTop: 8 }}>
      {guide.steps.length} passo{guide.steps.length !== 1 ? 's' : ''} ·{' '}
      {new Date(guide.createdAt).toLocaleDateString('pt-BR')}
    </div>
    <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 4 }}>
      por {guide.authorName}
    </div>
  </div>
);

// ─── Guide Creator / Editor ────────────────────────────────────────────────────
const GuideCreator: React.FC = () => {
  const editingGuide      = useAppStore((s) => s.editingGuide);
  const setEditingGuide   = useAppStore((s) => s.setEditingGuide);
  const addGuideStep      = useAppStore((s) => s.addGuideStep);
  const removeGuideStep   = useAppStore((s) => s.removeGuideStep);
  const updateGuideStep   = useAppStore((s) => s.updateGuideStep);
  const closeGuideCreator = useAppStore((s) => s.closeGuideCreator);
  const addGuide          = useAppStore((s) => s.addGuide);
  const updateGuide       = useAppStore((s) => s.updateGuide);
  const guideView         = useAppStore((s) => s.guideView);
  const games             = useAppStore((s) => s.games);
  const currentUser       = useAppStore((s) => s.currentUser);
  const addToast          = useAppStore((s) => s.addToast);

  if (!editingGuide) return null;

  const selectedGame = games.find((g) => g.appId === editingGuide.gameAppId);

  const handleSave = () => {
    if (!editingGuide.title?.trim()) {
      addToast('error', 'O título do guia é obrigatório.');
      return;
    }
    if (!editingGuide.steps?.length) {
      addToast('error', 'Adicione pelo menos um passo ao guia.');
      return;
    }

    const now = Date.now();
    if (guideView === 'edit' && editingGuide.id) {
      updateGuide({ ...(editingGuide as Guide), updatedAt: now });
      addToast('success', 'Guia atualizado com sucesso!');
    } else {
      addGuide({
        ...(editingGuide as Guide),
        id: generateGuideId(),
        authorSteamId: currentUser?.steamId ?? 'local',
        authorName: currentUser?.personaName ?? 'Você',
        createdAt: now,
        updatedAt: now,
      });
      addToast('success', 'Guia criado com sucesso!');
    }
    closeGuideCreator();
  };

  return (
    <div id="guides-create-view">
      <div className="guide-creator-topbar">
        <button className="detail-back" onClick={closeGuideCreator}>
          ← Voltar aos Guias
        </button>
        <h2 className="guides-heading">
          {guideView === 'edit' ? 'Editar Guia' : 'Criar Novo Guia'}
        </h2>
      </div>

      <div className="guide-form">
        {/* Header fields */}
        <div className="guide-form-header">
          <div className="form-row">
            <div className="form-group-inline" style={{ flex: 2 }}>
              <label className="form-label">Título do Guia</label>
              <input
                type="text"
                className="guide-input"
                placeholder="ex: Como conseguir todas as conquistas..."
                value={editingGuide.title ?? ''}
                onChange={(e) => setEditingGuide({ title: e.target.value })}
              />
            </div>
            <div className="form-group-inline" style={{ flex: 1 }}>
              <label className="form-label">Jogo (opcional)</label>
              <select
                className="guide-input guide-select"
                value={editingGuide.gameAppId ?? ''}
                onChange={(e) => {
                  const appId = e.target.value ? Number(e.target.value) : undefined;
                  const game = games.find((g) => g.appId === appId);
                  setEditingGuide({
                    gameAppId: appId,
                    gameName: game?.name,
                    achievementApiName: undefined,
                    achievementName: undefined,
                  });
                }}
              >
                <option value="">— Selecione um jogo —</option>
                {games.map((g) => (
                  <option key={g.appId} value={g.appId}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedGame && (
            <div className="form-row" style={{ marginTop: 12 }}>
              <div className="form-group-inline" style={{ flex: 1 }}>
                <label className="form-label">Conquista (opcional)</label>
                <select
                  className="guide-input guide-select"
                  value={editingGuide.achievementApiName ?? ''}
                  onChange={(e) => {
                    const ach = selectedGame.achievements.find(
                      (a) => a.apiName === e.target.value
                    );
                    setEditingGuide({
                      achievementApiName: ach?.apiName,
                      achievementName: ach?.displayName,
                    });
                  }}
                >
                  <option value="">— Guia geral do jogo —</option>
                  {selectedGame.achievements.map((a) => (
                    <option key={a.apiName} value={a.apiName}>
                      {a.displayName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Steps */}
        <div id="guide-steps-container">
          {(editingGuide.steps ?? []).map((step, idx) => (
            <div
              key={step.id}
              style={{
                background: 'var(--bg2)',
                border: '1px solid var(--b2)',
                borderRadius: 10,
                padding: '16px',
                marginBottom: 12,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontWeight: 700, color: 'var(--txt2)', fontSize: 13 }}>
                  Passo {idx + 1}
                </span>
                <button
                  className="btn-sm"
                  onClick={() => removeGuideStep(idx)}
                  style={{ color: '#f87171', fontSize: 11 }}
                >
                  Remover
                </button>
              </div>
              <input
                type="text"
                className="guide-input"
                placeholder="Título do passo..."
                value={step.title}
                onChange={(e) => updateGuideStep(idx, { title: e.target.value })}
                style={{ marginBottom: 8 }}
              />
              <textarea
                className="guide-input"
                placeholder="Descrição detalhada..."
                value={step.content}
                rows={3}
                onChange={(e) => updateGuideStep(idx, { content: e.target.value })}
                style={{ resize: 'vertical' }}
              />
            </div>
          ))}
        </div>

        <button className="btn-add-step" onClick={addGuideStep}>
          + Adicionar Passo
        </button>

        <div className="guide-save-row">
          <button className="btn-modal secondary" onClick={closeGuideCreator}>
            Cancelar
          </button>
          <button className="btn-save-guide" onClick={handleSave}>
            💾 Salvar Guia
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Guide Reader ─────────────────────────────────────────────────────────────
const GuideReader: React.FC = () => {
  const guide            = useAppStore((s) => s.readingGuide);
  const closeGuideReader = useAppStore((s) => s.closeGuideReader);

  if (!guide) return null;

  return (
    <div id="guides-read-view">
      <button className="detail-back" onClick={closeGuideReader}>
        ← Voltar aos Guias
      </button>

      <div
        id="guide-reader-content"
        style={{ maxWidth: 720, margin: '0 auto', padding: '0 20px 60px' }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 8 }}>
          {guide.title}
        </h1>
        {guide.gameName && (
          <div style={{ fontSize: 13, color: 'var(--txt2)', marginBottom: 4 }}>
            🎮 {guide.gameName}
            {guide.achievementName && ` · 🏆 ${guide.achievementName}`}
          </div>
        )}
        <div style={{ fontSize: 12, color: 'var(--txt3)', marginBottom: 28 }}>
          por {guide.authorName} ·{' '}
          {new Date(guide.createdAt).toLocaleDateString('pt-BR')}
        </div>

        {guide.steps.map((step, idx) => (
          <div
            key={step.id}
            style={{
              background: 'var(--bg2)',
              border: '1px solid var(--b2)',
              borderRadius: 12,
              padding: '20px 22px',
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: 'var(--accent)',
                fontWeight: 700,
                letterSpacing: 2,
                marginBottom: 6,
              }}
            >
              PASSO {idx + 1}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 8 }}>
              {step.title}
            </div>
            <div style={{ fontSize: 14, color: 'var(--txt2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {step.content}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── GuidesView (router) ──────────────────────────────────────────────────────
const GuidesView: React.FC = () => {
  const guideView = useAppStore((s) => s.guideView);

  return (
    <div id="view-guides">
      {guideView === 'list'              && <GuidesList />}
      {(guideView === 'create' || guideView === 'edit') && <GuideCreator />}
      {guideView === 'read'              && <GuideReader />}
    </div>
  );
};

export default GuidesView;
