import React, { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, query, where, onSnapshot, addDoc, serverTimestamp, 
  orderBy, limit, doc, setDoc, deleteDoc, getDoc, updateDoc, increment
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, Users, Calendar, Clock, 
  Sparkles, ChevronRight, Swords, 
  Coins, Filter, Search, Plus, Star,
  Info, AlertCircle
} from 'lucide-react';

export default function Tournaments() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [myTournaments, setMyTournaments] = useState<string[]>([]);
  const [filter, setFilter] = useState<'all' | 'free' | 'bounty'>('all');
  const [userCoins, setUserCoins] = useState(0);

  useEffect(() => {
    if (!user) return;

    // Fetch user coins
    const unsubUser = onSnapshot(doc(db, 'users', user.uid), (d) => {
      if (d.exists()) setUserCoins(d.data().bountyCoins || 0);
    });

    // Fetch tournaments
    const q = query(
      collection(db, 'tournaments'),
      where('status', 'in', ['upcoming', 'active']),
      orderBy('startTime', 'asc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      setTournaments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tournaments');
    });

    // Fetch my registrations
    // This is a bit tricky with current structure, maybe check /tournaments/{id}/participants/{userId}
    // For now, let's just listen to all participants where userId == user.uid across all tournaments?
    // Actually, it's better to just fetch them once or keep a list in user profile.
    // For this demo, let's just fetch them per tournament or use a collectionGroup if needed.
    // But since we have limited tournaments, we can just check registration status on click.

    return () => {
      unsubscribe();
      unsubUser();
    };
  }, [user]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTournament, setNewTournament] = useState({
    title: '',
    type: 'free' as 'free' | 'bounty',
    format: 'arena' as 'arena' | 'swiss' | 'knockout',
    entryFee: 0,
    prizePool: 0,
    startTime: '',
    timeControl: '10+0',
    maxPlayers: 100
  });

  const createTournament = async () => {
    if (!user) return;
    try {
      const response = await fetch('/api/tournaments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTournament)
      });
      const data = await response.json();
      if (data.success) {
        setIsModalOpen(false);
        setNewTournament({
          title: '',
          type: 'free',
          format: 'arena',
          entryFee: 0,
          prizePool: 0,
          startTime: '',
          timeControl: '10+0',
          maxPlayers: 100
        });
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error("Tournament creation error:", err);
    }
  };

  const registerForTournament = async (tournament: any) => {
    if (!user) return;

    if (tournament.type === 'bounty' && userCoins < tournament.entryFee) {
      alert("Insufficient Bounty Coins!");
      return;
    }

    try {
      const response = await fetch('/api/tournaments/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: tournament.id,
          userId: user.uid,
          displayName: user.displayName
        })
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to join tournament");
      }

      alert(`Registered for ${tournament.title}!`);
    } catch (error: any) {
      console.error("Registration error:", error);
      alert(error.message || "Failed to register for tournament");
    }
  };

  const seedTournaments = async () => {
    const demos = [
      {
        title: "Daily Blitz Arena",
        type: "free",
        format: "arena",
        status: "upcoming",
        timeControl: "5+0",
        entryFee: 0,
        prizePool: 0,
        startTime: new Date(Date.now() + 3600000).toISOString(),
        playerCount: 12,
        maxPlayers: 100
      },
      {
        title: "High Stakes Knockout",
        type: "bounty",
        format: "knockout",
        status: "active",
        timeControl: "10+0",
        entryFee: 100,
        prizePool: 3200,
        startTime: new Date(Date.now() - 600000).toISOString(),
        playerCount: 31,
        maxPlayers: 32
      },
      {
        title: "Friday Night Swiss",
        type: "bounty",
        format: "swiss",
        status: "upcoming",
        timeControl: "15+10",
        entryFee: 50,
        prizePool: 2500,
        startTime: new Date(Date.now() + 86400000).toISOString(),
        playerCount: 45,
        maxPlayers: 128
      }
    ];

    for (const d of demos) {
      await addDoc(collection(db, 'tournaments'), {
        ...d,
        createdAt: serverTimestamp()
      });
    }
  };

  const filteredTournaments = tournaments.filter(t => {
    if (filter === 'all') return true;
    return t.type === filter;
  });

  return (
    <div className="min-h-screen bg-[#F5F5F7] p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-10">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl font-black tracking-tighter mb-2">Grand Slam Hub</h1>
            <p className="text-gray-400 font-bold text-xs uppercase tracking-[0.4em]">Official Competitive Tournaments</p>
          </div>
          
          <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100 h-fit">
            {(['all', 'free', 'bounty'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === f ? 'bg-black text-white shadow-lg' : 'text-gray-400 hover:text-black'}`}
              >
                {f}
              </button>
            ))}
          </div>
          
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:scale-105 transition-all shadow-xl shadow-blue-500/20"
          >
            Create Tournament
          </button>
        </div>

        {tournaments.length === 0 && (
          <div className="bg-white p-12 rounded-[40px] border-2 border-dashed border-gray-100 flex flex-col items-center text-center">
            <Trophy className="text-gray-200 mb-6" size={64} />
            <h3 className="font-black text-xl tracking-tight mb-2">No Tournaments found</h3>
            <p className="text-gray-400 text-sm mb-8 max-w-xs">There are no upcoming sessions. Be the one to initiate the first grand slam.</p>
            <button 
              onClick={seedTournaments}
              className="bg-black text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:scale-105 transition-all shadow-xl shadow-black/10"
            >
              Seed Demo Sessions
            </button>
          </div>
        )}

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <AnimatePresence mode="popLayout">
            {filteredTournaments.map((tournament) => (
              <motion.div
                key={tournament.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white rounded-[40px] shadow-xl border border-gray-100 overflow-hidden flex flex-col group hover:shadow-2xl transition-all duration-500"
              >
                <div className="p-8 pb-0 flex items-center justify-between">
                  <div className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${tournament.type === 'bounty' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                    {tournament.type} Tournament
                  </div>
                  <div className="flex items-center gap-1.5 text-blue-600">
                    <Sparkles size={14} className="animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest">{tournament.format}</span>
                  </div>
                </div>

                <div className="p-8 flex-1">
                  <h3 className="text-2xl font-black tracking-tighter mb-6 group-hover:text-blue-600 transition-colors">{tournament.title}</h3>
                  
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Entry Fee</p>
                      <div className="flex items-center gap-1.5">
                        <Coins size={14} className="text-yellow-400" />
                        <span className="font-black text-base">{tournament.entryFee === 0 ? 'FREE' : tournament.entryFee}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Prize Pool</p>
                      <div className="flex items-center gap-1.5 font-black text-base text-gray-800">
                        <Trophy size={14} className="text-gray-400" />
                        <span>{tournament.prizePool.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Players</p>
                      <div className="flex items-center gap-1.5 font-bold text-sm text-gray-500">
                         <Users size={14} />
                         <span>{tournament.playerCount}/{tournament.maxPlayers}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Starts In</p>
                      <div className="flex items-center gap-1.5 font-bold text-sm text-gray-500">
                         <Clock size={14} />
                         <span>{Math.max(0, Math.floor((new Date(tournament.startTime).getTime() - Date.now()) / 60000))}m</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-8 pt-0 mt-auto">
                   {tournament.status === 'active' ? (
                     <button 
                      onClick={() => navigate(`/tournament/${tournament.id}`)}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-[24px] font-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-2 group-hover:scale-105 transition-all shadow-xl shadow-blue-500/20"
                     >
                       Enter Arena <ChevronRight size={16} />
                     </button>
                   ) : (
                     <button 
                      onClick={() => registerForTournament(tournament)}
                      className="w-full bg-black text-white py-5 rounded-[24px] font-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-2 hover:bg-gray-900 transition-all active:scale-95 shadow-xl shadow-black/10"
                     >
                       <Plus size={16} /> Register Now
                     </button>
                   )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Informational Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="lg:col-span-2 bg-gradient-to-br from-blue-600 to-blue-800 p-12 rounded-[48px] text-white relative overflow-hidden">
              <div className="absolute -right-20 -bottom-20 opacity-10">
                 <Swords size={300} />
              </div>
              <div className="relative z-10 max-w-lg">
                 <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-8 border border-white/10">
                    <Info size={24} />
                 </div>
                 <h2 className="text-3xl font-black tracking-tighter mb-6">Tournament Regulations</h2>
                 <div className="space-y-4 text-blue-100 font-medium text-sm leading-relaxed">
                    <p>• Disconnection results in immediate forfeit for that round.</p>
                    <p>• Tie-breaks for Swiss format use the Buchholz Score system.</p>
                    <p>• Bounty prizes are distributed within 5 minutes of completion.</p>
                    <p>• Fair play engine monitors all games in real-time.</p>
                 </div>
              </div>
           </div>

           <div className="bg-white p-12 rounded-[48px] shadow-xl border border-gray-100 flex flex-col justify-center text-center">
              <div className="w-20 h-20 bg-yellow-50 rounded-[32px] flex items-center justify-center text-yellow-500 mx-auto mb-8 shadow-inner shadow-yellow-500/10">
                 <Star size={40} fill="currentColor" />
              </div>
              <h3 className="text-2xl font-black tracking-tighter mb-4">Elite Badges</h3>
              <p className="text-gray-400 font-medium text-xs mb-8">Reach the Top 3 in any Grand Slam to earn permament profile flairs and ELO bonuses.</p>
              <div className="flex justify-center gap-4 opacity-40 grayscale group-hover:grayscale-0 transition-all">
                 <div className="w-10 h-10 bg-gray-100 rounded-lg" />
                 <div className="w-10 h-10 bg-gray-100 rounded-lg" />
                 <div className="w-10 h-10 bg-gray-100 rounded-lg" />
              </div>
           </div>
        </div>

      </div>

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
              className="relative w-full max-w-lg bg-white rounded-[48px] shadow-2xl overflow-hidden border border-gray-100 p-10"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-3xl font-black tracking-tighter mb-1">New Tournament</h2>
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">Setup competitive arena</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-4 bg-gray-50 rounded-2xl text-gray-400 hover:text-black transition-colors">
                  <Filter size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 block">Title</label>
                  <input 
                    type="text" 
                    value={newTournament.title}
                    onChange={e => setNewTournament({...newTournament, title: e.target.value})}
                    placeholder="e.g. Master Sunday Swiss"
                    className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 block">Format</label>
                    <select 
                      value={newTournament.format}
                      onChange={e => setNewTournament({...newTournament, format: e.target.value as any})}
                      className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl font-bold text-sm"
                    >
                      <option value="arena">Arena</option>
                      <option value="swiss">Swiss</option>
                      <option value="knockout">Knockout</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 block">Type</label>
                    <select 
                      value={newTournament.type}
                      onChange={e => setNewTournament({...newTournament, type: e.target.value as any})}
                      className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl font-bold text-sm"
                    >
                      <option value="free">Free</option>
                      <option value="bounty">Bounty</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 block">Entry Fee (BC)</label>
                    <input 
                      type="number" 
                      value={newTournament.entryFee}
                      onChange={e => setNewTournament({...newTournament, entryFee: Number(e.target.value)})}
                      className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl font-bold text-sm"
                      disabled={newTournament.type === 'free'}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 block">Prize Pool (BC)</label>
                    <input 
                      type="number" 
                      value={newTournament.prizePool}
                      onChange={e => setNewTournament({...newTournament, prizePool: Number(e.target.value)})}
                      className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl font-bold text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 block">Start Time</label>
                    <input 
                      type="datetime-local" 
                      value={newTournament.startTime}
                      onChange={e => setNewTournament({...newTournament, startTime: e.target.value})}
                      className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl font-bold text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 block">Time Control</label>
                    <input 
                      type="text" 
                      value={newTournament.timeControl}
                      onChange={e => setNewTournament({...newTournament, timeControl: e.target.value})}
                      placeholder="e.g. 5+0"
                      className="w-full bg-gray-50 border border-gray-100 p-4 rounded-2xl font-bold text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-10">
                <button 
                  onClick={createTournament}
                  className="w-full bg-black text-white py-6 rounded-[28px] font-black uppercase tracking-[0.3em] text-xs hover:scale-[1.02] active:scale-95 transition-all shadow-2xl"
                >
                  Create Tournament
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
