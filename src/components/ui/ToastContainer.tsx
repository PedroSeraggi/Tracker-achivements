import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { Toast, ToastKind } from '../../types';

const ICONS: Record<ToastKind, string> = {
  success: '✓',
  error:   '✕',
  info:    'ℹ',
};

const COLORS: Record<ToastKind, { bg: string; border: string; icon: string }> = {
  success: { bg: '#0a2218', border: '#22cc6644', icon: '#22cc66' },
  error:   { bg: '#200a0a', border: '#f8717144', icon: '#f87171' },
  info:    { bg: '#001020', border: '#3a7acc44', icon: '#3a7acc' },
};

const ToastItem: React.FC<{ toast: Toast }> = ({ toast }) => {
  const removeToast = useAppStore((s) => s.removeToast);
  const c = COLORS[toast.kind];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 10,
        padding: '12px 16px',
        minWidth: 260,
        maxWidth: 380,
        boxShadow: '0 8px 24px #00000060',
        animation: 'slideInRight .25s ease',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 13,
        color: '#dce3ef',
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: c.icon + '22',
          border: `1.5px solid ${c.icon}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 900,
          color: c.icon,
          flexShrink: 0,
        }}
      >
        {ICONS[toast.kind]}
      </span>
      <span style={{ flex: 1, lineHeight: 1.4 }}>{toast.message}</span>
      <button
        onClick={() => removeToast(toast.id)}
        style={{
          color: '#4d607a',
          fontSize: 14,
          padding: '2px 4px',
          flexShrink: 0,
          lineHeight: 1,
        }}
      >
        ✕
      </button>
    </div>
  );
};

const ToastContainer: React.FC = () => {
  const toasts = useAppStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(40px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
      <div
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          alignItems: 'flex-end',
        }}
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} />
        ))}
      </div>
    </>
  );
};

export default ToastContainer;
