import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Chess, Square } from 'chess.js';
import { Board } from '../components/Board';
import { motion, AnimatePresence } from 'motion/react';
import { 
  RotateCcw, History as HistoryIcon, BrainCircuit, ChevronLeft,
  Trophy, AlertCircle, Sparkles
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSound } from '../hooks/useSound';

const ChessConstructor = (Chess as any).Chess || Chess;

export default function Practice() {
  const navigate = useNavigate();
  const { playSound } = useSound();
  const [game, setGame] = useState(() => {
    try {
      return new ChessConstructor();
    } catch (e) {
      console.error("Chess instantiation failed:", e);
      return { fen: () => "", turn: () => "w", isGameOver: () => true, history: () => [] } as any;
    }
  });
  const fenRef = useRef(game.fen());
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);

  // Sound effect logic
  useEffect(() => {
    const currentFen = game.fen();
    if (fenRef.current !== currentFen) {
      const isCheck = game.isCheck();
      const isGameOver = game.isGameOver();
      
      if (isGameOver) {
        playSound('gameEnd');
      } else if (isCheck) {
        playSound('check');
      } else {
        const history = game.history({ verbose: true });
        const lastMove = history[history.length - 1];
        if (lastMove && lastMove.captured) {
          playSound('capture');
        } else {
          playSound('move');
        }
      }
      fenRef.current = currentFen;
    }
  }, [game, playSound]);

  function makeAMove(move: any) {
    console.log('Practice: Attempting move:', move);
    console.log('Practice: Current FEN:', game.fen());
    try {
      const result = game.move(move);
      console.log('Practice: Move result:', result);
      if (result) {
        setGame(new ChessConstructor(game.fen()));
        setMoveHistory(game.history());
        return true;
      } else {
        console.warn('Practice: Move was invalid:', move);
      }
    } catch (e) {
      console.error('Practice: Error making move:', e);
    }
    return false;
  }

  const triggerAiMove = useCallback(async () => {
    if (game.isGameOver() || isAiThinking) return;

    setIsAiThinking(true);
    setAiAnalysis(null);

    const res = await fetch('/api/ai/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fen: game.fen(), history: game.history() })
    });
    
    if (res.ok) {
      const result = await res.json();
      if (result && result.move) {
        const success = makeAMove(result.move);
        if (success) {
          setAiAnalysis(result.reasoning);
        } else {
          const moves = game.moves();
          if (moves.length > 0) {
            const randomMove = moves[Math.floor(Math.random() * moves.length)];
            makeAMove(randomMove);
            setAiAnalysis("The AI suggested an invalid move, so I made a random one.");
          }
        }
      }
    } else {
      console.error("AI Move fetch failed");
    }
    setIsAiThinking(false);
  }, [game, isAiThinking]);

  useEffect(() => {
    if (game.turn() === 'b' && !game.isGameOver()) {
      const timer = setTimeout(() => {
        triggerAiMove();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [game, triggerAiMove]);

  function resetGame() {
    try {
      const newGame = new ChessConstructor();
      setGame(newGame);
      setMoveHistory([]);
      setAiAnalysis(null);
    } catch (e) {
      console.error("Reset failed:", e);
    }
  }

  function undoMove() {
    try {
      game.undo();
      game.undo();
      setGame(new ChessConstructor(game.fen()));
      setMoveHistory(game.history());
    } catch (e) {
      console.error("Undo failed:", e);
    }
  }

  const isGameOver = game.isGameOver();
  const isCheck = game.isCheck();

  const getStatus = () => {
    if (game.isCheckmate()) return `Checkmate! ${game.turn() === 'w' ? 'Black' : 'White'} wins!`;
    if (game.isDraw()) return "Draw!";
    if (isCheck) return "Check!";
    if (game.turn() === 'w') return "Your Turn";
    return "Gemini is thinking...";
  };

  const getCustomSquareStyles = () => {
    const styles: Record<string, React.CSSProperties> = {};
    if (isCheck) {
      const kingPos = game.board().flatMap((row, i) => 
        row.map((piece, j) => piece?.type === 'k' && piece?.color === game.turn() ? 
          String.fromCharCode(97 + j) + (8 - i) : null)
      ).find(p => p !== null);
      if (kingPos) {
        styles[kingPos] = {
          background: "radial-gradient(circle, rgba(255,0,0,.5) 0%, rgba(255,0,0,0) 70%)",
          borderRadius: "50%"
        };
      }
    }
    return styles;
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] dark:bg-black p-4 md:p-8 font-sans transition-colors duration-300">
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
                   <h1 className="font-black text-xs uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">Practice Lab</h1>
                   <div className="flex items-center gap-2 mt-1">
                      <div className={`w-2.5 h-2.5 rounded-full ${isAiThinking ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`} />
                      <p className="font-black text-sm tracking-tight dark:text-white">{getStatus()}</p>
                   </div>
                </div>
              </div>

              <div className="px-5 py-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2">
                <Sparkles size={14} />
                v1.0 Engine
              </div>
            </div>

            <div className="relative group">
              <Board 
                position={game.fen()} 
                onPieceDrop={(source, target, piece) => {
                  const isPawnPromotion = (piece === 'wP' && target[1] === '8') || (piece === 'bP' && target[1] === '1');
                  return makeAMove({ from: source, to: target, promotion: isPawnPromotion ? 'q' : undefined });
                }} 
                disabled={game.turn() === 'b' || isGameOver}
                customSquareStyles={getCustomSquareStyles()}
              />
              
              <AnimatePresence>
                {isAiThinking && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-10 bg-white/40 dark:bg-black/40 backdrop-blur-[4px] rounded-[32px] flex items-center justify-center p-8"
                  >
                    <motion.div 
                      key="thinking"
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.9, opacity: 0 }}
                      className="bg-white dark:bg-gray-900 p-8 rounded-[40px] shadow-2xl border border-gray-100 dark:border-gray-800 flex flex-col items-center gap-6"
                    >
                      <div className="relative">
                        <div className="w-20 h-20 bg-blue-600 rounded-[32px] flex items-center justify-center text-white shadow-xl shadow-blue-500/20">
                          <BrainCircuit size={40} className="animate-spin duration-3000" />
                        </div>
                        <motion.div 
                          animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0.6, 0.3] }}
                          transition={{ repeat: Infinity, duration: 2 }}
                          className="absolute -inset-4 bg-blue-500/10 rounded-[48px] -z-10"
                        />
                      </div>
                      <div className="text-center">
                        <span className="text-blue-600 dark:text-blue-400 font-black uppercase tracking-[0.4em] text-[10px] block mb-2">Gemini Thinking</span>
                        <p className="text-gray-400 dark:text-gray-500 font-bold text-xs">Architecting the perfect response...</p>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="mt-10 flex gap-4">
              <button 
                onClick={undoMove} 
                disabled={moveHistory.length < 2 || isAiThinking} 
                className="flex-1 flex items-center justify-center gap-3 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:hover:bg-gray-50 text-gray-700 dark:text-gray-400 py-6 rounded-[28px] transition-all font-black text-xs uppercase tracking-widest active:scale-95 border border-transparent dark:border-gray-800"
              >
                <RotateCcw size={18} /> Undo Move
              </button>
              <button 
                onClick={resetGame} 
                className="flex-1 flex items-center justify-center gap-3 bg-black dark:bg-blue-600 text-white hover:bg-gray-900 dark:hover:bg-blue-700 py-6 rounded-[28px] transition-all font-black text-xs uppercase tracking-widest active:scale-95 shadow-xl shadow-black/10 dark:shadow-blue-900/20"
              >
                <RotateCcw size={18} /> New Game
              </button>
            </div>
          </motion.div>
        </div>

        <div className="lg:col-span-5 space-y-8">
          <AnimatePresence mode="wait">
            {aiAnalysis && (
              <motion.div
                key="analysis" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                className="bg-white dark:bg-gray-900 p-8 rounded-[40px] shadow-xl border border-gray-100 dark:border-gray-800 relative group"
              >
                <div className="absolute -top-4 -left-4 w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                  <Sparkles size={20} />
                </div>
                <div className="pl-6">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="font-black text-[10px] uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">Gemini Strategy Analysis</span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed font-bold italic">
                    "{aiAnalysis}"
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="bg-white dark:bg-gray-900 rounded-[40px] shadow-xl overflow-hidden flex flex-col h-[500px] border border-gray-100 dark:border-gray-800">
            <div className="p-8 bg-[#FAFAFA] dark:bg-black/20 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <HistoryIcon className="text-gray-300 dark:text-gray-600" size={18} />
                <h2 className="font-black text-gray-800 dark:text-gray-200 tracking-tighter uppercase text-[10px] tracking-[0.2em]">Move Log</h2>
              </div>
              <span className="text-[10px] font-black text-gray-300 dark:text-gray-600 px-3 py-1 bg-white dark:bg-black/40 border border-gray-100 dark:border-gray-800 rounded-full">{moveHistory.length} PLIES</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-1">
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
                 <div className="flex flex-col items-center justify-center h-full opacity-20 py-20 grayscale">
                    <HistoryIcon size={48} className="dark:text-white" />
                    <div className="text-[9px] font-black uppercase tracking-[0.3em] mt-6 dark:text-white">Awaiting first move</div>
                 </div>
               )}
            </div>

            {isGameOver && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="p-10 bg-black text-white text-center border-t border-white/10"
              >
                <Trophy className="mx-auto mb-6 text-yellow-400 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]" size={48} />
                <h3 className="font-black text-2xl tracking-tighter mb-2 uppercase">Training Complete</h3>
                <p className="text-gray-500 text-[10px] mb-8 font-bold uppercase tracking-[0.3em]">Game has reached terminal state</p>
                <button onClick={resetGame} className="w-full bg-white text-black py-5 rounded-[24px] font-black uppercase tracking-[0.2em] text-[10px] hover:scale-105 transition-all active:scale-95">Restart Lab</button>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
