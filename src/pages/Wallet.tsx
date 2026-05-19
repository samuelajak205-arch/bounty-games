import React, { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, doc, runTransaction, getDocs, limit, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'motion/react';
import { Wallet as WalletIcon, TrendingUp, TrendingDown, History as HistoryIcon, ChevronLeft, Coins, ArrowRight, ArrowDownToLine } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { WithdrawModal } from '../components/WithdrawModal';
import { BuyBCModal } from '../components/BuyBCModal';

interface Transaction {
  id: string;
  amount: number;
  type: 'win' | 'purchase' | 'wager' | 'transfer_in' | 'transfer_out' | 'adjustment' | 'withdrawal_pending' | 'withdrawal_completed' | 'withdrawal_refund' | 'buy_bc_pending' | 'buy_bc_completed';
  description?: string;
  timestamp: any;
}

const Wallet = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [filter, setFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  const [isTransferring, setIsTransferring] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [isDepositing, setIsDepositing] = useState(false);
  
  const [transferData, setTransferData] = useState({ email: '', amount: '', note: '' });
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferSuccess, setTransferSuccess] = useState(false);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setTransferError(null);
    setTransferSuccess(false);

    if (!transferData.email || !transferData.amount || parseInt(transferData.amount) <= 0) {
      setTransferError('Please enter a valid email and amount.');
      return;
    }

    try {
      await runTransaction(db, async (t) => {
        const targetSnap = await getDocs(query(collection(db, 'users'), where('email', '==', transferData.email.toLowerCase().trim()), limit(1)));
        if (targetSnap.empty) throw new Error("Recipient not found");
        const targetDocRef = targetSnap.docs[0].ref;
        
        const senderRef = doc(db, 'users', user!.uid);
        const senderDoc = await t.get(senderRef);
        const senderBalance = senderDoc.data()?.bountyCoins || 0;
        
        const amount = parseInt(transferData.amount);
        if (senderBalance < amount) throw new Error("Insufficient balance");
        
        t.update(senderRef, { bountyCoins: senderBalance - amount });
        
        const targetBalance = targetSnap.docs[0].data()?.bountyCoins || 0;
        t.update(targetDocRef, { bountyCoins: targetBalance + amount });
        
        const senderTxnRef = doc(collection(db, 'transactions'));
        t.set(senderTxnRef, {
          userId: user!.uid,
          amount: -amount,
          type: "transfer_out",
          description: `Transfer to ${transferData.email}: ${transferData.note || 'No note'}`,
          timestamp: serverTimestamp(),
          relatedUserId: targetSnap.docs[0].id
        });
        
        const targetTxnRef = doc(collection(db, 'transactions'));
        t.set(targetTxnRef, {
          userId: targetSnap.docs[0].id,
          amount: amount,
          type: "transfer_in",
          description: `Transfer from ${user!.email}: ${transferData.note || 'No note'}`,
          timestamp: serverTimestamp(),
          relatedUserId: user!.uid
        });
      });
      
      setTransferSuccess(true);
      setTransferData({ email: '', amount: '', note: '' });
      setTimeout(() => setIsTransferring(false), 2000);
    } catch (err: any) {
      setTransferError(err.message);
    }
  };

  useEffect(() => {
    if (!user) return;

    // Listen to user balance
    const userUnsubscribe = onSnapshot(doc(db, 'users', user.uid), (doc) => {
      if (doc.exists()) {
        setBalance(doc.data().bountyCoins || 0);
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, `users/${user.uid}`));

    // Listen to transactions
    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc')
    );

    const transUnsubscribe = onSnapshot(q, (snapshot) => {
      const txns = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Transaction[];
      setTransactions(txns);
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'transactions'));

    return () => {
      userUnsubscribe();
      transUnsubscribe();
    };
  }, [user]);

  const filteredAndSortedTransactions = transactions
    .filter(txn => {
      if (filter === 'all') return true;
      if (filter === 'income') return txn.amount > 0;
      if (filter === 'expense') return txn.amount < 0;
      return txn.type === filter;
    })
    .sort((a, b) => {
      const direction = sortOrder === 'desc' ? -1 : 1;
      if (sortBy === 'date') {
        const timeA = a.timestamp?.seconds || 0;
        const timeB = b.timestamp?.seconds || 0;
        return (timeA - timeB) * direction;
      } else {
        return (Math.abs(a.amount) - Math.abs(b.amount)) * direction;
      }
    });

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <header className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/')} className="p-2 -ml-2 text-gray-400 hover:text-black transition-colors rounded-full hover:bg-gray-50">
              <ChevronLeft size={24} />
            </button>
            <div>
              <h1 className="font-black text-2xl tracking-tight leading-none mb-1">Bounty Wallet</h1>
              <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">Game Economy & Rewards</p>
            </div>
          </div>
          <div className="bg-gray-50 p-3 rounded-2xl flex items-center gap-3">
             <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center text-white">
                <WalletIcon size={20} />
             </div>
          </div>
        </header>

        {/* Balance Card */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-[#1D1D1F] rounded-[40px] p-10 text-white mb-12 shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 blur-[100px] -mr-32 -mt-32" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4 opacity-50 uppercase tracking-[0.2em] text-[10px] font-black">
              <Coins size={12} />
              <span>Available Balance</span>
            </div>
            <div className="flex items-baseline gap-4 mb-8">
              <span className="text-7xl font-black tracking-tighter">{balance.toLocaleString()}</span>
              <span className="text-xl font-bold opacity-30 tracking-widest uppercase">BC</span>
            </div>
            <div className="flex flex-wrap gap-3">
              <button 
                onClick={() => setIsDepositing(true)}
                className="bg-yellow-400 text-yellow-950 px-6 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-yellow-500 transition-colors flex items-center gap-2 shadow-lg shadow-yellow-500/20"
              >
                <ArrowDownToLine size={16} /> Deposit
              </button>
              <button 
                onClick={() => setIsWithdrawing(true)}
                className="bg-white text-black px-6 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-100 transition-colors flex items-center gap-2"
              >
                <ArrowRight size={16} /> Withdraw
              </button>
              <button 
                onClick={() => setIsTransferring(true)}
                className="bg-blue-600 text-white px-6 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-colors"
              >
                Send Coins
              </button>
            </div>
            <div className="mt-6 flex items-center gap-2 text-[10px] text-white/40 font-bold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Real money conversions supported • 100 UGX = 1 BC</span>
            </div>
          </div>
        </motion.div>

        {/* Transfer Modal */}
        {isTransferring && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl"
            >
              <h3 className="text-2xl font-black tracking-tight mb-2">Send Bounty Coins</h3>
              <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-6">Transfers are instant and non-reversible</p>
              
              <form onSubmit={handleTransfer} className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase font-black text-gray-400 tracking-widest mb-1.5">Recipient Email</label>
                  <input 
                    type="email" 
                    required
                    value={transferData.email}
                    onChange={(e) => setTransferData({ ...transferData, email: e.target.value })}
                    className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-blue-600 outline-none"
                    placeholder="player@example.com"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-black text-gray-400 tracking-widest mb-1.5">Amount (BC)</label>
                  <input 
                    type="number" 
                    required
                    min="1"
                    max={balance}
                    value={transferData.amount}
                    onChange={(e) => setTransferData({ ...transferData, amount: e.target.value })}
                    className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-blue-600 outline-none"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-black text-gray-400 tracking-widest mb-1.5">Optional Note</label>
                  <input 
                    type="text" 
                    value={transferData.note}
                    onChange={(e) => setTransferData({ ...transferData, note: e.target.value })}
                    className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-blue-600 outline-none"
                    placeholder="For your great match!"
                  />
                </div>

                {transferError && (
                  <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-xs font-bold leading-relaxed">
                    {transferError}
                  </div>
                )}

                {transferSuccess && (
                  <div className="p-4 bg-green-50 text-green-600 rounded-2xl text-xs font-bold leading-relaxed">
                    Coins transferred successfully!
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsTransferring(false)}
                    className="flex-1 bg-gray-50 text-gray-400 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-black text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-800 transition-colors"
                  >
                    Confirm Send
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Transaction History */}
        <section>
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                <HistoryIcon size={16} />
              </div>
              <h2 className="font-black text-lg tracking-tight">Activity Log</h2>
            </div>

            <div className="flex flex-wrap gap-2">
              <select 
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="bg-gray-50 border border-gray-100 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="all">All Activity</option>
                <option value="income">Income Only</option>
                <option value="expense">Expenses Only</option>
                <option value="win">Wins</option>
                <option value="wager">Wagers</option>
                <option value="purchase">Store</option>
                <option value="transfer_in">Received</option>
                <option value="transfer_out">Sent</option>
              </select>

              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-gray-50 border border-gray-100 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="date">Sort by Date</option>
                <option value="amount">Sort by Amount</option>
              </select>

              <button 
                onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                className="bg-gray-50 border border-gray-100 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-100 transition-colors"
              >
                {sortOrder === 'desc' ? '↓ Newest' : '↑ Oldest'}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-20 text-gray-300 font-bold uppercase tracking-widest text-xs">Syncing Transactions...</div>
            ) : filteredAndSortedTransactions.length === 0 ? (
              <div className="bg-gray-50 rounded-3xl p-12 text-center">
                <p className="text-gray-400 font-bold">No transactions found matching your filters.</p>
              </div>
            ) : (
              filteredAndSortedTransactions.map((txn, index) => (
                <motion.div 
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: index * 0.05 }}
                  key={txn.id}
                  className="flex items-center justify-between p-6 bg-white border border-gray-100 rounded-3xl hover:border-gray-300 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                      txn.amount > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                    }`}>
                      {txn.amount > 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm capitalize">{txn.type.replace('_', ' ')}</h4>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                        {txn.timestamp?.toDate().toLocaleDateString()} • {txn.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-black text-lg tracking-tight ${
                      txn.amount > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {txn.amount > 0 ? '+' : ''}{txn.amount}
                    </div>
                    <p className="text-[10px] text-gray-300 font-black tracking-widest uppercase">Coins</p>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </section>
      </div>
      
      <WithdrawModal 
        isOpen={isWithdrawing} 
        onClose={() => setIsWithdrawing(false)} 
        balance={balance} 
      />
      
      <BuyBCModal 
        isOpen={isDepositing} 
        onClose={() => setIsDepositing(false)} 
      />
    </div>
  );
};

export default Wallet;
