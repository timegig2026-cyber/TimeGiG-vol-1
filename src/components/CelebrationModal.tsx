import React from 'react';
import { Sparkles, Coins, DollarSign } from 'lucide-react';

interface CelebrationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onClose?: () => void;
  buttonText?: string;
}

export const CelebrationModal: React.FC<CelebrationModalProps> = ({
  isOpen,
  title,
  message,
  onClose,
  buttonText = "Continue"
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-hidden animate-fadeIn">
      {/* Floating Bubbles, Coins & Paper Money Background Animation Layer */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Bubbles */}
        {[...Array(18)].map((_, i) => (
          <div
            key={`bubble-${i}`}
            className="absolute rounded-full bg-white/30 backdrop-blur-xs border border-white/40 animate-floatUp"
            style={{
              width: `${Math.random() * 32 + 10}px`,
              height: `${Math.random() * 32 + 10}px`,
              left: `${Math.random() * 100}%`,
              bottom: `-60px`,
              animationDuration: `${Math.random() * 2.5 + 2}s`,
              animationDelay: `${Math.random() * 2}s`,
            }}
          />
        ))}

        {/* Shimmering Gold Coins */}
        {[...Array(12)].map((_, i) => (
          <div
            key={`coin-${i}`}
            className="absolute text-amber-500 animate-coinFall flex items-center justify-center font-bold text-xs bg-amber-300 rounded-full shadow-lg border border-amber-100"
            style={{
              width: `${Math.random() * 18 + 22}px`,
              height: `${Math.random() * 18 + 22}px`,
              left: `${Math.random() * 100}%`,
              top: `-40px`,
              animationDuration: `${Math.random() * 2 + 1.8}s`,
              animationDelay: `${Math.random() * 1.5}s`,
            }}
          >
            🪙
          </div>
        ))}

        {/* Fluttering Paper Money ($ Notes) */}
        {[...Array(10)].map((_, i) => (
          <div
            key={`cash-${i}`}
            className="absolute bg-emerald-600 text-white font-mono text-[10px] font-bold px-2 py-1 rounded-md shadow-2xl border border-emerald-400 animate-cashFall flex items-center gap-1"
            style={{
              left: `${Math.random() * 100}%`,
              top: `-60px`,
              animationDuration: `${Math.random() * 2.5 + 2}s`,
              animationDelay: `${Math.random() * 1.8}s`,
            }}
          >
            <DollarSign className="w-3 h-3 text-emerald-200" />
            <span>$100</span>
          </div>
        ))}
      </div>

      {/* Modal Card */}
      <div className="relative z-10 bg-white/95 backdrop-blur-xl rounded-[32px] p-8 max-w-sm w-full text-center space-y-6 shadow-2xl border border-amber-200/60 animate-scaleIn">
        {/* Glow & Floating Icon */}
        <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-tr from-amber-400 to-emerald-400 rounded-3xl blur-xl opacity-60 animate-pulse"></div>
          <div className="relative w-20 h-20 bg-gradient-to-br from-amber-50 to-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center shadow-lg border border-amber-200/80 rotate-3 animate-bounce">
            <Coins className="w-10 h-10 text-amber-500 animate-spin-slow" />
            <Sparkles className="absolute -top-1 -right-1 w-5 h-5 text-amber-500 animate-ping" />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-black bg-gradient-to-r from-neutral-900 via-emerald-800 to-amber-700 bg-clip-text text-transparent">
            {title}
          </h2>
          <p className="text-sm text-neutral-600 leading-relaxed font-medium">
            {message}
          </p>
        </div>

        {onClose && (
          <div className="pt-2">
            <button
              onClick={onClose}
              className="w-full py-4 bg-gradient-to-r from-neutral-900 to-neutral-800 hover:from-black hover:to-neutral-900 text-white rounded-2xl font-bold shadow-xl shadow-neutral-900/20 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center space-x-2"
            >
              <span>{buttonText}</span>
              <Sparkles className="w-4 h-4 text-amber-400" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
