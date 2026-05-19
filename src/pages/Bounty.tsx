import React, { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, query, where, onSnapshot, addDoc, serverTimestamp, 
  orderBy, limit, doc, getDoc, setDoc, deleteDoc, getDocs,
  updateDoc, increment
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, Users, History as HistoryIcon, Play, Swords, 
  Clock, Trophy, Sparkles, Filter, X, 
  Coins, TrendingUp, TrendingDown, Target, Loader2, Star
} from 'lucide-react';

type TimeControl = 'bullet' | 'blitz' | 'rapid';

const AI_NAMES = [
  'GrandmasterBot', 'BountyHunter_AI', 'Silent_Assassin', 
  'Chess_Prophet', 'Stockfish_v15', 'NeuralNet', 'The_Architect'
];

export default function Bounty() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [userCoins, setUserCoins] = useState(0);
  const [totalWon, setTotalWon] = useState(0);
  const [totalLost, setTotalLost] = useState(0);
  const [activeBounties, setActiveBounties] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [openBounties, setOpenBounties] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchStake, setSearchStake] = useState(50);
  const [searchTime, setSearchTime] = useState<TimeControl>('blitz');

  const [isPublicCoins, setIsPublicCoins] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Fetch user stats
    const unsubUser = onSnapshot(doc(db, 'users', user.uid), (d) => {
      if (d.exists()) {
        const data = d.data();
        setUserCoins(data.bountyCoins || 0);
        setTotalWon(data.totalBountyWon || 0);
        setTotalLost(data.totalBountyLost || 0);
        setIsPublicCoins(data.isPublicCoins || false);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
    });

    // Fetch active matches for this user
    const qActive = query(
      collection(db, 'matches'),
      where('status', '==', 'active'),
      where('players', 'array-contains', user.uid),
      where('wagerAmount', '>', 0),
      limit(10)
    );
    const unsubActive = onSnapshot(qActive, (snap) => {
      const active = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setActiveBounties(active);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'matches/active');
    });

    // Fetch open bounties
    const qOpen = query(
      collection(db, 'matches'),
      where('status', '==', 'pending'),
      where('wagerAmount', '>', 0),
      limit(10)
    );
    const unsubOpen = onSnapshot(qOpen, (snap) => {
      const open = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((m: any) => m.playerWhite !== user.uid);
      setOpenBounties(open);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'matches/open');
    });

    // Fetch leaderboard (by total won)
    const qLeader = query(
      collection(db, 'users'),
      where('totalBountyWon', '>', 0),
      orderBy('totalBountyWon', 'desc'),
      limit(10)
    );
    const unsubLeader = onSnapshot(qLeader, (snap) => {
      setLeaderboard(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users/leaderboard');
    });

    // Fetch history
    const qHistory = query(
      collection(db, 'matches'),
      where('status', 'in', ['completed', 'draw']),
      where('players', 'array-contains', user.uid),
      where('wagerAmount', '>', 0),
      orderBy('updatedAt', 'desc'),
      limit(10)
    );
    const unsubHistory = onSnapshot(qHistory, (snap) => {
      const hist = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setHistory(hist);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'matches/history');
    });

    return () => {
      unsubUser();
      unsubActive();
      unsubOpen();
      unsubLeader();
      unsubHistory();
    };
  }, [user]);

  const startBountySearch = async () => {
    if (!user) return;
    if (userCoins < searchStake) {
      alert("Insufficient Bounty Coins!");
      return;
    }

    setIsSearching(true);

    try {
      // Use secure backend API instead of direct Firestore writes
      const response = await fetch('/api/matches/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          wagerAmount: searchStake,
          timeControl: searchTime,
          isRated: true
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create match');
      }

      const { matchId } = result;

      // Simple matchmaking simulation for Bounty logic
      const searchTimeout = setTimeout(async () => {
        // We navigate to the match. The server already created it with status 'pending'
        // and deducted coins (escrow).
        setIsSearching(false);
        navigate(`/match/${matchId}`);
      }, 3000); // Shorter timeout for demo

    } catch (error) {
      console.error("Matchmaking error:", error);
      alert(error instanceof Error ? error.message : "Matchmaking failed");
      setIsSearching(false);
    }
  };

  const cancelSearch = async () => {
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
            description: `Refund for aborted bounty pursuit`,
            timestamp: serverTimestamp()
          });
        }
        await deleteDoc(doc(db, 'matchmaking_queue', user.uid));
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header & Balance Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 bg-black text-white p-8 rounded-[40px] shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-20 transition-transform group-hover:scale-110">
              <Coins size={80} />
            </div>
            <div className="relative z-10">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-500 block mb-2">Available Balance</span>
              <div className="flex items-end gap-3 mb-4">
                <h2 className="text-5xl font-black tracking-tighter">{userCoins.toLocaleString()}</h2>
                <span className="text-yellow-400 font-black text-xs mb-2">BMTC</span>
              </div>
              <button 
                onClick={() => {
                  const newVal = !isPublicCoins;
                  setIsPublicCoins(newVal);
                  updateDoc(doc(db, 'users', user!.uid), { isPublicCoins: newVal });
                }}
                className={`w-full mb-8 py-3 rounded-xl border border-white/10 text-[9px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${isPublicCoins ? 'bg-blue-600/20 text-blue-400' : 'bg-white/5 text-gray-400'}`}
              >
                {isPublicCoins ? 'Coins are Public' : 'Coins are Hidden'}
              </button>
              <div className="flex gap-3">
                <button 
                  onClick={() => navigate('/wallet')}
                  className="flex-1 bg-white text-black py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all text-center"
                >
                  Manage Wallet
                </button>
                <button 
                  onClick={() => navigate('/store')}
                  className="flex-1 bg-white/10 hover:bg-white/20 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-white/10 transition-all text-center"
                >
                  Get Items
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[40px] shadow-xl border border-gray-100 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-400 block mb-6">Performance Stats</span>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-green-600">
                      <TrendingUp size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Won</p>
                      <p className="font-black text-lg tracking-tight">+{totalWon.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center text-red-600">
                      <TrendingDown size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Lost</p>
                      <p className="font-black text-lg tracking-tight">-{totalLost.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mt-8">Platform Fee: 5% per match</p>
          </div>

          <div className="bg-white p-8 rounded-[40px] shadow-xl border border-gray-100 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-[24px] flex items-center justify-center text-blue-600 mb-6 shadow-glow shadow-blue-500/20">
              <Swords size={32} />
            </div>
            <h3 className="font-black text-xl tracking-tighter mb-2">Quick Bounty</h3>
            <p className="text-gray-400 font-medium text-xs mb-6 px-10">Instant high-stakes matchmaking with immediate payout.</p>
            <div className="flex flex-col w-full gap-3">
               <div className="grid grid-cols-3 gap-2">
                  {[10, 50, 100].map(amt => (
                    <button 
                      key={amt}
                      onClick={() => setSearchStake(amt)}
                      className={`py-3 rounded-xl font-black text-[10px] border transition-all ${searchStake === amt ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100'}`}
                    >
                      {amt}
                    </button>
                  ))}
               </div>
               <button 
                onClick={startBountySearch}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xl shadow-blue-500/20"
              >
                <Target size={16} /> Seek Opponent
              </button>
            </div>
          </div>
        </div>

        {/* Main Grid: Active/History & Leaderboard */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          <div className="lg:col-span-8 space-y-8">
            {/* Active Bounties */}
            <div className="bg-white rounded-[40px] shadow-xl border border-gray-100 overflow-hidden">
              <div className="p-8 border-b border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Play className="text-blue-600" size={20} />
                  <h3 className="font-black uppercase tracking-[0.2em] text-xs text-gray-800">My Pursuit</h3>
                </div>
                <span className="text-[10px] font-black text-gray-300 px-3 py-1 bg-gray-50 rounded-full">{activeBounties.length} IN PROGRESS</span>
              </div>
              <div className="p-4">
                {activeBounties.length > 0 ? (
                  <div className="space-y-2">
                    {activeBounties.map(match => (
                      <div 
                        key={match.id}
                        onClick={() => navigate(`/match/${match.id}`)}
                        className="p-6 bg-gray-50/50 hover:bg-white rounded-[28px] border border-transparent hover:border-blue-100 transition-all cursor-pointer flex items-center justify-between group"
                      >
                         <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-gray-400 group-hover:text-blue-600 transition-colors shadow-sm">
                               <Swords size={20} />
                            </div>
                            <div>
                               <p className="font-black tracking-tight text-gray-800">vs {match.playerWhite === user?.uid ? match.playerBlackName : match.playerWhiteName}</p>
                               <div className="flex items-center gap-3 mt-1">
                                  <span className="text-[10px] font-black text-blue-600 py-0.5 px-2 bg-blue-50 rounded-lg uppercase tracking-widest">{match.timeControl}</span>
                                  <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Stake: {match.wagerAmount} BMTC</span>
                               </div>
                            </div>
                         </div>
                         <div className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${match.turn === (match.playerWhite === user?.uid ? 'w' : 'b') ? 'bg-green-500 text-white animate-pulse' : 'bg-gray-100 text-gray-400'}`}>
                            {match.turn === (match.playerWhite === user?.uid ? 'w' : 'b') ? 'Your Turn' : 'Opponent'}
                         </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-20 flex flex-col items-center justify-center opacity-20">
                    <Target size={48} />
                    <p className="mt-4 font-black text-[10px] uppercase tracking-[0.4em]">No active games</p>
                  </div>
                )}
              </div>
            </div>

            {/* Open Bounties List */}
            <div className="bg-white rounded-[40px] shadow-xl border border-gray-100 overflow-hidden">
               <div className="p-8 border-b border-gray-50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Users className="text-gray-400" size={20} />
                    <h3 className="font-black uppercase tracking-[0.2em] text-xs text-gray-800">Open Bounties</h3>
                  </div>
               </div>
               <div className="p-4 space-y-2">
                 {openBounties.map(match => (
                   <div 
                    key={match.id}
                    onClick={() => navigate(`/match/${match.id}`)}
                    className="p-6 bg-gray-50/50 hover:bg-white rounded-[28px] border border-transparent hover:border-blue-100 transition-all cursor-pointer flex items-center justify-between group"
                   >
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
                           <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${match.playerWhite}`} alt="" />
                        </div>
                        <div>
                           <p className="font-black tracking-tight text-gray-800">{match.playerWhiteName}</p>
                           <div className="flex items-center gap-3 mt-1">
                              <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{match.timeControl}</span>
                              <span className="text-[10px] font-black text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-lg uppercase tracking-widest">{match.wagerAmount} BMTC</span>
                           </div>
                        </div>
                     </div>
                     <button className="px-6 py-3 bg-black text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all">Join Game</button>
                   </div>
                 ))}
                 {openBounties.length === 0 && (
                   <div className="py-20 text-center opacity-20">
                     <p className="font-black text-[10px] uppercase tracking-[0.4em]">No open targets</p>
                   </div>
                 )}
               </div>
            </div>

            {/* Bounty History */}
            <div className="bg-white rounded-[40px] shadow-xl border border-gray-100 overflow-hidden">
               <div className="p-8 border-b border-gray-50 flex items-center gap-3">
                  <HistoryIcon className="text-gray-400" size={20} />
                  <h3 className="font-black uppercase tracking-[0.2em] text-xs text-gray-800">Recent Settlement</h3>
               </div>
               <div className="overflow-x-auto">
                 <table className="w-full text-left">
                   <thead>
                     <tr className="border-b border-gray-50">
                       <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Opponent</th>
                       <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Stake</th>
                       <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Result</th>
                       <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Net</th>
                     </tr>
                   </thead>
                   <tbody>
                     {history.map(match => {
                       const amIWhite = match.playerWhite === user?.uid;
                       const result = match.winner === (amIWhite ? 'white' : 'black') ? 'WIN' : (match.winner === 'draw' ? 'DRAW' : 'LOSS');
                       return (
                         <tr key={match.id} className="hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => navigate(`/match/${match.id}`)}>
                           <td className="px-8 py-6">
                             <p className="font-black text-sm tracking-tight text-gray-800">{amIWhite ? match.playerBlackName : match.playerWhiteName}</p>
                             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{new Date(match.updatedAt?.seconds * 1000).toLocaleDateString()}</p>
                           </td>
                           <td className="px-8 py-6">
                             <span className="font-black text-sm text-gray-600">{match.wagerAmount}</span>
                           </td>
                           <td className="px-8 py-6">
                             <span className={`text-[10px] font-black py-1 px-3 rounded-full uppercase tracking-widest ${result === 'WIN' ? 'bg-green-100 text-green-700' : result === 'LOSS' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                               {result}
                             </span>
                           </td>
                           <td className="px-8 py-6">
                             <span className={`font-black text-sm ${result === 'WIN' ? 'text-green-600' : result === 'LOSS' ? 'text-red-600' : 'text-gray-400'}`}>
                               {result === 'WIN' ? `+${Math.floor(match.wagerAmount * 0.95)}` : result === 'LOSS' ? `-${match.wagerAmount}` : '0'}
                             </span>
                           </td>
                         </tr>
                       );
                     })}
                   </tbody>
                 </table>
                 {history.length === 0 && (
                   <div className="py-20 text-center opacity-20">
                     <p className="font-black text-[10px] uppercase tracking-[0.4em]">No recent matches</p>
                   </div>
                 )}
               </div>
            </div>
          </div>

          <div className="lg:col-span-4">
            {/* Leaderboard */}
            <div className="bg-white rounded-[40px] shadow-xl border border-gray-100 overflow-hidden sticky top-32">
               <div className="p-8 border-b border-gray-50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Trophy className="text-yellow-400" size={20} />
                    <h3 className="font-black uppercase tracking-[0.2em] text-xs text-gray-800">Top Earners</h3>
                  </div>
                  <Filter size={16} className="text-gray-300" />
               </div>
               <div className="p-4 space-y-1">
                 {leaderboard.map((player, i) => (
                   <div 
                    key={player.id}
                    className={`p-5 rounded-3xl flex items-center justify-between transition-all group ${player.id === user?.uid ? 'bg-blue-50 border border-blue-100' : 'hover:bg-gray-50'}`}
                   >
                     <div className="flex items-center gap-4">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${i === 0 ? 'bg-yellow-400 text-white' : i === 1 ? 'bg-gray-300 text-white' : i === 2 ? 'bg-orange-400 text-white' : 'text-gray-300'}`}>
                           {i + 1}
                        </div>
                        <div className="w-10 h-10 rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
                           <img src={player.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${player.id}`} alt="" />
                        </div>
                        <div>
                           <p className="font-black text-xs tracking-tight text-gray-800">{player.displayName}</p>
                           <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Rank {i+1}</p>
                        </div>
                     </div>
                     <div className="text-right">
                        <p className="font-black text-green-600 text-xs">
                          {player.isPublicCoins || user?.uid === player.id ? `+${player.totalBountyWon?.toLocaleString()}` : '••••••'}
                        </p>
                        <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Total Won</p>
                     </div>
                   </div>
                 ))}
                 {leaderboard.length === 0 && (
                   <div className="py-20 text-center opacity-20">
                     <Star size={32} className="mx-auto mb-2" />
                     <p className="text-[10px] font-black uppercase tracking-widest">Seeking hunters...</p>
                   </div>
                 )}
               </div>
            </div>
          </div>

        </div>
      </div>

      {/* Matchmaking Overlay */}
      <AnimatePresence>
        {isSearching && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-white"
          >
            <motion.div 
              animate={{ 
                scale: [1, 1.05, 1],
                rotate: [0, 5, -5, 0]
              }}
              transition={{ repeat: Infinity, duration: 4 }}
              className="relative mb-12"
            >
              <div className="w-32 h-32 bg-blue-600 rounded-[48px] flex items-center justify-center text-white shadow-[0_0_50px_rgba(37,99,235,0.4)] relative z-10">
                <Target size={64} className="animate-pulse" />
              </div>
              <motion.div 
                animate={{ scale: [1, 1.5, 1], opacity: [0, 0.2, 0] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="absolute inset-0 bg-blue-600 rounded-[48px] -z-10"
              />
            </motion.div>

            <h2 className="text-4xl font-black tracking-tighter mb-4 text-center">In Pursuit of Bounty</h2>
            <div className="flex items-center gap-3 mb-12 py-2 px-6 bg-white/10 rounded-2xl border border-white/10">
               <Coins size={18} className="text-yellow-400" />
               <span className="font-black text-lg tracking-tight">{searchStake} BMTC Stakes</span>
            </div>

            <p className="text-xs font-black uppercase tracking-[0.4em] text-blue-400 animate-pulse mb-12">Calibrating Opponent Selection...</p>

            <button 
              onClick={cancelSearch}
              className="px-12 py-4 bg-white/5 hover:bg-white/10 rounded-[28px] text-xs font-black uppercase tracking-[0.3em] transition-all border border-white/10 hover:border-white/20 active:scale-95"
            >
              Abort Pursuit
            </button>

            <div className="absolute bottom-12 flex gap-4">
               {[0, 1, 2].map(i => (
                 <motion.div 
                   key={i}
                   animate={{ 
                     y: [0, -10, 0],
                     opacity: [0.2, 1, 0.2]
                   }}
                   transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                   className="w-2 h-2 bg-blue-500 rounded-full"
                 />
               ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
