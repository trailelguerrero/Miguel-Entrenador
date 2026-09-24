import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { ToastMessage } from '../types';

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div 
      className="fixed bottom-20 md:bottom-6 right-4 z-50 flex flex-col space-y-2 pointer-events-none max-w-sm w-full px-2 sm:px-0"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isWarning = toast.type === 'warning';
        const isError = toast.type === 'error';
        const isInfo = toast.type === 'info';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto transform transition-all duration-300 ease-out flex items-start space-x-3 p-3.5 rounded-xl border shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-3 ${
              isSuccess
                ? 'bg-zinc-950/95 border-emerald-500/40 text-zinc-100 shadow-emerald-950/30'
                : isWarning
                ? 'bg-zinc-950/95 border-amber-500/40 text-zinc-100 shadow-amber-950/30'
                : isError
                ? 'bg-zinc-950/95 border-red-500/40 text-zinc-100 shadow-red-950/30'
                : 'bg-zinc-950/95 border-cyan-500/40 text-zinc-100 shadow-cyan-950/30'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {isSuccess && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              {isWarning && <AlertTriangle className="w-4 h-4 text-amber-400" />}
              {isError && <AlertCircle className="w-4 h-4 text-red-400" />}
              {isInfo && <Info className="w-4 h-4 text-cyan-400" />}
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold leading-tight tracking-tight text-zinc-100">
                {toast.title}
              </h4>
              {toast.message && (
                <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug line-clamp-3">
                  {toast.message}
                </p>
              )}
            </div>

            <button
              onClick={() => onDismiss(toast.id)}
              className="shrink-0 text-zinc-500 hover:text-zinc-300 transition-colors p-0.5 rounded cursor-pointer"
              aria-label="Cerrar notificación"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
