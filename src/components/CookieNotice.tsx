import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Info, X } from 'lucide-react';

export const CookieNotice = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('gm-chess-consent');
    if (!consent) {
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const accept = () => {
    localStorage.setItem('gm-chess-consent', 'true');
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div 
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-6 left-6 right-6 z-[100] md:left-auto md:right-12 md:w-[400px]"
        >
          <div className="bg-[#1D1D1F] text-white p-6 rounded-[32px] shadow-2xl border border-white/10 backdrop-blur-xl">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center shrink-0">
                <Info size={20} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-sm mb-1">Privacy & Optimization</h3>
                <p className="text-[11px] text-gray-400 leading-relaxed mb-4">
                  We use cookies to analyze performance and save your match settings. By continuing to use Grandmaster AI, you agree to our data policy.
                </p>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={accept}
                    className="flex-1 bg-white text-black py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-100 transition-colors"
                  >
                    Accept All
                  </button>
                  <button 
                    onClick={() => setIsVisible(false)}
                    className="p-2.5 text-gray-500 hover:text-white transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
