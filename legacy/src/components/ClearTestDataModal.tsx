import React from 'react';
import { ShieldCheck, AlertTriangle, Trash2, X, CheckCircle2, Database, User } from 'lucide-react';
import { StorageService } from '../services/storage';

interface ClearTestDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmClearSampleOnly: () => void;
  onConfirmClearAll: () => void;
}

export const ClearTestDataModal: React.FC<ClearTestDataModalProps> = ({
  isOpen,
  onClose,
  onConfirmClearSampleOnly,
  onConfirmClearAll,
}) => {
  if (!isOpen) return null;

  const counts = StorageService.getDataCounts();

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-lg w-full p-6 sm:p-7 space-y-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-zinc-400 hover:text-zinc-200 p-1.5 rounded-xl hover:bg-zinc-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-start space-x-3.5">
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-400 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Gestión de Datos & Privacidad</span>
            <h3 className="text-lg font-black text-zinc-100">¿Qué deseas eliminar?</h3>
            <p className="text-xs text-zinc-400 mt-1">
              Tu entrenamiento real está protegido. Elige si quieres retirar únicamente los ejemplos o resetear el calendario.
            </p>
          </div>
        </div>

        {/* Current Data Status Summary */}
        <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 grid grid-cols-2 gap-3 text-xs">
          <div className="space-y-1">
            <span className="text-[10px] text-zinc-500 uppercase font-bold">Datos de Muestra (Demo)</span>
            <div className="text-sm font-black text-amber-400">{counts.sampleWorkouts} sesiones</div>
            <span className="text-[10px] text-zinc-400">Entrenamientos precargados</span>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] text-zinc-500 uppercase font-bold">Tus Datos Reales</span>
            <div className="text-sm font-black text-emerald-400">
              {counts.userWorkouts > 0 ? `${counts.userWorkouts} sesiones creadas` : 'Aún sin sesiones propias'}
            </div>
            <span className="text-[10px] text-zinc-400">
              {counts.userWeights > 0 ? `${counts.userWeights} pesajes propios` : 'Perfil configurado'}
            </span>
          </div>
        </div>

        {/* Action Options */}
        <div className="space-y-3">
          
          {/* Option 1: Safe Sample Cleanup (Recommended) */}
          <button
            onClick={() => {
              onConfirmClearSampleOnly();
              onClose();
            }}
            className="w-full text-left p-4 rounded-2xl bg-zinc-950 hover:bg-zinc-800/80 border border-emerald-900/50 hover:border-emerald-500/50 transition group space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-emerald-400 flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Borrar SOLO datos de prueba (Recomendado)</span>
              </span>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-300 font-bold px-2 py-0.5 rounded-md">
                100% Seguro
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 group-hover:text-zinc-300 leading-relaxed pl-6">
              Elimina únicamente los entrenamientos de muestra precargados. 
              <strong> Tus entrenamientos reales, check-ins de hoy y pesajes se conservan intactos.</strong>
            </p>
          </button>

          {/* Option 2: Total Reset */}
          <button
            onClick={() => {
              onConfirmClearAll();
              onClose();
            }}
            className="w-full text-left p-4 rounded-2xl bg-zinc-950 hover:bg-red-950/20 border border-zinc-800 hover:border-red-800/50 transition group space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-zinc-300 group-hover:text-red-400 flex items-center space-x-2">
                <Trash2 className="w-4 h-4 text-zinc-500 group-hover:text-red-400" />
                <span>Vaciar todo el calendario (Lienzo en blanco)</span>
              </span>
              <span className="text-[10px] text-zinc-500">
                Reinicio total
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 group-hover:text-zinc-400 leading-relaxed pl-6">
              Limpia todas las sesiones para que empieces desde cero con tus propios entrenamientos o sincronización con Suunto.
            </p>
          </button>

        </div>

        {/* Protection Guarantee Notice */}
        <div className="bg-zinc-950/70 p-3 rounded-xl border border-zinc-800/80 flex items-start space-x-2.5 text-[11px] text-zinc-400 leading-relaxed">
          <User className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>
            <strong className="text-zinc-200">Datos que NUNCA se pierden: </strong>
            Tu perfil de atleta (altura, peso, FC reposo y máxima, umbrales AeT/AnT), tu objetivo de Transvulcania 73K y la memoria/aprendizajes con Miguel permanecen siempre a salvo.
          </span>
        </div>

        {/* Footer cancel button */}
        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
          >
            Cancelar
          </button>
        </div>

      </div>
    </div>
  );
};
