import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, onSnapshot, updateDoc, serverTimestamp, collection, addDoc, query, orderBy, getDocs, increment, getDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Chess, Square } from 'chess.js';
import { Board } from '../components/Board';
import { AdBanner } from '../components/AdBanner';
import { motion, AnimatePresence } from 'motion/react';
import { 
  RotateCcw, History as HistoryIcon, BrainCircuit, ChevronLeft, 
  Trophy, AlertCircle, Sparkles, LogIn, Clock, 
  Coins, Zap, ShieldAlert, Swords
} from 'lucide-react';

import { useSound } from '../hooks/useSound';

import { MatchChat } from '../components/MatchChat';

const ChessConstructor = (Chess as any).Chess || Chess;

export default function Match() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { playSound } = useSound();
  
  const [matchData, setMatchData] = useState<any>(null);
  const matchDataRef = React.useRef<any>(null);
  const [game, setGame] = useState(() => {
    try {
      return new ChessConstructor();
    } catch (e) {
      console.error("Match Chess instantiation failed:", e);
      return { fen: () => "", turn: () => "w", isGameOver: () => true, history: () => [] } as any;
    }
  });
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'moves' | 'chat'>('moves');

  useEffect(() => {
    if (!id || !user) return;

    const unsubscribe = onSnapshot(doc(db, 'matches', id), async (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        
        // Play sound if FEN has changed
        if (matchDataRef.current && data.fen !== matchDataRef.current.fen) {
          console.log("FEN changed, attempting to play sound...");
          const nextGame = new ChessConstructor(data.fen);
          
          // Determine move type
          const isCheck = nextGame.isCheck();
          const isGameOver = nextGame.isGameOver();
          
          if (isGameOver) {
            console.log("Playing sound: gameEnd");
            playSound('gameEnd');
          } else if (isCheck) {
            console.log("Playing sound: check");
            playSound('check');
          } else {
            const history = nextGame.history({ verbose: true });
            const lastMove = history[history.length - 1];
            if (lastMove && lastMove.captured) {
              console.log("Playing sound: capture");
              playSound('capture');
            } else {
              console.log("Playing sound: move");
              playSound('move');
            }
          }
        }

        matchDataRef.current = data;
        setMatchData(data);
        setGame(new ChessConstructor(data.fen));
        
        // Join match if it's pending and we are not white
        const isWaitingForOpponent = data.playerBlack === 'Searching...';
        if (data.status === 'pending' && isWaitingForOpponent && data.playerWhite !== user.uid) {
           // Use the secure join API
           fetch('/api/matches/join', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ matchId: id, userId: user.uid })
           })
           .then(res => res.json())
           .then(resData => {
             if (resData.error) {
               alert(resData.error);
               navigate('/');
             }
           })
           .catch(err => {
             console.error("Match Join Error:", err);
             navigate('/');
           });
        }
      } else {
        navigate('/');
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `matches/${id}`);
    });

    return () => unsubscribe();
  }, [id, user, navigate]);

  useEffect(() => {
    // Fetch move history
    if (!id) return;
    const q = query(collection(db, 'matches', id, 'moves'), orderBy('moveNumber', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const history = snapshot.docs.map(d => d.data().san);
      setMoveHistory(history);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, `matches/${id}/moves`);
    });
    return () => unsubscribe();
  }, [id]);

  const onMove = async ({ from, to, promotion }: { from: Square; to: Square; promotion?: string }) => {
    console.log('Match: onMove called', { from, to, promotion, matchDataStatus: matchData?.status });
    if (!matchData || matchData.status !== 'active') {
      console.log('Match: Move blocked - match not active');
      return false;
    }
    
    // Check if it's our turn
    const ourTurn = (matchData.turn === 'w' && user?.uid === matchData.playerWhite) ||
                   (matchData.turn === 'b' && user?.uid === matchData.playerBlack);
    
    console.log('Match: ourTurn', ourTurn);
    if (!ourTurn) return false;

    try {
      const gameCopy = new ChessConstructor(game.fen());
      const move = gameCopy.move({ from, to, promotion: promotion || 'q' });
      console.log('Match: move validation', move);
      if (!move) return false;

      // Update local state optimistically
      setGame(gameCopy);

      // Use the secure move API
      const response = await fetch('/api/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId: id,
          userId: user.uid,
          move: { from, to, promotion: promotion || 'q' }
        })
      });

      const result = await response.json();
      console.log('Match: API response', response.status, result);
      if (!response.ok) {
        throw new Error(result.error || 'Move rejected by server');
      }

      return true;
    } catch (e) {
      console.error('Match: Move failed', e);
      alert(e instanceof Error ? e.message : "Move failed");
      return false;
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F7]">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2 }} className="text-gray-300">
        <RotateCcw size={48} />
      </motion.div>
    </div>
  );

  const orientation = user?.uid === matchData?.playerBlack ? 'black' : 'white';
  const isOurTurn = (matchData?.turn === 'w' && user?.uid === matchData?.playerWhite) ||
                    (matchData?.turn === 'b' && user?.uid === matchData?.playerBlack);

  return (
    <div className="min-h-screen bg-[#F5F5F7] dark:bg-[#000000] p-4 md:p-8 font-sans transition-colors duration-300">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 flex flex-col items-center">
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-[640px] bg-white dark:bg-gray-900 p-8 rounded-[48px] shadow-2xl shadow-gray-200 dark:shadow-none border border-gray-100 dark:border-gray-800"
          >
            <div className="mb-8 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button onClick={() => navigate('/')} className="p-3 text-gray-400 hover:text-black dark:hover:text-white transition-colors rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800 border border-gray-100 dark:border-gray-800">
                  <ChevronLeft size={20} />
                </button>
                <div>
                   <div className="flex items-center gap-2">
                     <h1 className="font-black text-xs uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">Arena Match</h1>
                     <div className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-md text-[9px] font-black uppercase">{matchData?.timeControl}</div>
                   </div>
                   <div className="flex items-center gap-3 mt-1">
                      <div className={`w-2 h-2 rounded-full ${matchData?.status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-orange-400'}`} />
                      <p className="font-black text-sm tracking-tight dark:text-white">{matchData?.isRated ? 'Rated Competition' : 'Casual Game'}</p>
                   </div>
                </div>
              </div>

              {matchData?.wagerAmount > 0 && (
                <div className="bg-yellow-400 text-yellow-900 px-5 py-2.5 rounded-2xl flex items-center gap-2 font-black text-xs uppercase tracking-widest shadow-lg shadow-yellow-500/10">
                   <Coins size={14} />
                   {matchData.wagerAmount} BC Pot
                </div>
              )}
            </div>

            <Board 
              position={game.fen()} 
              onPieceDrop={(source, target) => onMove({ from: source as Square, to: target as Square })} 
              orientation={orientation} 
              disabled={!isOurTurn || matchData?.status !== 'active'} 
            />

            <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className={`p-6 rounded-[32px] border transition-all ${orientation === 'white' ? 'border-blue-200 dark:border-blue-800 bg-blue-50/20 dark:bg-blue-900/10' : 'border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-900/30'}`}>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500 mb-3 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-sm bg-white border border-gray-200 dark:border-gray-700" />
                    White Player
                  </div>
                  <div className="flex items-center justify-between leading-tight">
                    <span className="font-black text-lg tracking-tighter dark:text-white">{matchData?.playerWhiteName}</span>
                    <span className="text-[10px] font-black text-gray-300 dark:text-gray-600">#{matchData?.playerWhite?.slice(0, 4)}</span>
                  </div>
               </div>
               <div className={`p-6 rounded-[32px] border transition-all ${orientation === 'black' ? 'border-blue-200 dark:border-blue-800 bg-blue-50/20 dark:bg-blue-900/10' : 'border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-900/30'}`}>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500 mb-3 flex items-center gap-2 justify-end">
                    Black Player
                    <div className="w-2 h-2 rounded-sm bg-black dark:bg-gray-200" />
                  </div>
                  <div className="flex items-center justify-between leading-tight">
                    <span className="text-[10px] font-black text-gray-300 dark:text-gray-600">#{matchData?.playerBlack?.slice(0, 4)}</span>
                    <span className="font-black text-lg tracking-tighter dark:text-white">
                      {matchData?.playerBlack === 'Searching...' ? (
                        <span className="animate-pulse">Searching...</span>
                      ) : matchData?.playerBlackName}
                    </span>
                  </div>
               </div>
            </div>
          </motion.div>
        </div>

        <div className="lg:col-span-5 space-y-8">
          {/* Status HUD */}
          <div className="bg-white dark:bg-gray-900 p-8 rounded-[40px] border border-gray-100 dark:border-gray-800 shadow-xl">
             <div className="grid grid-cols-2 gap-8">
               <div className="flex flex-col gap-1">
                 <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">Time Limit</span>
                 <div className="flex items-center gap-2 font-black text-xl dark:text-white">
                    <Clock size={20} className="text-blue-500" />
                    {matchData?.timeControl === 'bullet' ? '2m' : matchData?.timeControl === 'blitz' ? '5m' : '15m'}
                 </div>
               </div>
               <div className="flex flex-col gap-1">
                 <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">Rating Mode</span>
                 <div className="flex items-center gap-2 font-black text-xl dark:text-white">
                    <Trophy size={20} className="text-yellow-500" />
                    {matchData?.isRated ? 'ELITE' : 'CASUAL'}
                 </div>
               </div>
             </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-[40px] shadow-xl overflow-hidden flex flex-col h-[500px] border border-gray-100 dark:border-gray-800">
            <div className="p-2 bg-[#FAFAFA] dark:bg-black/20 border-b border-gray-100 dark:border-gray-800 flex gap-2">
              <button 
                onClick={() => setActiveTab('moves')}
                className={`flex-1 py-4 rounded-[28px] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'moves' ? 'bg-white dark:bg-gray-800 text-black dark:text-white shadow-sm' : 'text-gray-400 hover:text-black dark:hover:text-white'}`}
              >
                Timeline
              </button>
              <button 
                onClick={() => setActiveTab('chat')}
                className={`flex-1 py-4 rounded-[28px] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'chat' ? 'bg-white dark:bg-gray-800 text-black dark:text-white shadow-sm' : 'text-gray-400 hover:text-black dark:hover:text-white'}`}
              >
                Chat
              </button>
            </div>
            
            <div className="flex-1 overflow-hidden relative">
              <AnimatePresence mode="wait">
                {activeTab === 'moves' ? (
                  <motion.div 
                    key="moves"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="h-full overflow-y-auto p-6 space-y-1"
                  >
                    {Array.from({ length: Math.ceil(moveHistory.length / 2) }).map((_, i) => (
                      <div key={i} className="grid grid-cols-2 gap-2">
                        <div className="bg-gray-50/50 dark:bg-gray-800/50 p-4 rounded-2xl flex items-center justify-between group hover:bg-white dark:hover:bg-gray-800 hover:border-blue-100 dark:hover:border-blue-900 border border-transparent transition-all">
                          <span className="text-[9px] font-black text-gray-200 dark:text-gray-700">{i + 1}.</span>
                          <span className="font-mono font-black text-gray-600 dark:text-gray-400 group-hover:text-black dark:group-hover:text-white">{moveHistory[i * 2]}</span>
                        </div>
                        {moveHistory[i * 2 + 1] && (
                          <div className="bg-blue-50/10 dark:bg-blue-900/10 p-4 rounded-2xl flex items-center justify-end border border-transparent hover:border-blue-200 dark:hover:border-blue-800 transition-all">
                            <span className="font-mono font-black text-blue-600 dark:text-blue-400">{moveHistory[i * 2 + 1]}</span>
                          </div>
                        )}
                      </div>
                    ))}
                    {moveHistory.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-full opacity-20 py-20">
                         <Zap size={32} />
                         <div className="text-[9px] font-black uppercase tracking-widest mt-4">Game pending...</div>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div 
                    key="chat"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="h-full"
                  >
                    <MatchChat matchId={id || ''} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence>
              {matchData?.status === 'completed' && (
                <motion.div 
                  initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }}
                  className="p-10 bg-black text-white text-center relative z-10"
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-yellow-400" />
                  <Trophy className="mx-auto mb-6 text-yellow-500 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]" size={48} />
                  <h3 className="font-black text-3xl tracking-tighter mb-2">Match Terminal</h3>
                  <p className="text-gray-400 text-[10px] mb-10 uppercase tracking-[0.3em] font-black">
                    {matchData.winner === 'Draw' ? 'Equilibrium Reached' : `${matchData.winner} Dominance`}
                  </p>
                  
                  {matchData.wagerAmount > 0 && (
                    <div className="mb-8 p-4 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-between">
                       <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Wager Delta</span>
                       <span className={`font-black tracking-tight ${
                         (matchData.winner === 'White' && orientation === 'white') || (matchData.winner === 'Black' && orientation === 'black') 
                         ? 'text-green-400' : 'text-red-400'}`}>
                         {matchData.winner === 'Draw' ? '0 BC' : `${matchData.winner === 'White' && orientation === 'white' ? '+' : '-'}${matchData.wagerAmount} BC`}
                       </span>
                    </div>
                  )}

                  <button onClick={() => navigate('/')} className="w-full bg-white text-black py-5 rounded-[24px] font-black uppercase tracking-[0.2em] text-[10px] mb-2 hover:scale-105 transition-all active:scale-95">
                    Exit Arena
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <AdBanner slot="match-bottom" className="rounded-[40px]" />
        </div>
      </div>
    </div>
  );
}
