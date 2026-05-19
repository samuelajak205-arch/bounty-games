import React, { useState, useEffect } from 'react';
import { doc, getDoc, collection, query, getDocs, addDoc, serverTimestamp, orderBy, limit, where, getCountFromServer, updateDoc, runTransaction } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { Layout } from '../components/Layout';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Users, ShoppingBag, TrendingUp, Plus, Trash2, CheckCircle, AlertTriangle, Eye, History as HistoryIcon, Wallet as WalletIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Admin: React.FC = () => {
  const [user] = useAuthState(auth);
  const navigate = useNavigate();
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const isAdmin = isSystemAdmin || user?.email?.toLowerCase().trim() === 'samuelajak205@gmail.com';
  const [activeTab, setActiveTab] = useState<'stats' | 'store' | 'users' | 'transactions'>('stats');

  // Store management state
  const [items, setItems] = useState<any[]>([]);
  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [newItem, setNewItem] = useState({ name: '', cost: 0, description: '', category: 'skins' });

  // User management state
  const [users, setUsers] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [isAdjustingBalance, setIsAdjustingBalance] = useState<{id: string, email: string} | null>(null);
  const [adjustmentAmount, setAdjustmentAmount] = useState(0);
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [isBanning, setIsBanning] = useState<{id: string, email: string, isBanned: boolean} | null>(null);
  const [banReason, setBanReason] = useState('');
  const [selectedUser, setSelectedUser] = useState<any | null>(null);

  // Transactions management state
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [txnFilters, setTxnFilters] = useState({
    userId: '',
    type: '',
    sort: 'timestamp',
    direction: 'desc' as 'asc' | 'desc'
  });
  const [txnLoading, setTxnLoading] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      
      const adminEmail = 'samuelajak205@gmail.com';
      const currentUserEmail = user.email?.toLowerCase().trim();

      if (currentUserEmail === adminEmail) {
        setIsSystemAdmin(true);
        // Ensure user is in admins collection for security rules
        try {
          // In rules, admins cannot be written by clients typically, but wait, 
          // we can just rely on the hardcoded email check in the rules instead of needing to write it
          // the backend didn't work either! Let's just do nothing here since the rules already check the email directly.
        } catch (e) {
          console.error("Self-promotion sync failed", e);
        }
      } else {
        // Check if user is in admins collection
        try {
          const adminDoc = await getDoc(doc(db, 'admins', user.uid));
          if (adminDoc.exists()) {
            setIsSystemAdmin(true);
          }
        } catch (e) {
          console.error("Admin check failed", e);
        }
      }
      setLoading(false);
    };
    checkAdmin();
  }, [user]);

  useEffect(() => {
    if (isAdmin) {
      if (activeTab === 'store') fetchStoreItems();
      if (activeTab === 'stats') {
        fetchRecentActivity();
        fetchSystemStats();
      }
      if (activeTab === 'users') fetchUsers();
      if (activeTab === 'transactions') fetchAllTransactions();
    }
  }, [isAdmin, activeTab]);

  useEffect(() => {
    if (isAdmin && activeTab === 'transactions') {
      fetchAllTransactions();
    }
  }, [txnFilters]);

  const fetchSystemStats = async () => {
    try {
      if (!isAdmin) return;
      
      const usersQuery = collection(db, 'users');
      const usersSnap = await getCountFromServer(usersQuery);
      
      const matchesQuery = collection(db, 'matches');
      const matchesSnap = await getCountFromServer(matchesQuery);
      
      const activeMatchesQuery = query(collection(db, 'matches'), where("status", "==", "active"));
      const activeMatchesSnap = await getCountFromServer(activeMatchesQuery);
      
      // Calculate active users in last 5 mins
      const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
      const activeUsersQuery = query(collection(db, 'users'), where("lastActive", ">=", fiveMinsAgo));
      const activeUsersSnap = await getCountFromServer(activeUsersQuery);

      setStats({
        totalUsers: usersSnap.data().count,
        totalMatches: matchesSnap.data().count,
        activeMatches: activeMatchesSnap.data().count,
        activeUsers: activeUsersSnap.data().count,
        totalCoinsInCirculation: 0,
        status: "healthy",
        uptime: 1000
      });
    } catch (err) {
      console.error("Stats fetch failed", err);
    }
  };

  const fetchUsers = async () => {
    try {
      if (!isAdmin) return;
      let q = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(50));
      
      if (userSearch) {
        q = query(collection(db, 'users'), where('email', '>=', userSearch), where('email', '<=', userSearch + '\uf8ff'), limit(50));
      }
      
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(data);
    } catch (err) {
      console.error("Users fetch failed", err);
    }
  };

  const fetchAllTransactions = async () => {
    setTxnLoading(true);
    try {
      if (!isAdmin) return;
      let q = collection(db, 'transactions') as any;

      if (txnFilters.userId) q = query(q, where('userId', '==', txnFilters.userId));
      if (txnFilters.type && txnFilters.type !== 'all') q = query(q, where('type', '==', txnFilters.type));
      
      q = query(q, orderBy(txnFilters.sort, txnFilters.direction), limit(100));

      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
      setAllTransactions(data);
    } catch (err) {
      console.error("Transactions fetch failed", err);
    } finally {
      setTxnLoading(false);
    }
  };

  const handleAdjustBalance = async () => {
    if (!isAdjustingBalance) return;
    try {
      await runTransaction(db, async (t) => {
        const userRef = doc(db, 'users', isAdjustingBalance.id);
        const userDoc = await t.get(userRef);
        if (!userDoc.exists()) throw new Error("User not found");
        
        const currentBalance = userDoc.data().bountyCoins || 0;
        t.update(userRef, { bountyCoins: currentBalance + adjustmentAmount });
        
        const txnRef = doc(collection(db, 'transactions'));
        t.set(txnRef, {
          userId: isAdjustingBalance.id,
          amount: adjustmentAmount,
          type: "admin_adjustment",
          description: adjustmentReason || "Admin Adjustment",
          timestamp: serverTimestamp()
        });
      });
      
      setIsAdjustingBalance(null);
      setAdjustmentAmount(0);
      setAdjustmentReason('');
      fetchUsers();
    } catch (err) {
      console.error("Balance adjustment failed", err);
    }
  };

  const handleToggleBan = async () => {
    if (!isBanning) return;
    try {
      if (!user) return;
      await updateDoc(doc(db, 'users', isBanning.id), {
        isBanned: !isBanning.isBanned,
        banReason: !isBanning.isBanned ? banReason : null
      });
      setIsBanning(null);
      setBanReason('');
      fetchUsers();
    } catch (err) {
      console.error("Ban action failed", err);
    }
  };

  const fetchRecentActivity = async () => {
    try {
      const matchQ = query(collection(db, 'matches'), orderBy('createdAt', 'desc'), limit(5));
      const matchSnap = await getDocs(matchQ);
      setRecentMatches(matchSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const txnQ = query(collection(db, 'transactions'), orderBy('timestamp', 'desc'), limit(5));
      const txnSnap = await getDocs(txnQ);
      setRecentTransactions(txnSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Activity fetch failed", err);
    }
  };

  const fetchStoreItems = async () => {
    const q = query(collection(db, 'store_items'), orderBy('cost', 'asc'));
    const snap = await getDocs(q);
    setItems(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const handleCreateStoreItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'store_items'), {
        ...newItem,
        createdAt: serverTimestamp()
      });
      setNewItem({ name: '', cost: 0, description: '', category: 'skins' });
      fetchStoreItems();
    } catch (err) {
      console.error("Failed to create item", err);
      alert("Error: Only admins can perform this action.");
    }
  };

  if (loading && !isAdmin) return <Layout><div className="flex items-center justify-center h-screen">Loading dashboard...</div></Layout>;

  if (!isAdmin) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-[70vh] text-center px-4">
          <div className="bg-red-500/10 p-4 rounded-full mb-4">
            <AlertTriangle className="w-12 h-12 text-red-500" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Access Denied</h1>
          <p className="text-gray-400 max-w-md">
            Your account ({user?.email}) does not have administrative privileges.
            Please contact the system owner if you believe this is an error.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-4xl font-bold flex items-center gap-3">
              <Shield className="text-emerald-500" /> Admin Command Center
            </h1>
            <p className="text-gray-400">Manage the Grandmaster AI infrastructure</p>
          </div>
          
          <div className="flex bg-gray-800/50 p-1 rounded-xl backdrop-blur-sm border border-white/5">
            {[
              { id: 'stats', label: 'Overview', icon: TrendingUp },
              { id: 'store', label: 'Bounty Store', icon: ShoppingBag },
              { id: 'users', label: 'Users', icon: Users },
              { id: 'transactions', label: 'Transactions', icon: HistoryIcon },
              { id: 'withdrawals', label: 'Withdrawals', icon: WalletIcon }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.id === 'withdrawals') {
                    navigate('/admin/withdrawals');
                  } else {
                    setActiveTab(tab.id as any);
                  }
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  activeTab === tab.id 
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === 'stats' && (
            <motion.div
              key="stats"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-gray-800/30 border border-white/5 p-6 rounded-2xl">
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">System Status</h3>
                  <div className="flex items-center gap-2 text-2xl font-bold text-emerald-400">
                    <CheckCircle className="w-6 h-6" /> Online
                  </div>
                  <p className="text-xs text-gray-400 mt-2">API: {stats?.status || '...'}</p>
                </div>
                <div className="bg-gray-800/30 border border-white/5 p-6 rounded-2xl">
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Total Users</h3>
                  <div className="text-2xl font-bold text-white">{stats?.totalUsers || '...'}</div>
                  <p className="text-xs text-gray-400 mt-2">Registered Accounts</p>
                </div>
                <div className="bg-gray-800/30 border border-white/5 p-6 rounded-2xl">
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Active Users</h3>
                  <div className="text-2xl font-bold text-emerald-400">{stats?.activeUsers || '...'}</div>
                  <p className="text-xs text-gray-400 mt-2">Active in last 5 mins</p>
                </div>
                <div className="bg-gray-800/30 border border-white/5 p-6 rounded-2xl">
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Economy</h3>
                  <div className="text-2xl font-bold text-white">{stats?.totalCoinsInCirculation?.toLocaleString() || '...'} BC</div>
                  <p className="text-xs text-emerald-400 mt-2">Circulation Stable</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-800/20 border border-white/5 p-6 rounded-2xl">
                  <h3 className="text-lg font-bold mb-4">Recent Matches</h3>
                  <div className="space-y-3">
                    {recentMatches.length > 0 ? recentMatches.map(m => (
                      <div key={m.id} className="flex items-center justify-between p-3 bg-gray-900/40 rounded-xl border border-white/5 text-xs">
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-300">Match #{m.id.slice(-6)}</span>
                          <span className="text-gray-500">{m.status} • {m.wagerAmount} BC</span>
                        </div>
                        <div className="text-right">
                          <span className="block text-gray-400">{new Date(m.createdAt?.seconds * 1000).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    )) : <p className="text-gray-500 text-sm italic">No recent matches found</p>}
                  </div>
                </div>

                <div className="bg-gray-800/20 border border-white/5 p-6 rounded-2xl">
                  <h3 className="text-lg font-bold mb-4">Live Transactions</h3>
                  <div className="space-y-3">
                    {recentTransactions.length > 0 ? recentTransactions.map(t => (
                      <div key={t.id} className="flex items-center justify-between p-3 bg-gray-900/40 rounded-xl border border-white/5 text-xs">
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-300 capitalize">{t.type}</span>
                          <span className="text-gray-500">{t.description}</span>
                        </div>
                        <div className={`font-mono font-bold ${t.amount < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                          {t.amount > 0 ? '+' : ''}{t.amount} BC
                        </div>
                      </div>
                    )) : <p className="text-gray-500 text-sm italic">No recent transactions found</p>}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'store' && (
            <motion.div
              key="store"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="bg-gray-800/50 border border-white/5 p-6 rounded-2xl">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-emerald-500" /> Create New Store Item
                </h2>
                <form onSubmit={handleCreateStoreItem} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <input
                    type="text"
                    placeholder="Name"
                    value={newItem.name}
                    onChange={e => setNewItem({...newItem, name: e.target.value})}
                    className="bg-gray-900/50 border border-white/10 rounded-xl px-4 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                    required
                  />
                  <input
                    type="number"
                    placeholder="Cost (BC)"
                    value={newItem.cost || ''}
                    onChange={e => setNewItem({...newItem, cost: parseInt(e.target.value)})}
                    className="bg-gray-900/50 border border-white/10 rounded-xl px-4 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                    required
                  />
                  <select
                    value={newItem.category}
                    onChange={e => setNewItem({...newItem, category: e.target.value})}
                    className="bg-gray-900/50 border border-white/10 rounded-xl px-4 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="skins">Board Skin</option>
                    <option value="icons">Premium Icon</option>
                    <option value="titles">Special Title</option>
                  </select>
                  <button className="bg-emerald-500 hover:bg-emerald-600 font-bold rounded-xl px-4 py-2 transition-all">
                    Deploy Item
                  </button>
                  <textarea
                    placeholder="Description"
                    value={newItem.description}
                    onChange={e => setNewItem({...newItem, description: e.target.value})}
                    className="bg-gray-900/50 border border-white/10 rounded-xl px-4 py-2 focus:ring-2 focus:ring-emerald-500 outline-none md:col-span-4 h-24"
                    required
                  />
                </form>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {items.map(item => (
                  <div key={item.id} className="bg-gray-800/30 border border-white/5 p-4 rounded-xl flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-lg">{item.name}</h4>
                      <p className="text-emerald-400 font-mono text-sm">{item.cost} BC</p>
                      <p className="text-gray-500 text-xs mt-1">{item.category}</p>
                    </div>
                    <button className="p-2 text-gray-500 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}          {activeTab === 'transactions' && (
            <motion.div
              key="transactions"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Transaction Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total Volume', value: allTransactions.reduce((acc, t) => acc + Math.abs(t.amount), 0), color: 'text-white' },
                  { label: 'Wagers', value: allTransactions.filter(t => t.type === 'wager').length, color: 'text-blue-400' },
                  { label: 'Purchases', value: allTransactions.filter(t => t.type === 'purchase').length, color: 'text-purple-400' },
                  { label: 'Admin Adjust', value: allTransactions.filter(t => t.type === 'adjustment').length, color: 'text-amber-400' }
                ].map((stat, i) => (
                  <div key={i} className="bg-gray-800/20 border border-white/5 p-4 rounded-xl">
                    <h4 className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1">{stat.label}</h4>
                    <p className={`text-xl font-black ${stat.color}`}>{stat.value.toLocaleString()}</p>
                  </div>
                ))}
              </div>

              <div className="bg-gray-800/50 border border-white/5 p-6 rounded-2xl flex flex-col md:flex-row gap-4 items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Financial History</h2>
                  <p className="text-gray-400 text-sm">Every transaction ever made on the platform</p>
                </div>
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase font-bold text-gray-500 ml-1">Category</span>
                    <select 
                      value={txnFilters.type}
                      onChange={e => setTxnFilters({...txnFilters, type: e.target.value})}
                      className="bg-gray-900 border border-white/10 rounded-xl px-4 py-2 text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">All Categories</option>
                      <option value="win">Match Winnings</option>
                      <option value="wager">Match Wagers</option>
                      <option value="purchase">Store Purchases</option>
                      <option value="transfer_in">Credits Received</option>
                      <option value="transfer_out">Credits Sent</option>
                      <option value="adjustment">Adjustments</option>
                    </select>
                  </div>
                  
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase font-bold text-gray-500 ml-1">Sort By</span>
                    <select 
                      value={txnFilters.sort}
                      onChange={e => setTxnFilters({...txnFilters, sort: e.target.value})}
                      className="bg-gray-900 border border-white/10 rounded-xl px-4 py-2 text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="timestamp">Transaction Date</option>
                      <option value="amount">Amount Value</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase font-bold text-gray-500 ml-1">Order</span>
                    <select 
                      value={txnFilters.direction}
                      onChange={e => setTxnFilters({...txnFilters, direction: e.target.value as any})}
                      className="bg-gray-900 border border-white/10 rounded-xl px-4 py-2 text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="desc">Newest / Largest</option>
                      <option value="asc">Oldest / Smallest</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase font-bold text-gray-500 ml-1">Filter User</span>
                    <input 
                      type="text"
                      placeholder="UID Search..."
                      value={txnFilters.userId}
                      onChange={e => setTxnFilters({...txnFilters, userId: e.target.value})}
                      className="bg-gray-900 border border-white/10 rounded-xl px-4 py-2 text-xs outline-none focus:ring-2 focus:ring-emerald-500 min-w-[150px]"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-gray-800/30 border border-white/5 rounded-2xl overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/5 text-gray-400 text-xs uppercase tracking-wider">
                      <th className="px-6 py-4 font-medium">Date</th>
                      <th className="px-6 py-4 font-medium">User ID</th>
                      <th className="px-6 py-4 font-medium">Type</th>
                      <th className="px-6 py-4 font-medium">Description</th>
                      <th className="px-6 py-4 font-medium text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-sm">
                    {txnLoading ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500 italic">
                          Fetching ledgers...
                        </td>
                      </tr>
                    ) : allTransactions.map(t => (
                      <tr key={t.id} className="hover:bg-white/2 transition-colors">
                        <td className="px-6 py-4 text-gray-400 font-mono text-xs">
                          {t.timestamp?.seconds ? new Date(t.timestamp.seconds * 1000).toLocaleString() : 'Pending...'}
                        </td>
                        <td className="px-6 py-4 font-mono text-[10px] text-gray-500">
                          {t.userId}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border uppercase font-black tracking-widest ${
                            t.amount > 0 ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'
                          }`}>
                            {t.type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-300">
                          {t.description}
                        </td>
                        <td className={`px-6 py-4 text-right font-black font-mono ${t.amount > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {t.amount > 0 ? '+' : ''}{t.amount} BC
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!txnLoading && allTransactions.length === 0 && (
                  <div className="p-12 text-center text-gray-500">
                    No transactions match these filters
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'users' && (
            <motion.div
              key="users"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="bg-gray-800/50 border border-white/5 p-6 rounded-2xl flex flex-col md:flex-row gap-4 items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">User Management</h2>
                  <p className="text-gray-400 text-sm">View and manage players on the platform</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                  <input
                    type="text"
                    placeholder="Search by email prefix..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="bg-gray-900 border border-white/10 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500 w-full"
                  />
                  <button 
                    onClick={fetchUsers}
                    className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-xl transition-colors"
                  >
                    Search
                  </button>
                </div>
              </div>

              <div className="bg-gray-800/30 border border-white/5 rounded-2xl overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/5 text-gray-400 text-xs uppercase tracking-wider">
                      <th className="px-6 py-4 font-medium">User / Email</th>
                      <th className="px-6 py-4 font-medium">Balance</th>
                      <th className="px-6 py-4 font-medium">ELO</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                      <th className="px-6 py-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {users.map(u => (
                      <tr key={u.id} className="hover:bg-white/2 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <img src={u.photoURL} alt="" className="w-8 h-8 rounded-full bg-gray-700" />
                            <div>
                              <div className="font-bold text-sm">{u.displayName}</div>
                              <div className="text-xs text-gray-500">{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono text-emerald-400 font-bold">{u.bountyCoins} BC</td>
                        <td className="px-6 py-4 font-mono">{u.elo}</td>
                        <td className="px-6 py-4">
                          {u.isBanned ? (
                            <span className="bg-red-500/20 text-red-500 text-[10px] px-2 py-1 rounded-full border border-red-500/30 uppercase font-bold">Banned</span>
                          ) : (
                            <span className="bg-emerald-500/20 text-emerald-500 text-[10px] px-2 py-1 rounded-full border border-emerald-500/30 uppercase font-bold">Active</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => setSelectedUser(u)}
                              className="p-2 text-gray-400 hover:text-white transition-colors bg-white/5 rounded-lg"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => setIsAdjustingBalance({ id: u.id, email: u.email })}
                              className="p-2 text-gray-400 hover:text-emerald-400 transition-colors bg-white/5 rounded-lg"
                              title="Adjust Balance"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => setIsBanning({ id: u.id, email: u.email, isBanned: !!u.isBanned })}
                              className={`p-2 transition-colors bg-white/5 rounded-lg ${u.isBanned ? 'text-emerald-400 hover:text-emerald-500' : 'text-red-400 hover:text-red-500'}`}
                              title={u.isBanned ? 'Unban User' : 'Ban User'}
                            >
                              <Shield className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {users.length === 0 && (
                  <div className="p-12 text-center text-gray-500">
                    No users found
                  </div>
                )}
              </div>

              {/* Balance Adjust Modal */}
              {isAdjustingBalance && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-gray-900 border border-white/10 p-6 rounded-2xl max-w-md w-full shadow-2xl"
                  >
                    <h3 className="text-xl font-bold mb-2">Adjust Balance</h3>
                    <p className="text-gray-400 text-sm mb-4">Update bounty coins for {isAdjustingBalance.email}</p>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs uppercase text-gray-500 mb-1">Amount (Negative to subtract)</label>
                        <input 
                          type="number"
                          value={adjustmentAmount}
                          onChange={(e) => setAdjustmentAmount(parseInt(e.target.value))}
                          className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs uppercase text-gray-500 mb-1">Reason</label>
                        <textarea 
                          value={adjustmentReason}
                          onChange={(e) => setAdjustmentReason(e.target.value)}
                          className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500 h-24"
                          placeholder="Why are you adjusting this?"
                        />
                      </div>
                      <div className="flex gap-3">
                        <button 
                          onClick={() => setIsAdjustingBalance(null)}
                          className="flex-1 bg-gray-800 hover:bg-gray-700 py-3 rounded-xl font-bold transition-all"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={handleAdjustBalance}
                          className="flex-1 bg-emerald-500 hover:bg-emerald-600 py-3 rounded-xl font-bold transition-all"
                        >
                          Save Changes
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}

              {/* Ban Modal */}
              {isBanning && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-gray-900 border border-white/10 p-6 rounded-2xl max-w-md w-full shadow-2xl"
                  >
                    <h3 className="text-xl font-bold mb-2">{isBanning.isBanned ? 'Unban User' : 'Ban User'}</h3>
                    <p className="text-gray-400 text-sm mb-4">
                      {isBanning.isBanned ? `Restore access for ${isBanning.email}?` : `Revoke access for ${isBanning.email}?`}
                    </p>
                    
                    {!isBanning.isBanned && (
                      <div className="mb-4">
                        <label className="block text-xs uppercase text-gray-500 mb-1">Reason for Ban</label>
                        <textarea 
                          value={banReason}
                          onChange={(e) => setBanReason(e.target.value)}
                          className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-red-500 h-24"
                          placeholder="Cheating, toxicity, etc."
                        />
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button 
                        onClick={() => setIsBanning(null)}
                        className="flex-1 bg-gray-800 hover:bg-gray-700 py-3 rounded-xl font-bold transition-all"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleToggleBan}
                        className={`flex-1 py-3 rounded-xl font-bold transition-all ${isBanning.isBanned ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-red-500 hover:bg-red-600'}`}
                      >
                        {isBanning.isBanned ? 'Confirm Unban' : 'Confirm Ban'}
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}

              {/* User Details Modal */}
              {selectedUser && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-gray-900 border border-white/10 rounded-[32px] max-w-lg w-full shadow-2xl overflow-hidden"
                  >
                    <div className="bg-emerald-500 h-24 w-full" />
                    <div className="px-8 pb-8 -mt-12">
                      <div className="flex justify-between items-end mb-6">
                        <img 
                          src={selectedUser.photoURL} 
                          alt="" 
                          className="w-24 h-24 rounded-3xl border-4 border-gray-900 bg-gray-800 object-cover"
                        />
                        <div className="flex gap-2">
                          <button 
                            onClick={() => {
                              setIsAdjustingBalance({ id: selectedUser.id, email: selectedUser.email });
                              setSelectedUser(null);
                            }}
                            className="bg-white/10 hover:bg-white/20 p-3 rounded-2xl transition-all"
                            title="Adjust Balance"
                          >
                            <Plus className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      <div className="mb-8">
                        <h3 className="text-2xl font-black tracking-tight">{selectedUser.displayName}</h3>
                        <p className="text-gray-400 font-bold text-sm">{selectedUser.email}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                          <p className="text-[10px] uppercase font-black text-gray-500 tracking-widest mb-1">Balance</p>
                          <p className="text-xl font-bold text-emerald-400">{selectedUser.bountyCoins} BC</p>
                        </div>
                        <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                          <p className="text-[10px] uppercase font-black text-gray-500 tracking-widest mb-1">ELO Rating</p>
                          <p className="text-xl font-bold text-white">{selectedUser.elo}</p>
                        </div>
                        <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                          <p className="text-[10px] uppercase font-black text-gray-500 tracking-widest mb-1">Status</p>
                          <p className={`text-sm font-black uppercase ${selectedUser.isBanned ? 'text-red-500' : 'text-emerald-500'}`}>
                            {selectedUser.isBanned ? 'Banned' : 'Active'}
                          </p>
                        </div>
                        <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                          <p className="text-[10px] uppercase font-black text-gray-500 tracking-widest mb-1">Joined</p>
                          <p className="text-sm font-bold text-gray-300">
                            {selectedUser.createdAt?.seconds ? new Date(selectedUser.createdAt.seconds * 1000).toLocaleDateString() : 'Unknown'}
                          </p>
                        </div>
                        <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                          <p className="text-[10px] uppercase font-black text-gray-500 tracking-widest mb-1">Privacy</p>
                          <p className={`text-sm font-black uppercase ${selectedUser.isPublicCoins ? 'text-blue-500' : 'text-gray-500'}`}>
                            {selectedUser.isPublicCoins ? 'Public Coins' : 'Hidden Coins'}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-3 mb-4">
                        <button 
                          onClick={() => {
                            setTxnFilters({...txnFilters, userId: selectedUser.id});
                            setActiveTab('transactions');
                            setSelectedUser(null);
                          }}
                          className="flex-1 bg-white/5 hover:bg-white/10 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all text-center"
                        >
                          View Transactions
                        </button>
                      </div>

                      <button 
                        onClick={() => setSelectedUser(null)}
                        className="w-full bg-white text-black py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[0.98] transition-all"
                      >
                        Close Profile
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
};
