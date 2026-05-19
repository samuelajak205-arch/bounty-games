import React, { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, query, where, onSnapshot, addDoc, serverTimestamp, 
  orderBy, limit, doc, getDoc, updateDoc, setDoc, deleteDoc, getDocs,
  increment
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, Users, History as HistoryIcon, Play, ChevronRight, Swords, 
  Clock, Trophy, Target, Sparkles, Filter, X, Zap, 
  Coins, Hash, Loader2
} from 'lucide-react';

type TimeControl = 'bullet' | 'blitz' | 'rapid' | 'classical';
type Variant = 'standard' | 'chess960';

const AI_NAMES = [
  'MagnusBot', 'KasparovAI', 'Fisher_44', 'Beth_Harmon_Fan', 
  'ChessWiz', 'DeepBlue_v2', 'EtherealNode', 'AlphaPawn',
  'KnightRider', 'GambitKing', 'CastleCrusher', 'PawnStar'
];

export default function Lobby() {
  const { user } = useAuth();
  const [matches, setMatches] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'bullet' | 'blitz' | 'rapid' | 'classical'>('all');
  const [userCoins, setUserCoins] = useState(0);
  const [userElo, setUserElo] = useState(1200);
  const [isSearching, setIsSearching] = useState(false);
  const navigate = useNavigate();

  // Create match state
  const [newMatch, setNewMatch] = useState({
    timeControl: 'blitz' as TimeControl,
    isRated: true,
    wagerAmount: 0,
    variant: 'standard' as Variant
  });

  useEffect(() => {
    if (!user) return;
    
    // Listen to user balance
    const userUnsubscribe = onSnapshot(doc(db, 'users', user.uid), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setUserCoins(data.bountyCoins || 0);
        setUserElo(data.elo || 1200);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
    });

    // Find open matches or matches you are part of
    const q = query(
      collection(db, 'matches'),
      where('status', 'in', ['pending', 'active']),
      orderBy('updatedAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMatches(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'matches');
    });

    return () => {
      userUnsubscribe();
      unsubscribe();
    };
  }, [user]);

  const createMatch = async () => {
    if (!user) return;
    
    if (newMatch.wagerAmount > userCoins) {
      alert("Insufficient Bounty Coins for this wager!");
      return;
    }

    setIsSearching(true);
    setIsModalOpen(false);

    try {
      const response = await fetch('/api/matches/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          wagerAmount: newMatch.wagerAmount,
          timeControl: newMatch.timeControl,
          isRated: newMatch.isRated,
          variant: newMatch.variant
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to initiate match");
      }

      const { matchId } = await response.json();
      const queueRef = doc(db, 'matchmaking_queue', user.uid);

      // Listen for match assignment (where we are playerBlack)
      const matchesRef = collection(db, 'matches');
      const qMatch = query(
        matchesRef, 
        where('playerBlack', '==', user.uid),
        where('status', '==', 'active'),
        orderBy('createdAt', 'desc'),
        limit(1)
      );

      let isCleanedUp = false;
      const unsubscribeMatch = onSnapshot(qMatch, (snapshot) => {
        if (!snapshot.empty && !isCleanedUp) {
          const matchDoc = snapshot.docs[0];
          isCleanedUp = true;
          clearTimeout(searchTimeout);
          unsubscribeMatch();
          setIsSearching(false);
          navigate(`/match/${matchDoc.id}`);
        }
      });

      const searchTimeout = setTimeout(async () => {
        isCleanedUp = true;
        unsubscribeMatch();
        setIsSearching(false);
        navigate(`/match/${matchId}`);
      }, 10000);

    } catch (error) {
      console.error("Matchmaking error:", error);
      setIsSearching(false);
      alert(error instanceof Error ? error.message : "Matchmaking failed. Please try again.");
    }
  };

  const filteredMatches = matches.filter(m => {
    if (filter === 'all') return true;
    return m.timeControl === filter;
  });

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'active': return 'bg-green-500';
      case 'completed': return 'bg-blue-500';
      case 'draw': return 'bg-gray-400';
      default: return 'bg-orange-400';
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-12 px-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
        <div>
          <h1 className="text-5xl font-black text-[#1D1D1F] dark:text-white tracking-tighter mb-2">Arena</h1>
          <p className="text-gray-500 dark:text-gray-400 font-medium">Categorized battles and coin-wagered matches.</p>
        </div>
        <div className="flex gap-4">
          <div className="hidden lg:flex items-center gap-2 bg-gray-50 dark:bg-gray-900 p-1.5 rounded-2xl border border-gray-100 dark:border-gray-800">
            {['all', 'bullet', 'blitz', 'rapid', 'classical'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f as any)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  filter === f ? 'bg-white dark:bg-gray-800 text-black dark:text-white shadow-sm' : 'text-gray-400 dark:text-gray-500 hover:text-black dark:hover:text-white'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex-1 md:flex-none flex items-center justify-center gap-3 bg-black dark:bg-blue-600 text-white px-8 py-5 rounded-[24px] font-black transition-all hover:scale-105 active:scale-95 shadow-2xl shadow-black/20 dark:shadow-blue-900/20 text-xs uppercase tracking-widest"
          >
            <Plus size={18} />
            Create Challenge
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <section className="lg:col-span-2">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2 text-gray-400 font-black uppercase tracking-[0.3em] text-[10px]">
              <Swords size={12} className="text-blue-600" />
              Live Competitions
            </div>
            <div className="flex items-center gap-4">
               <span className="text-[10px] font-black uppercase tracking-widest text-gray-300">
                 {filteredMatches.length} Tables Active
               </span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredMatches.filter(m => m.status === 'active' || (m.status === 'pending' && m.playerWhite !== user?.uid)).map((match, idx) => (
              <motion.div 
                key={match.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => navigate(`/match/${match.id}`)}
                className="bg-white dark:bg-gray-900 p-6 rounded-[32px] border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-2xl hover:shadow-blue-900/5 transition-all cursor-pointer group relative overflow-hidden"
              >
                {match.wagerAmount > 0 && (
                  <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 px-4 py-1.5 rounded-bl-[20px] text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                    <Coins size={10} />
                    {match.wagerAmount} BC
                  </div>
                )}

                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(match.status)} ${match.status === 'active' ? 'animate-pulse' : ''}`} />
                    <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">{match.timeControl} • {match.isRated ? 'Rated' : 'Casual'}</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between gap-4">
                  <div className="flex flex-col items-center gap-2 flex-1">
                    <div className="w-14 h-14 bg-gray-50 dark:bg-gray-800 rounded-2xl flex items-center justify-center font-black text-gray-400 dark:text-gray-500 border border-gray-100 dark:border-gray-800 text-xl">
                      {match.playerWhiteName?.[0] || 'W'}
                    </div>
                    <div className="text-[11px] font-black tracking-tight text-center truncate w-full dark:text-white">{match.playerWhiteName}</div>
                  </div>
                  
                  <div className="flex flex-col items-center gap-1">
                     <span className="text-[9px] font-black text-gray-200 dark:text-gray-700">VS</span>
                     <div className="bg-gray-50 dark:bg-gray-800 px-2 py-0.5 rounded-full text-[8px] font-black text-gray-400 uppercase">{match.variant}</div>
                  </div>

                  <div className="flex flex-col items-center gap-2 flex-1">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl ${match.playerBlack === 'AI' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-500 border border-dashed border-blue-200 dark:border-blue-800 animate-pulse' : 'bg-gray-50 dark:bg-gray-800 text-gray-400 border border-gray-100 dark:border-gray-800'}`}>
                      {match.playerBlack === 'AI' ? '?' : (match.playerBlackName?.[0] || 'B')}
                    </div>
                    <div className="text-[11px] font-black tracking-tight text-center truncate w-full dark:text-white">
                      {match.playerBlack === 'AI' ? 'Join Now' : match.playerBlackName}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
            
            {filteredMatches.length === 0 && (
              <div className="col-span-full py-32 bg-gray-50/50 border-2 border-dashed border-gray-100 rounded-[40px] flex flex-col items-center justify-center text-gray-300">
                <Target size={40} className="mb-4 opacity-30" />
                <p className="text-sm font-black uppercase tracking-[0.2em] opacity-40">No Matches Found</p>
              </div>
            )}
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-8 text-gray-400 font-black uppercase tracking-[0.3em] text-[10px]">
            <HistoryIcon size={12} className="text-purple-500" />
            Active Bench
          </div>
          <div className="space-y-4">
             {matches.filter(m => m.playerWhite === user?.uid || m.playerBlack === user?.uid).map((match, idx) => (
                <motion.div 
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: idx * 0.1 }}
                  key={match.id}
                  onClick={() => navigate(`/match/${match.id}`)}
                  className="bg-white dark:bg-gray-900 p-6 rounded-[32px] border border-gray-100 dark:border-gray-800 flex items-center justify-between hover:border-blue-400 dark:hover:border-blue-600 cursor-pointer transition-all shadow-sm"
                >
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 bg-black dark:bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-black/10 transition-colors">
                      <Play size={20} />
                    </div>
                    <div>
                      <div className="text-xs font-black tracking-tight mb-1 dark:text-white">
                        Active vs {match.playerWhite === user?.uid ? (match.playerBlack === 'AI' ? 'Searching...' : match.playerBlackName) : match.playerWhiteName}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-blue-600 dark:text-blue-400 font-black uppercase tracking-widest">{match.timeControl}</span>
                        <span className="text-gray-300 dark:text-gray-700">•</span>
                        <span className="text-[9px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">{match.status}</span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-gray-200 dark:text-gray-700" />
                </motion.div>
             ))}
             {matches.filter(m => m.playerWhite === user?.uid || m.playerBlack === user?.uid).length === 0 && (
                <div className="p-8 text-center text-gray-300 border border-dashed border-gray-100 rounded-[32px]">
                   <p className="text-[10px] font-black uppercase tracking-widest">No ongoing games</p>
                </div>
             )}
          </div>
        </section>
      </div>

      {/* Create Match Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-[48px] shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800"
            >
              <div className="p-10">
                <div className="flex items-center justify-between mb-10">
                  <div>
                    <h2 className="text-3xl font-black tracking-tighter mb-1 dark:text-white">New Arena Match</h2>
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">Configure your challenge</p>
                  </div>
                  <button onClick={() => setIsModalOpen(false)} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl text-gray-400 hover:text-black dark:hover:text-white transition-colors">
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-8">
                  {/* Category: Time Control */}
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500 mb-4 block">Time Control</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { id: 'bullet', label: 'Bullet', sub: '< 2m' },
                        { id: 'blitz', label: 'Blitz', sub: '3-5m' },
                        { id: 'rapid', label: 'Rapid', sub: '10m+' },
                        { id: 'classical', label: 'Long', sub: '60m+' }
                      ].map(t => (
                        <button
                          key={t.id}
                          onClick={() => setNewMatch({...newMatch, timeControl: t.id as TimeControl})}
                          className={`flex flex-col items-center justify-center p-5 rounded-[24px] border transition-all ${
                            newMatch.timeControl === t.id ? 'bg-black dark:bg-blue-600 text-white border-black dark:border-blue-600 shadow-xl shadow-blue-500/20' : 'bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:border-gray-200 dark:hover:border-gray-600'
                          }`}
                        >
                          <Zap size={16} className={newMatch.timeControl === t.id ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'} />
                          <span className="font-black text-xs mt-2">{t.label}</span>
                          <span className="text-[9px] font-bold opacity-50">{t.sub}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Category: Wager */}
                  <div>
                    <div className="flex justify-between items-end mb-4">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500 block">Wager Amount</label>
                      <span className="text-[10px] font-black text-yellow-600">You have {userCoins} BC</span>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      {[0, 10, 50, 100].map(v => (
                        <button
                          key={v}
                          onClick={() => setNewMatch({...newMatch, wagerAmount: v})}
                          className={`py-4 rounded-2xl border font-black text-xs transition-all ${
                            newMatch.wagerAmount === v ? 'bg-yellow-400 border-yellow-400 text-yellow-900' : 'bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-400 dark:text-gray-500'
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Category: Rated/Casual */}
                  <div className="flex items-center justify-between p-6 bg-gray-50 dark:bg-gray-800 rounded-[28px] border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white dark:bg-gray-900 rounded-xl flex items-center justify-center text-blue-600 shadow-sm border border-gray-100 dark:border-gray-800">
                        <Trophy size={20} />
                      </div>
                      <div>
                        <div className="text-xs font-black dark:text-white">Rated Match</div>
                        <div className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Affects ELO Score</div>
                      </div>
                    </div>
                    <button 
                      onClick={() => setNewMatch({...newMatch, isRated: !newMatch.isRated})}
                      className={`w-14 h-8 rounded-full flex items-center px-1 transition-colors ${newMatch.isRated ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'}`}
                    >
                      <motion.div 
                        animate={{ x: newMatch.isRated ? 24 : 0 }}
                        className="w-6 h-6 bg-white dark:bg-gray-200 rounded-full shadow-sm"
                      />
                    </button>
                  </div>
                </div>

                <div className="mt-12 flex gap-4">
                  <button 
                    onClick={createMatch}
                    className="flex-1 bg-black dark:bg-blue-600 text-white py-6 rounded-[28px] font-black uppercase tracking-[0.3em] text-xs hover:scale-[1.02] active:scale-95 transition-all shadow-2xl shadow-black/20 dark:shadow-blue-500/20"
                  >
                    Initiate Match
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSearching && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/80 backdrop-blur-xl text-white"
          >
            <motion.div
              animate={{ 
                scale: [1, 1.1, 1],
                opacity: [1, 0.8, 1]
              }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="w-24 h-24 bg-blue-600 rounded-[32px] flex items-center justify-center mb-8 shadow-2xl shadow-blue-500/40 relative"
            >
               <Swords size={40} />
               <motion.div 
                 animate={{ rotate: 360 }}
                 transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                 className="absolute inset-0 border-4 border-white/20 border-t-white rounded-[32px]"
               />
            </motion.div>
            <h2 className="text-3xl font-black tracking-tighter mb-2">Arena Matchmaking</h2>
            <p className="text-xs font-black uppercase tracking-[0.4em] text-blue-400">Searching for Opponent...</p>
            
            <button 
              onClick={async () => {
                setIsSearching(false);
                if (user) {
                  const qSnap = await getDoc(doc(db, 'matchmaking_queue', user.uid));
                  if (qSnap.exists()) {
                    const data = qSnap.data();
                    if (data.wagerAmount > 0) {
                      await updateDoc(doc(db, 'users', user.uid), {
                        bountyCoins: increment(data.wagerAmount)
                      });
                      await addDoc(collection(db, 'transactions'), {
                        userId: user.uid,
                        amount: data.wagerAmount,
                        type: 'purchase',
                        description: `Refund for cancelled match search`,
                        timestamp: serverTimestamp()
                      });
                    }
                    await deleteDoc(doc(db, 'matchmaking_queue', user.uid));
                  }
                }
              }}
              className="mt-12 px-8 py-3 bg-white/10 hover:bg-white/20 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
            >
              Cancel Search
            </button>

            <div className="mt-12 flex gap-2">
               {[0, 1, 2].map(i => (
                 <motion.div 
                   key={i}
                   animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                   transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.2 }}
                   className="w-1.5 h-1.5 bg-white rounded-full"
                 />
               ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
