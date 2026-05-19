import React, { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, increment } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingBag, ChevronLeft, Coins, CheckCircle2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface StoreItem {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
  category: string;
}

const Store = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<StoreItem[]>([]);
  const [userCoins, setUserCoins] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    // Listen to store items
    const unsubscribeItems = onSnapshot(collection(db, 'store_items'), (snapshot) => {
      const storeItems = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as StoreItem[];
      setItems(storeItems);
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'store_items'));

    // Listen to user balance
    if (user) {
      const unsubscribeUser = onSnapshot(doc(db, 'users', user.uid), (doc) => {
        if (doc.exists()) {
          setUserCoins(doc.data().bountyCoins || 0);
        }
      }, (err) => handleFirestoreError(err, OperationType.GET, `users/${user.uid}`));
      return () => {
        unsubscribeItems();
        unsubscribeUser();
      };
    }

    return () => unsubscribeItems();
  }, [user]);

  const handlePurchase = async (item: StoreItem) => {
    if (!user) return;
    if (userCoins < item.price) {
      setMessage({ text: 'Insufficient Bounty Coins', type: 'error' });
      return;
    }

    setPurchasing(item.id);
    try {
      // In a real app, this should be a transaction or cloud function
      // Here we simulate it with client-side updates (rules allow it for MVP)
      const userRef = doc(db, 'users', user.uid);
      
      // 1. Deduct coins
      await updateDoc(userRef, {
        bountyCoins: increment(-item.price)
      });

      // 2. Create transaction record
      await addDoc(collection(db, 'transactions'), {
        userId: user.uid,
        amount: -item.price,
        type: 'purchase',
        description: `Purchased ${item.name}`,
        timestamp: serverTimestamp()
      });

      // 3. Add to inventory (simulation by just logging success for now)
      setMessage({ text: `Successfully purchased ${item.name}!`, type: 'success' });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'purchase_transaction');
      setMessage({ text: 'Purchase failed. Please try again.', type: 'error' });
    } finally {
      setPurchasing(null);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const categories = Array.from(new Set(items.map(i => i.category || 'Legacy')));

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/')} className="p-2 -ml-2 text-gray-400 hover:text-black transition-colors rounded-full hover:bg-white shadow-sm border border-gray-100">
              <ChevronLeft size={24} />
            </button>
            <div>
              <h1 className="font-black text-3xl tracking-tight leading-none mb-1">Bounty Store</h1>
              <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">Premium Digital Assets</p>
            </div>
          </div>

          <motion.button 
            onClick={() => navigate('/wallet')}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="bg-black text-white px-6 py-3 rounded-2xl flex items-center gap-4 shadow-xl shadow-black/10 transition-all border border-white/10"
          >
            <div className="flex flex-col items-start leading-none">
              <span className="text-[10px] font-black opacity-40 uppercase tracking-widest mb-1">Your Balance</span>
              <span className="text-lg font-black tracking-tight">{userCoins.toLocaleString()} <span className="text-xs opacity-50 ml-0.5">BC</span></span>
            </div>
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
              <Coins size={20} className="text-yellow-400" />
            </div>
          </motion.button>
        </header>

        <AnimatePresence>
          {message && (
            <motion.div 
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className={`mb-8 p-4 rounded-2xl flex items-center gap-3 font-bold text-sm ${
                message.type === 'success' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'
              }`}
            >
              {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              {message.text}
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 gap-4 opacity-30">
            <ShoppingBag size={48} className="animate-bounce" />
            <p className="font-black uppercase tracking-[0.3em] text-xs">Opening Storefront...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-[40px] p-20 text-center shadow-sm">
             <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-300">
                <ShoppingBag size={32} />
             </div>
             <h3 className="font-black text-2xl tracking-tight mb-2">Inventory Arriving Soon</h3>
             <p className="text-gray-400 max-w-xs mx-auto text-sm leading-relaxed">Our quarterly drop is scheduled for next week. Check back soon for exclusive chess themes.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {items.map((item, index) => (
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: index * 0.1 }}
                key={item.id}
                className="bg-white rounded-[40px] p-8 border border-gray-100 hover:border-blue-200 transition-all group hover:shadow-2xl hover:shadow-blue-900/5"
              >
                <div className="aspect-square bg-gray-50 rounded-[32px] mb-6 overflow-hidden flex items-center justify-center relative">
                   {item.imageUrl ? (
                     <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                   ) : (
                     <div className="flex flex-col items-center gap-2 opacity-10">
                        <ShoppingBag size={64} />
                        <span className="font-black uppercase tracking-widest text-[10px]">No Preview</span>
                     </div>
                   )}
                   <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest text-gray-400">
                      {item.category || 'Essential'}
                   </div>
                </div>

                <div className="mb-8">
                  <h3 className="font-black text-xl tracking-tight mb-1">{item.name}</h3>
                  <p className="text-gray-400 text-xs font-medium leading-relaxed">{item.description}</p>
                </div>

                <div className="flex items-center justify-between pt-6 border-t border-gray-50">
                   <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-black tracking-widest text-gray-300">Price</span>
                      <div className="flex items-center gap-1">
                        <span className="text-xl font-black">{item.price}</span>
                        <span className="text-[10px] font-black text-blue-600 uppercase">BC</span>
                      </div>
                   </div>
                   <button 
                     disabled={purchasing === item.id || userCoins < item.price}
                     onClick={() => handlePurchase(item)}
                     className={`px-6 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all ${
                       purchasing === item.id 
                         ? 'bg-gray-100 text-gray-400' 
                         : userCoins < item.price 
                           ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                           : 'bg-black text-white hover:bg-blue-600 shadow-lg shadow-black/5'
                     }`}
                   >
                     {purchasing === item.id ? 'Processing...' : userCoins < item.price ? 'Locked' : 'Purchase'}
                   </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Store;
