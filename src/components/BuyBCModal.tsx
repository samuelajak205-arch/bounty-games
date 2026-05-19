import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Smartphone, Coins, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

interface BuyBCModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BuyBCModal: React.FC<BuyBCModalProps> = ({ isOpen, onClose }) => {
  const [amount, setAmount] = useState<number>(5000);
  const [network, setNetwork] = useState<'MTN' | 'AIRTEL'>('MTN');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successStatus, setSuccessStatus] = useState<string | null>(null);

  const amounts = [
    { ugx: 5000, bc: 50 },
    { ugx: 10000, bc: 100 },
    { ugx: 20000, bc: 200 },
    { ugx: 50000, bc: 500 },
  ];

  const handlePurchase = async () => {
    if (!phoneNumber) {
      setError('Please enter your phone number');
      return;
    }
    
    setError(null);
    setLoading(true);
    
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Must be logged in to purchase");
      
      const idToken = await user.getIdToken();
      
      const response = await fetch('/api/payments/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          amount,
          phoneNumber,
          network
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to initiate payment');
      }
      
      if (data.orderId) {
        await setDoc(doc(db, 'transactions', data.orderId), {
          userId: user.uid,
          amount: Number(amount),
          type: "buy_bc_pending",
          description: `Initiated purchase of BC for ${amount} UGX`,
          timestamp: serverTimestamp(),
          network,
          phoneNumber,
          status: "pending",
          orderTrackingId: data.order_tracking_id || ''
        });
      }

      if (data.redirect_url) {
        setSuccessStatus(`Success! Please proceed to the payment page.`);
        window.open(data.redirect_url, '_blank');
      }
    } catch (err: any) {
      setError(err.message || 'Payment initiation failed');
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
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative bg-white dark:bg-gray-900 rounded-3xl overflow-hidden shadow-2xl w-full max-w-sm"
          >
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-xl font-black dark:text-white tracking-tight flex items-center gap-2">
                <Coins className="text-yellow-500" size={24} />
                Buy Bounty Coins
              </h2>
              <button 
                onClick={onClose}
                className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
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
              
              {successStatus ? (
                <div className="p-8 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-500 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle size={32} />
                  </div>
                  <h3 className="font-black text-xl mb-2 dark:text-white">Payment Initiated</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                    A new tab was opened for PesaPal checkout. 
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
                  <div>
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-3 block">Select Amount</label>
                    <div className="grid grid-cols-2 gap-3">
                      {amounts.map((pkg) => (
                        <button
                          key={pkg.ugx}
                          onClick={() => setAmount(pkg.ugx)}
                          className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center ${
                            amount === pkg.ugx 
                              ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20' 
                              : 'border-gray-100 dark:border-gray-800 hover:border-blue-200 bg-white dark:bg-gray-900'
                          }`}
                        >
                          <span className="font-black text-lg dark:text-white flex items-center gap-1">
                            {pkg.bc} <Coins size={14} className="text-yellow-500" />
                          </span>
                          <span className="text-[10px] font-bold text-gray-400 uppercase">{pkg.ugx.toLocaleString()} UGX</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-3 block">Network Provider</label>
                    <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl">
                      <button 
                        onClick={() => setNetwork('MTN')}
                        className={`flex-1 py-3 text-[11px] font-black uppercase tracking-wider rounded-xl transition-all ${network === 'MTN' ? 'bg-white dark:bg-gray-700 text-yellow-600 shadow-sm' : 'text-gray-500'}`}
                      >
                        MTN MoMo
                      </button>
                      <button 
                        onClick={() => setNetwork('AIRTEL')}
                        className={`flex-1 py-3 text-[11px] font-black uppercase tracking-wider rounded-xl transition-all ${network === 'AIRTEL' ? 'bg-white dark:bg-gray-700 text-red-500 shadow-sm' : 'text-gray-500'}`}
                      >
                        Airtel Money
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2 block">Phone Number</label>
                    <div className="relative">
                      <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder={network === 'MTN' ? "0771000000 (Sandbox)" : "0751000000 (Sandbox)"}
                        className="w-full bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-blue-500 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold dark:text-white outline-none transition-all placeholder:font-medium placeholder:text-gray-400"
                      />
                    </div>
                  </div>

                  <button 
                    onClick={handlePurchase}
                    disabled={loading || !phoneNumber}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-2xl py-4 font-black flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest text-xs shadow-lg shadow-blue-600/30"
                  >
                    {loading ? (
                      <><Loader2 className="animate-spin" size={18} /> Processing...</>
                    ) : (
                      <>Pay {amount.toLocaleString()} UGX</>
                    )}
                  </button>
                  <p className="text-center text-[10px] font-medium text-gray-400 mt-2">PIN for sandbox payments is 12345</p>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
