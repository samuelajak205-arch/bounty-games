import React, { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, query, where, onSnapshot, addDoc, serverTimestamp, 
  orderBy, limit, doc, getDoc, updateDoc, increment
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, Users, Clock, Swords, 
  ChevronLeft, History as HistoryIcon, Star,
  Search, ShieldAlert, Sparkles,
  Zap, ArrowRight, Loader2, Coins
} from 'lucide-react';

export default function TournamentArena() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [myParticipant, setMyParticipant] = useState<any>(null);
  const [activeMatch, setActiveMatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !user) return;

    // Fetch tournament
    const unsubTournament = onSnapshot(doc(db, 'tournaments', id), (d) => {
      if (d.exists()) setTournament({ id: d.id, ...d.data() });
      setLoading(false);
    });

    // Fetch participants
    const unsubParticipants = onSnapshot(
      query(collection(db, 'tournaments', id, 'participants'), orderBy('score', 'desc')),
      (snap) => {
        const parts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setParticipants(parts);
        setMyParticipant(parts.find(p => p.id === user.uid));
      }
    );

    // Fetch active match in this tournament for me
    const qMatch = query(
      collection(db, 'matches'),
      where('tournamentId', '==', id),
      where('status', '==', 'active')
    );
    const unsubMatch = onSnapshot(qMatch, (snap) => {
      const match = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .find((m: any) => m.playerWhite === user.uid || m.playerBlack === user.uid);
      setActiveMatch(match);
    });

    return () => {
      unsubTournament();
      unsubParticipants();
      unsubMatch();
    };
  }, [id, user]);

  const seekMatch = async () => {
    if (!user || !id || activeMatch) return;

    // Simulating pairing: Look for other participants with status 'registered' and no active match
    // In a real app, this would be a backend job.
    // We'll just create a match or wait.
    
    // For demo: randomly pair with "AI" if no human found after 5s or just create pair if another human is "seeking"
    // Let's use the matchmaking_queue but with a tournamentId flag
    try {
        const matchRef = await addDoc(collection(db, 'matches'), {
            playerWhite: user.uid,
            playerWhiteName: user.displayName || 'Challenger',
            playerBlack: 'AI',
            playerBlackName: tournament?.type === 'bounty' ? 'Disguised Grandmaster' : 'Standard AI',
            status: 'active',
            tournamentId: id,
            timeControl: tournament?.timeControl || '10+0',
            isRated: true,
            wagerAmount: 0, // Fee is already paid via tournament entry
            variant: 'standard',
            fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            turn: 'w',
            players: [user.uid, 'AI'],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        navigate(`/match/${matchRef.id}`);
    } catch (e) {
        console.error(e);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F7]">
      <Loader2 className="animate-spin text-blue-600" size={48} />
    </div>
  );

  if (!tournament) return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F7] p-8">
      <div className="text-center">
        <ShieldAlert className="mx-auto mb-4 text-red-500" size={48} />
        <h2 className="text-2xl font-black">Tournament not found</h2>
        <button onClick={() => navigate('/tournaments')} className="mt-4 text-blue-600 font-bold">Return to Hub</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F5F5F7] p-4 md:p-8">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Sidebar: Tournament Info & Controls */}
        <div className="lg:col-span-4 space-y-8">
          <motion.div 
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
            className="bg-white p-10 rounded-[48px] shadow-xl border border-gray-100"
          >
            <button onClick={() => navigate('/tournaments')} className="p-3 text-gray-400 hover:text-black transition-colors rounded-2xl hover:bg-gray-50 border border-gray-100 mb-8">
              <ChevronLeft size={20} />
            </button>

            <div className="mb-10">
              <div className="flex items-center gap-2 text-blue-600 mb-3">
                <Sparkles size={16} />
                <span className="text-[10px] font-black uppercase tracking-[0.3em]">{tournament.type} • {tournament.format}</span>
              </div>
              <h1 className="text-4xl font-black tracking-tighter leading-none mb-4">{tournament.title}</h1>
              <div className="flex items-center gap-4 py-3 px-6 bg-gray-50 rounded-2xl border border-gray-100">
                <Clock size={16} className="text-gray-400" />
                <span className="text-xs font-black text-gray-600 uppercase tracking-widest">{tournament.timeControl} Time Control</span>
              </div>
            </div>

            <div className="space-y-6 mb-10">
               <div className="flex items-center justify-between p-6 bg-blue-50 rounded-3xl border border-blue-100">
                  <div>
                    <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Prize Pool</p>
                    <p className="text-2xl font-black text-blue-800 tracking-tight">{tournament.prizePool.toLocaleString()} BMTC</p>
                  </div>
                  <Trophy size={32} className="text-yellow-500" />
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div className="p-5 bg-gray-50 rounded-3xl border border-gray-100">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">My Points</p>
                    <p className="text-xl font-black">{myParticipant?.score || 0}</p>
                  </div>
                  <div className="p-5 bg-gray-50 rounded-3xl border border-gray-100">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">My Rank</p>
                    <p className="text-xl font-black">#{myParticipant?.rank || 0}</p>
                  </div>
               </div>
            </div>

            {activeMatch ? (
               <button 
                onClick={() => navigate(`/match/${activeMatch.id}`)}
                className="w-full bg-green-500 hover:bg-green-600 text-white py-6 rounded-[28px] font-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-3 shadow-xl shadow-green-500/20 active:scale-95 transition-all"
               >
                 <Zap size={18} fill="currentColor" /> Return to Match
               </button>
            ) : tournament.status === 'active' ? (
              <button 
                onClick={seekMatch}
                className="w-full bg-black text-white hover:bg-gray-900 py-6 rounded-[28px] font-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-3 shadow-xl shadow-black/10 active:scale-95 transition-all"
              >
                <Search size={18} /> Pair Me Now
              </button>
            ) : (
              <div className="p-8 bg-gray-50 rounded-[32px] border border-gray-100 text-center">
                 <Clock className="mx-auto mb-4 text-gray-300" size={32} />
                 <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Waiting for Start</p>
              </div>
            )}
          </motion.div>

          <div className="bg-white p-10 rounded-[48px] shadow-xl border border-gray-100">
             <div className="flex items-center gap-3 mb-6">
                <ShieldAlert size={18} className="text-red-500" />
                <h3 className="font-black text-xs uppercase tracking-widest">Arena Rules</h3>
             </div>
             <ul className="space-y-4">
                {[
                  'Berserk mode available for 2x points (Blitz/Bullet)',
                  'No draw offers allowed before move 40',
                  'Engine detection fully active'
                ].map((rule, i) => (
                  <li key={i} className="flex gap-3 text-xs font-bold text-gray-500 leading-relaxed">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1 flex-shrink-0" />
                    {rule}
                  </li>
                ))}
             </ul>
          </div>
        </div>

        {/* Main Content: Leaderboard */}
        <div className="lg:col-span-8 flex flex-col h-full">
           <div className="bg-white rounded-[48px] shadow-xl border border-gray-100 overflow-hidden flex flex-col h-full min-h-[600px]">
              <div className="p-10 border-b border-gray-100 flex items-center justify-between bg-[#FAFAFA]">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-gray-300 shadow-sm">
                       <Users size={20} />
                    </div>
                    <div>
                       <h2 className="font-black text-xl tracking-tighter">Live Standings</h2>
                       <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{participants.length} Masters competing</p>
                    </div>
                 </div>
                 
                 <div className="flex gap-2">
                    <div className="px-4 py-2 bg-white border border-gray-100 rounded-full text-[10px] font-black text-gray-400 uppercase tracking-widest">Global</div>
                    <div className="px-4 py-2 bg-blue-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20">Real-time</div>
                 </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-2">
                 {participants.map((player, i) => (
                   <div 
                    key={player.id}
                    className={`flex items-center justify-between p-6 rounded-[32px] transition-all group ${player.id === user?.uid ? 'bg-blue-50 border border-blue-100 scale-[1.02] shadow-lg shadow-blue-500/5' : 'hover:bg-gray-50 border border-transparent'}`}
                   >
                      <div className="flex items-center gap-5">
                         <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm border ${i === 0 ? 'bg-yellow-400 border-yellow-500 text-white scale-110 shadow-lg' : 'bg-white text-gray-300 border-gray-100'}`}>
                            {i + 1}
                         </div>
                         <div className="w-14 h-14 rounded-[20px] overflow-hidden border-2 border-white shadow-md">
                            <img src={player.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${player.userId}`} alt="" />
                         </div>
                         <div>
                            <p className="font-black text-base text-gray-800 tracking-tight flex items-center gap-2">
                               {player.displayName}
                               {i < 3 && <Star size={14} fill="currentColor" className="text-yellow-400" />}
                            </p>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{player.rating} ELO • {player.status}</p>
                         </div>
                      </div>
                      
                      <div className="text-right">
                         <div className="flex items-center justify-end gap-3 translate-x-4">
                            <div className="px-5 py-2.5 bg-white border border-gray-100 rounded-2xl shadow-sm text-center">
                               <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Points</p>
                               <p className="font-black text-lg text-blue-600">{player.score}</p>
                            </div>
                            <button className="p-4 text-gray-200 group-hover:text-gray-400 transition-colors">
                               <ArrowRight size={20} />
                            </button>
                         </div>
                      </div>
                   </div>
                 ))}

                 {participants.length === 0 && (
                   <div className="h-full flex flex-col items-center justify-center opacity-20 grayscale py-40">
                      <Trophy size={64} />
                      <p className="mt-8 font-black uppercase tracking-[0.4em] text-xs">Waiting for registrations</p>
                   </div>
                 )}
              </div>

              {tournament.type === 'bounty' && (
                <div className="p-8 bg-black text-white flex items-center justify-between border-t border-white/10">
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center text-black shadow-glow shadow-yellow-400/20">
                         <Coins size={20} />
                      </div>
                      <div>
                         <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Winnings Structure</p>
                         <p className="font-bold text-xs text-gray-300">1st: 70% | 2nd: 20% | 3rd: 10% (after 5% fee)</p>
                      </div>
                   </div>
                   <div className="text-right">
                      <p className="text-xs font-black tracking-tighter">Verified Payouts</p>
                      <p className="text-[8px] font-bold text-green-500 uppercase tracking-widest mt-0.5">Auto-escrow enabled</p>
                   </div>
                </div>
              )}
           </div>
        </div>

      </div>
    </div>
  );
}
