import React from 'react';

interface Props { children: React.ReactNode }
interface State { hasError: boolean; message: string }

class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            padding: 40,
            fontFamily: 'Inter, system-ui, sans-serif',
            background: '#0e1117',
            color: '#dce3ef',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 48 }}>💥</div>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Algo deu errado</h2>
          <p style={{ fontSize: 13, color: '#8899b4', maxWidth: 420 }}>{this.state.message}</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#3a7acc',
              border: 'none',
              borderRadius: 8,
              padding: '10px 24px',
              color: '#fff',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              marginTop: 8,
            }}
          >
            ↺ Recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
