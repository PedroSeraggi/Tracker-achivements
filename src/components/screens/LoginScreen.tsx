import React from 'react';
import { SteamLogo, TrophyIcon } from '../ui';
import { getLoginUrl } from '../../api/steamApi';

const features = [
  { icon: '🏆', text: 'Acompanhe conquistas de todos os seus jogos' },
  { icon: '💎', text: 'Sistema de troféus Bronze, Prata, Ouro e Platina' },
  { icon: '📖', text: 'Crie e leia guias para desbloquear conquistas difíceis' },
  { icon: '👤', text: 'Perfil gamer com XP, títulos e jogos em destaque' },
];

const LoginScreen: React.FC = () => {
  return (
    <div id="screen-login" className="screen">
      <div className="login-box">
        {/* Logo */}
        <div className="login-logo">
          <TrophyIcon size={60} />
          <h1>
            Steam<br />
            <span>Trophy Tracker</span>
          </h1>
          <p>Conquistas · Guias · Perfil Gamer</p>
        </div>

        {/* Features */}
        <div className="login-features">
          {features.map((f) => (
            <div key={f.icon} className="login-feature">
              <span className="login-feature-icon">{f.icon}</span>
              <span>{f.text}</span>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="login-divider">ENTRAR COM</div>

        {/* Steam Login Button */}
        <a className="btn-steam-login" href={getLoginUrl()}>
          <SteamLogo size={28} />
          Entrar com a Steam
        </a>

        {/* Security notice */}
        <div
          className="login-warn"
          style={{
            background: '#001020',
            borderColor: '#1e3a5f',
            color: '#6a9acc',
            marginTop: 20,
          }}
        >
          <strong>🔒 Segurança:</strong> O login usa o sistema oficial OpenID da Steam — o
          mesmo que grandes sites utilizam. Nunca compartilhamos sua senha ou dados privados.
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
