import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]); // { id, type, title, message }

  const remove = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const api = useMemo(() => ({
    show: ({ type = 'info', title, message, timeout = 2500 } = {}) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((t) => [...t, { id, type, title, message }]);
      if (timeout) setTimeout(() => remove(id), timeout);
    },
    success: (opts) => api.show({ ...opts, type: 'success' }),
    error: (opts) => api.show({ ...opts, type: 'error', timeout: 4000 }),
    info: (opts) => api.show({ ...opts, type: 'info' }),
  }), [remove]);

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="fixed z-[9999] top-4 right-4 space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={[
              'min-w-[260px] max-w-sm rounded-lg border shadow px-4 py-3 text-sm backdrop-blur bg-white/90',
              t.type === 'success' ? 'border-green-200 text-green-900' : '',
              t.type === 'error' ? 'border-red-200 text-red-900' : '',
              t.type === 'info' ? 'border-gray-200 text-gray-900' : '',
            ].join(' ')}
          >
            {t.title && <div className="font-medium mb-0.5">{t.title}</div>}
            {t.message && <div className="opacity-80">{t.message}</div>}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
