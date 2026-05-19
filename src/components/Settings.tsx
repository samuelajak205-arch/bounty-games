import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useSettings } from '../contexts/SettingsContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Settings as SettingsIcon, Sun, Moon, Monitor, X,
  Eye, Volume2, Hash, Zap, BookOpen, ChevronRight, ArrowLeft, ShieldAlert,
  Coins, TrendingUp, Wallet, Info
} from 'lucide-react';

export const Settings = () => {
  const { theme, setTheme } = useTheme();
  const { settings, updateSettings } = useSettings();
  const [isOpen, setIsOpen] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [activeTab, setActiveTab] = useState<'rules' | 'economy'>('rules');

  const themeOptions = [
    { id: 'light', label: 'Light', icon: Sun },
    { id: 'dark', label: 'Dark', icon: Moon },
    { id: 'system', label: 'System', icon: Monitor },
  ];

  const functionalSettings = [
    { id: 'showLegalMoves', label: 'Show Guides', icon: Eye, description: 'Visual indicators for valid moves' },
    { id: 'soundEnabled', label: 'Sound FX', icon: Volume2, description: 'Audio feedback for moves and status' },
    { id: 'showCoordinates', label: 'Notation', icon: Hash, description: 'Rank and file board coordinates' },
    { id: 'autoPromotion', label: 'Auto Queen', icon: Zap, description: 'Promote naturally to Queen' },
  ];

  return (
    <>
      {/* Floating Settings Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-white dark:bg-gray-900 shadow-2xl rounded-2xl flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition-all border border-gray-100 dark:border-gray-800 z-50 group"
      >
        <SettingsIcon className="group-hover:rotate-90 transition-transform duration-500" size={24} />
      </button>

      {/* Rules Modal Overlay */}
      <AnimatePresence>
        {showRules && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRules(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-md"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl max-h-[85vh] bg-white dark:bg-gray-900 rounded-[48px] shadow-2xl p-0 overflow-hidden border border-gray-100 dark:border-gray-800 flex flex-col"
            >
              <div className="p-8 border-b border-gray-50 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-gray-900 sticky top-0 z-10">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setShowRules(false)}
                    className="p-3 bg-gray-50 dark:bg-gray-800 rounded-2xl text-gray-400 hover:text-black dark:hover:text-white transition-all shadow-sm"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <div>
                    <h3 className="text-2xl font-black tracking-tighter dark:text-white">Chess Manual</h3>
                    <div className="flex gap-4 mt-2">
                       <button 
                         onClick={() => setActiveTab('rules')}
                         className={`text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${activeTab === 'rules' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                       >
                         Rules & Tactics
                       </button>
                       <button 
                         onClick={() => setActiveTab('economy')}
                         className={`text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${activeTab === 'economy' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                       >
                         Bounty Economy
                       </button>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setShowRules(false)}
                  className="p-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition-colors text-gray-400"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-10 space-y-12">
                {activeTab === 'rules' ? (
                  <>
                    {/* section: goal */}
                    <div>
                      <div className="flex items-center gap-3 mb-6">
                          <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                            <Zap size={16} fill="currentColor" />
                          </div>
                          <h4 className="font-black text-sm uppercase tracking-widest dark:text-white">The Ultimate Goal</h4>
                      </div>
                      <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed font-medium">
                        Checkmate your opponent's king. This means the king is under attack (<span className="text-blue-600 font-bold italic">check</span>) and has no escape routes. 
                        In <span className="dark:text-white font-bold">Bounty Chess</span>, reaching this state claims the wagered pot.
                      </p>
                    </div>

                    {/* section: basic moves */}
                    <div>
                      <div className="flex items-center gap-3 mb-8">
                          <div className="w-8 h-8 bg-black dark:bg-blue-600 rounded-xl flex items-center justify-center text-white">
                            <Monitor size={16} />
                          </div>
                          <h4 className="font-black text-sm uppercase tracking-widest dark:text-white">Basic Manifolds</h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                          { piece: 'Pawn', desc: 'Forward 1 (or 2 on start). Captures diagonally.' },
                          { piece: 'Knight', desc: 'L-shape (2+1). The only piece to jump over others.' },
                          { piece: 'Bishop', desc: 'Any distance diagonally. Bound to its starting color.' },
                          { piece: 'Rook', desc: 'Any distance horizontally or vertically. Sturdy power.' },
                          { piece: 'Queen', desc: 'Combined power of Rook and Bishop. Most versatile.' },
                          { piece: 'King', desc: 'One square in any direction. Must avoid check.' }
                        ].map(p => (
                          <div key={p.piece} className="p-5 bg-gray-50 dark:bg-gray-800/50 rounded-3xl border border-gray-100 dark:border-gray-800">
                            <span className="block text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">{p.piece}</span>
                            <p className="text-xs font-bold text-gray-600 dark:text-gray-400 leading-snug">{p.desc}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* section: special rules */}
                    <div className="p-8 bg-black dark:bg-blue-600 rounded-[40px] text-white">
                      <h4 className="font-black text-sm uppercase tracking-[0.2em] mb-8">Tactical Maneuvers</h4>
                      <div className="space-y-6">
                        <div>
                          <span className="text-[10px] font-black text-blue-400 dark:text-blue-300 uppercase block mb-1">Castling</span>
                          <p className="text-xs font-medium text-gray-300">King moves two squares to Rook, Rook jumps over. Neither must have moved prior.</p>
                        </div>
                        <div>
                          <span className="text-[10px] font-black text-blue-400 dark:text-blue-300 uppercase block mb-1">En Passant</span>
                          <p className="text-xs font-medium text-gray-300">Pawn capture that occurs after a double-step move. Must be executed immediately.</p>
                        </div>
                        <div>
                          <span className="text-[10px] font-black text-blue-400 dark:text-blue-300 uppercase block mb-1">Promotion</span>
                          <p className="text-xs font-medium text-gray-300">Reaching the final rank transforms a Pawn into any piece (usually the Queen).</p>
                        </div>
                      </div>
                    </div>

                    {/* section: termination */}
                    <div>
                      <div className="flex items-center gap-3 mb-8">
                          <div className="w-8 h-8 bg-red-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-red-500/20">
                            <X size={16} />
                          </div>
                          <h4 className="font-black text-sm uppercase tracking-widest dark:text-white">Game Terminations</h4>
                      </div>
                      <div className="space-y-4">
                        {[
                          { type: 'Checkmate', result: 'Win', desc: 'King is under attack with no legal escape.' },
                          { type: 'Stalemate', result: 'Draw', desc: 'No legal moves left, but King is NOT in check.' },
                          { type: 'Resignation', result: 'Win', desc: 'One player voluntarily ends the match.' },
                          { type: 'Timeout', result: 'Loss', desc: 'Clock reaches zero (w/ sufficient material).' },
                          { type: 'Agreement', result: 'Draw', desc: 'Both rivals agree to share the spoils.' },
                          { type: 'Repetition', result: 'Draw', desc: 'The exact position occurs three times.' },
                          { type: 'Fifty-Move', result: 'Draw', desc: '50 moves without capture or pawn advance.' },
                          { type: 'Insufficient', result: 'Draw', desc: 'Not enough pieces left to force a mate.' },
                        ].map(t => (
                            <div key={t.type} className="flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded-2xl border-b border-gray-50 dark:border-gray-800 last:border-0">
                              <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${t.result === 'Win' ? 'bg-green-100 text-green-700' : t.result === 'Draw' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                                  {t.result}
                              </div>
                              <div className="flex-1">
                                  <span className="block text-xs font-black dark:text-white tracking-tight">{t.type}</span>
                                  <p className="text-[10px] font-medium text-gray-400">{t.desc}</p>
                              </div>
                            </div>
                        ))}
                      </div>
                    </div>

                    {/* section: ethics */}
                    <div className="p-8 bg-blue-50 dark:bg-blue-900/10 rounded-[32px] border border-blue-100 dark:border-blue-900/30">
                      <div className="flex items-center gap-3 mb-4">
                          <ShieldAlert className="text-blue-600" size={20} />
                          <h4 className="font-black text-xs uppercase tracking-widest text-blue-900 dark:text-blue-100">Integrity Protocol</h4>
                      </div>
                      <ul className="space-y-3 text-[11px] font-bold text-blue-800/70 dark:text-blue-200/70 leading-relaxed list-disc pl-4">
                        <li>Engine assistance of any kind results in immediate disqualification and permanent ban.</li>
                        <li>Disconnection during a wagered match results in a technical forfeit after the grace period.</li>
                        <li>Intentional rating manipulation (sandbagging) is monitored and penalized.</li>
                      </ul>
                    </div>
                  </>
                ) : (
                  <>
                    {/* section: what are bc */}
                    <div>
                      <div className="flex items-center gap-3 mb-6">
                          <div className="w-8 h-8 bg-yellow-400 rounded-xl flex items-center justify-center text-yellow-900 shadow-lg shadow-yellow-400/20">
                            <Coins size={16} />
                          </div>
                          <h4 className="font-black text-sm uppercase tracking-widest dark:text-white">Bounty Coins (BC)</h4>
                      </div>
                      <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed font-medium">
                        Bounty Coins are the lifeblood of the <span className="font-black dark:text-white">Arena</span>. 
                        They represent your accumulated skill and strategic achievements. Used to initiate high-stakes matches and unlock premium features.
                      </p>
                      <div className="mt-6 p-6 bg-yellow-50 dark:bg-yellow-900/10 rounded-3xl border border-yellow-100 dark:border-yellow-900/30">
                        <div className="flex items-center gap-3 mb-2">
                           <Info className="text-yellow-600" size={16} />
                           <span className="text-[10px] font-black uppercase text-yellow-800 dark:text-yellow-200">Legal Notice</span>
                        </div>
                        <p className="text-[10px] font-bold text-yellow-700/80 dark:text-yellow-300/80 leading-relaxed">
                          BC are virtual tokens for entertainment ONLY. They have no real-world cash value and cannot be withdrawn or exchanged for legal tender.
                        </p>
                      </div>
                    </div>

                    {/* section: earning */}
                    <div>
                      <div className="flex items-center gap-3 mb-8">
                          <div className="w-8 h-8 bg-green-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-green-500/20">
                            <TrendingUp size={16} />
                          </div>
                          <h4 className="font-black text-sm uppercase tracking-widest dark:text-white">Revenue Channels</h4>
                      </div>
                      <div className="space-y-4">
                        {[
                          { title: 'Daily Bonus', desc: 'Secure 5-10 BC every 24 hours just by appearing.' },
                          { title: 'Quests', desc: 'Solve tactical puzzles and win ranked games for rewards.' },
                          { title: 'The Arena', desc: 'Claim the combined pot in coin-wagered matches.' },
                          { title: 'Tournaments', desc: 'Top finishers in grand events receive massive BC yields.' }
                        ].map(e => (
                           <div key={e.title} className="p-5 bg-gray-50 dark:bg-gray-800/50 rounded-3xl border border-gray-100 dark:border-gray-800">
                             <div className="flex items-center justify-between mb-1">
                               <span className="text-xs font-black dark:text-white tracking-tight">{e.title}</span>
                               <span className="text-[8px] font-black uppercase text-green-600">Active</span>
                             </div>
                             <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">{e.desc}</p>
                           </div>
                        ))}
                      </div>
                    </div>

                    {/* section: economics */}
                    <div className="p-8 bg-blue-600 rounded-[40px] text-white">
                       <h4 className="font-black text-sm uppercase tracking-[0.2em] mb-8 text-blue-100">Market Dynamics</h4>
                       <div className="space-y-8">
                          <div className="flex items-start gap-4">
                             <div className="p-2 bg-blue-500 rounded-lg"><Zap size={16} /></div>
                             <div>
                                <span className="block text-[10px] font-black uppercase mb-1">Yield Structure</span>
                                <p className="text-xs font-medium text-blue-50">Winners claim the full pot minus a <span className="font-black underline">5% platform fee</span> used to maintain the Grandmaster AI infrastructure.</p>
                             </div>
                          </div>
                          <div className="flex items-start gap-4">
                             <div className="p-2 bg-blue-500 rounded-lg"><Wallet size={16} /></div>
                             <div>
                                <span className="block text-[10px] font-black uppercase mb-1">Utility Scope</span>
                                <p className="text-xs font-medium text-blue-50">BC can be used for Arena entry fees, cosmetic themes, and unlocking advanced Gemini analytical tools.</p>
                             </div>
                          </div>
                       </div>
                    </div>

                    {/* section: worth */}
                    <div className="text-center py-6 px-10 bg-gray-50 dark:bg-gray-800/50 rounded-[40px] border border-gray-100 dark:border-gray-800">
                       <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Subjective Equilibrium</span>
                       <p className="text-sm font-bold text-gray-600 dark:text-gray-300 leading-relaxed italic">
                         "The value of BC isn't found in currency, but in the sweat of the match and the glory of the climb."
                       </p>
                    </div>
                  </>
                )}
              </div>

              <div className="p-8 bg-gray-50 dark:bg-black/20 text-center">
                 <p className="text-[9px] font-black text-gray-400 dark:text-gray-600 uppercase tracking-[0.3em]">Master your craft • Bounty Chess</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, y: 100, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.95 }}
              className="relative w-full max-w-sm bg-white dark:bg-gray-900 rounded-[40px] shadow-2xl p-8 border border-gray-100 dark:border-gray-800"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-black tracking-tighter dark:text-white">Settings</h3>
                  <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mt-1">Customize Your Pursuit</p>
                </div>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors dark:text-gray-400 font-black"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-8">
                {/* Theme Section */}
                <div>
                  <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">Appearance</p>
                  <div className="grid grid-cols-3 gap-3">
                    {themeOptions.map((opt) => {
                      const Icon = opt.icon;
                      const isActive = theme === opt.id;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => setTheme(opt.id as any)}
                          className={`flex flex-col items-center gap-3 p-4 rounded-3xl border transition-all ${
                            isActive 
                              ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20' 
                              : 'bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-blue-300'
                          }`}
                        >
                          <Icon size={18} />
                          <span className="text-[9px] font-black uppercase tracking-widest">{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Functional Settings Section */}
                <div>
                  <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">Gameplay & Audio</p>
                  <div className="space-y-3">
                    {functionalSettings.map((s) => {
                      const Icon = s.icon;
                      const isEnabled = (settings as any)[s.id];
                      return (
                        <button
                          key={s.id}
                          onClick={() => updateSettings({ [s.id]: !isEnabled })}
                          className={`w-full flex items-center justify-between p-4 rounded-[24px] border transition-all ${
                            isEnabled 
                              ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30' 
                              : 'bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700'
                          }`}
                        >
                          <div className="flex items-center gap-4 text-left">
                            <div className={`p-2 rounded-xl ${isEnabled ? 'bg-white text-blue-600 shadow-sm' : 'bg-gray-100 dark:bg-gray-700 text-gray-400'}`}>
                              <Icon size={18} />
                            </div>
                            <div>
                               <p className={`text-xs font-black tracking-tight ${isEnabled ? 'text-blue-900 dark:text-blue-100' : 'text-gray-500 dark:text-white'}`}>{s.label}</p>
                               <p className="text-[9px] font-medium text-gray-400">{s.description}</p>
                            </div>
                          </div>
                          
                          <div className={`w-10 h-6 rounded-full flex items-center px-1 transition-colors ${isEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`}>
                            <motion.div 
                              animate={{ x: isEnabled ? 16 : 0 }}
                              className="w-4 h-4 bg-white rounded-full shadow-sm"
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Rules Section */}
                <div>
                  <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">Resources</p>
                  <button
                    onClick={() => setShowRules(true)}
                    className="w-full flex items-center justify-between p-5 rounded-[28px] bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-600 transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2.5 bg-white dark:bg-gray-900 rounded-xl text-blue-600 shadow-sm border border-gray-100 dark:border-gray-800 group-hover:scale-110 transition-transform">
                        <BookOpen size={20} />
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-black dark:text-white">Chess Manual</p>
                        <p className="text-[9px] font-medium text-gray-400">Rules, tactics & terminations</p>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-gray-300 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>

                <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                   <p className="text-[10px] font-black text-gray-300 dark:text-gray-600 uppercase tracking-widest text-center">Version 1.2.0 • Bounty Chess</p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
