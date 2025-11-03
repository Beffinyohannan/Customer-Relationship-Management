import React from 'react';

export default function Modal({ open, title, children, onClose, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded shadow-lg w-[92vw] max-w-md mx-auto p-4">
        {title && <h3 className="font-semibold mb-2">{title}</h3>}
        <div className="text-sm text-gray-700">
          {children}
        </div>
        {footer && (
          <div className="mt-4 flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
