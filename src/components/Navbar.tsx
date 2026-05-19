import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db, logOut } from '../lib/firebase';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { motion } from 'motion/react';
import { 
  ShoppingBag, LayoutGrid, 
  BrainCircuit, LogOut, Coins, Swords, Trophy, Shield, Plus
} from 'lucide-react';
import { BuyBCModal } from './BuyBCModal';

export const Navbar = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [balance, setBalance] = useState<number>(0);
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);
  const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);
  const isAdmin = isSystemAdmin || user?.email?.toLowerCase().trim() === 'samuelajak205@gmail.com';

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        setIsSystemAdmin(false);
        return;
      }
      
      if (user.email?.toLowerCase().trim() === 'samuelajak205@gmail.com') {
        setIsSystemAdmin(true);
        return;
      }

      try {
        const adminDoc = await getDoc(doc(db, 'admins', user.uid));
        if (adminDoc.exists()) {
          setIsSystemAdmin(true);
        }
      } catch (e) {
        console.error("Admin check failed", e);
      }
    };
    checkAdmin();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (doc) => {
      if (doc.exists()) {
        setBalance(doc.data().bountyCoins || 0);
      }
    });
    return () => unsubscribe();
  }, [user]);

  if (!user) return null;

  const handleLogout = async () => {
    await logOut();
    navigate('/');
  };

  const navItems = [
    { label: 'Arena', path: '/', icon: LayoutGrid },
    { label: 'Bounty', path: '/bounty', icon: Swords },
    { label: 'Practice', path: '/practice', icon: BrainCircuit },
    { label: 'Tourney', path: '/tournaments', icon: Trophy },
    { label: 'Store', path: '/store', icon: ShoppingBag },
    ...(isAdmin ? [{ label: 'Admin', path: '/admin', icon: Shield }] : []),
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="sticky top-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800 px-6 py-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <Link 
          to="/" 
          className="flex items-center gap-3 group"
        >
          <div className="w-10 h-10 bg-black dark:bg-blue-600 rounded-2xl flex items-center justify-center text-white transition-transform group-hover:rotate-12">
            <BrainCircuit size={20} />
          </div>
          <div className="hidden md:block">
            <h1 className="font-black text-lg tracking-tight leading-none dark:text-white">Bounty Games</h1>
            <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Grandmaster AI</p>
          </div>
        </Link>

        {/* Navigation */}
        <div className="hidden md:flex items-center gap-2 bg-gray-50 dark:bg-gray-900 p-1.5 rounded-2xl">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                isActive(item.path) 
                  ? 'bg-white dark:bg-gray-800 text-black dark:text-white shadow-sm' 
                  : 'text-gray-400 dark:text-gray-500 hover:text-black dark:hover:text-white hover:bg-white/50 dark:hover:bg-gray-800/50'
              }`}
            >
              <item.icon size={14} />
              {item.label}
            </button>
          ))}
        </div>

        {/* User & Wallet */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsBuyModalOpen(true)}
              className="flex items-center gap-1 bg-yellow-400 hover:bg-yellow-500 text-yellow-950 px-3 py-2 rounded-xl transition-colors shadow-sm font-black text-[10px] uppercase tracking-widest"
            >
              <Plus size={14} /> Buy BC
            </button>
            <motion.div 
              onClick={() => navigate('/wallet')}
              whileHover={{ scale: 1.02 }}
              className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 px-4 py-2 rounded-2xl cursor-pointer transition-colors border border-gray-100 dark:border-gray-800"
            >
               <div className="flex flex-col items-end leading-none">
                  <span className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-0.5">Wallet</span>
                  <span className="text-sm font-black tracking-tight dark:text-white">{balance.toLocaleString()}</span>
               </div>
               <div className="w-8 h-8 bg-yellow-400/20 rounded-lg flex items-center justify-center text-yellow-600">
                  <Coins size={16} />
               </div>
            </motion.div>
          </div>

          <div className="h-8 w-px bg-gray-100 dark:bg-gray-800 hidden sm:block" />

          <div className="flex items-center gap-3">
             <button 
               onClick={handleLogout}
               className="p-2 text-gray-300 dark:text-gray-600 hover:text-red-500 transition-colors"
               title="Sign Out"
             >
               <LogOut size={18} />
             </button>
             <div className="w-10 h-10 rounded-2xl overflow-hidden border-2 border-white dark:border-gray-800 shadow-md ring-1 ring-gray-100 dark:ring-gray-800">
                <img src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} alt="Profile" />
             </div>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      <div className="md:hidden flex items-center justify-center gap-4 mt-4 pt-4 border-t border-gray-50 dark:border-gray-800">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`p-2 rounded-xl transition-all ${
              isActive(item.path) ? 'text-black dark:text-white bg-gray-100 dark:bg-gray-800' : 'text-gray-400 dark:text-gray-600'
            }`}
          >
            <item.icon size={20} />
          </button>
        ))}
      </div>
      
      <BuyBCModal isOpen={isBuyModalOpen} onClose={() => setIsBuyModalOpen(false)} />
    </nav>
  );
};
