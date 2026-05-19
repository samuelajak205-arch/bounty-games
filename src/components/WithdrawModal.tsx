import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Smartphone, Loader2, CheckCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { runTransaction, doc, collection, serverTimestamp } from 'firebase/firestore';

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  balance: number;
}

export const WithdrawModal: React.FC<WithdrawModalProps> = ({ isOpen, onClose, balance }) => {
  const [amountUGX, setAmountUGX] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const bcNeeded = amountUGX ? Math.ceil(parseInt(amountUGX) / 100) : 0;
  const balanceUGX = balance * 100;

  const handleWithdraw = async () => {
    if (!amountUGX || parseInt(amountUGX) < 1000) {
      setError('Minimum withdrawal is 1,000 UGX');
      return;
    }
    
    if (bcNeeded > balance) {
      setError('Insufficient Bounty Coins balance');
      return;
    }
    
    if (!phoneNumber) {
      setError('Please enter your phone number');
      return;
    }
    
    setError(null);
    setLoading(true);
    
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Must be logged in to withdraw");
      
      await runTransaction(db, async (t) => {
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await t.get(userRef);
        
        if (!userDoc.exists()) throw new Error("User not found");
        
        const currentBalance = userDoc.data().bountyCoins || 0;
        if (currentBalance < bcNeeded) {
          throw new Error("Insufficient Bounty Coins");
        }
        
        const withdrawRef = doc(collection(db, 'withdrawals'));
        const txnRef = doc(collection(db, 'transactions'));
        
        t.update(userRef, {
          bountyCoins: currentBalance - bcNeeded
        });
        
        t.set(withdrawRef, {
          userId: user.uid,
          amountUGX: parseInt(amountUGX),
          bcDeducted: bcNeeded,
          phoneNumber,
          status: 'pending',
          requestedAt: serverTimestamp(),
          transactionId: txnRef.id
        });
        
        t.set(txnRef, {
          userId: user.uid,
          amount: -bcNeeded,
          type: "withdrawal_pending",
          description: `Withdrawal request for ${amountUGX} UGX`,
          timestamp: serverTimestamp(),
          withdrawalId: withdrawRef.id
        });
      });
      
      setSuccess(true);
    } catch (err: any) {
      console.error("error submitting withdrawal:", err);
      setError(err.message || 'Withdrawal request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={loading ? undefined : onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative bg-white dark:bg-gray-900 rounded-3xl overflow-hidden shadow-2xl w-full max-w-sm"
          >
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-xl font-black dark:text-white tracking-tight">Withdraw Funds</h2>
              <button 
                onClick={onClose}
                disabled={loading}
                className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                <X size={18} className="text-gray-600 dark:text-gray-300" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl text-sm font-medium flex items-start gap-3">
                  <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                  {error}
                </div>
              )}
              
              {success ? (
                <div className="py-6 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-500 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle size={32} />
                  </div>
                  <h3 className="font-black text-xl mb-2 dark:text-white">Request Submitted</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 px-4">
                    Your withdrawal request for {parseInt(amountUGX).toLocaleString()} UGX has been submitted and is pending admin approval.
                  </p>
                  <button 
                    onClick={onClose}
                    className="w-full py-4 rounded-xl flex items-center justify-center gap-2 font-black text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors uppercase tracking-widest text-xs"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase text-gray-400 dark:text-gray-500 tracking-widest mb-1">Available</p>
                      <p className="text-lg font-black tracking-tight dark:text-white">{balanceUGX.toLocaleString()} UGX</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black uppercase text-gray-400 dark:text-gray-500 tracking-widest mb-1">Balance</p>
                      <p className="text-sm font-bold tracking-tight text-yellow-600">{balance.toLocaleString()} BC</p>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2 block">Amount to Withdraw (UGX)</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1000"
                        max={balanceUGX}
                        step="100"
                        value={amountUGX}
                        onChange={(e) => setAmountUGX(e.target.value)}
                        placeholder="e.g. 5000"
                        className="w-full bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-blue-500 rounded-2xl py-4 px-4 text-lg font-black dark:text-white outline-none transition-all placeholder:font-medium placeholder:text-gray-400"
                      />
                    </div>
                    
                    {amountUGX && parseInt(amountUGX) > 0 && (
                      <div className="mt-3 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 font-medium bg-blue-50 dark:bg-blue-900/10 p-3 rounded-xl border border-blue-100 dark:border-blue-900/20">
                        <span>Costs:</span>
                        <span className="font-bold text-blue-600 dark:text-blue-400">{bcNeeded.toLocaleString()} BC</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2 block">Phone Number (MTN/Airtel)</label>
                    <div className="relative">
                      <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="07..."
                        className="w-full bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-blue-500 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold dark:text-white outline-none transition-all placeholder:font-medium placeholder:text-gray-400"
                      />
                    </div>
                    <p className="text-[10px] text-gray-500 mt-2 font-medium">Must be your registered mobile money number.</p>
                  </div>

                  <button 
                    onClick={handleWithdraw}
                    disabled={loading || !amountUGX || !phoneNumber || bcNeeded > balance}
                    className="w-full bg-black dark:bg-white text-white dark:text-black rounded-2xl py-4 font-black flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest text-xs shadow-lg"
                  >
                    {loading ? (
                      <><Loader2 className="animate-spin" size={18} /> Processing...</>
                    ) : (
                      <>Withdraw {amountUGX ? parseInt(amountUGX).toLocaleString() : '0'} UGX <ArrowRight size={16} /></>
                    )}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
