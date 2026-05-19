import React, { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, runTransaction, doc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { ChevronLeft, Loader2, Check, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface WithdrawalRequest {
  id: string;
  userId: string;
  amountUGX: number;
  bcDeducted: number;
  phoneNumber: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  requestedAt: any;
  processedAt?: any;
}

const AdminWithdrawals = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    
    // Check if user is admin, if not redirect
    const isAdmin = user.email?.toLowerCase().trim() === 'samuelajak205@gmail.com';
    if (!isAdmin) {
      navigate('/');
      return;
    }

    const q = query(collection(db, 'withdrawals'), orderBy('requestedAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as WithdrawalRequest[];
      setRequests(data);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'withdrawals'));

    return () => unsubscribe();
  }, [user, navigate]);

  const handleProcess = async (id: string, status: 'completed' | 'failed') => {
    if (!window.confirm(`Are you sure you want to mark this request as ${status}?`)) return;
    
    setProcessingId(id);
    try {
      if (!user) throw new Error("Not authenticated");
      
      await runTransaction(db, async (t) => {
        const withdrawRef = doc(db, 'withdrawals', id);
        const wDoc = await t.get(withdrawRef);
        if (!wDoc.exists()) throw new Error("Request not found");
        
        const wData = wDoc.data() as any;
        if (wData.status !== 'pending') throw new Error("Request is no longer pending");
        
        t.update(withdrawRef, {
          status,
          processedAt: new Date().toISOString(),
          processedBy: user.uid
        });
        
        if (wData.transactionId) {
          t.update(doc(db, 'transactions', wData.transactionId), {
            type: status === 'completed' ? 'withdrawal' : 'withdrawal_failed',
            description: status === 'completed' ? `Withdrawal completed: ${wData.amountUGX} UGX` : `Withdrawal failed/refunded`
          });
        }
        
        if (status === 'failed') {
          const userRef = doc(db, 'users', wData.userId);
          const uDoc = await t.get(userRef);
          if (uDoc.exists()) {
            t.update(userRef, {
              bountyCoins: (uDoc.data().bountyCoins || 0) + wData.bcDeducted
            });
          }
        }
      });
      
    } catch (err: any) {
      alert(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] dark:bg-[#000000] p-6 lg:p-12">
      <div className="max-w-5xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/admin')} className="p-2 -ml-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors rounded-full hover:bg-gray-200 dark:hover:bg-gray-800">
              <ChevronLeft size={24} />
            </button>
            <div>
              <h1 className="font-black text-2xl tracking-tight leading-none mb-1 dark:text-white">Withdrawals Mgmt</h1>
              <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">Admin Tools</p>
            </div>
          </div>
        </header>

        <div className="bg-white dark:bg-gray-900 rounded-[32px] p-8 shadow-xl border border-gray-100 dark:border-gray-800">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="animate-spin text-gray-400" size={32} />
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-20 text-gray-400 font-bold uppercase tracking-widest text-xs">
              No withdrawal requests found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="pb-4 text-[10px] uppercase font-black text-gray-400 tracking-widest">Date / ID</th>
                    <th className="pb-4 text-[10px] uppercase font-black text-gray-400 tracking-widest">User ID</th>
                    <th className="pb-4 text-[10px] uppercase font-black text-gray-400 tracking-widest text-right">Amount (UGX)</th>
                    <th className="pb-4 text-[10px] uppercase font-black text-gray-400 tracking-widest text-right">BC Deducted</th>
                    <th className="pb-4 text-[10px] uppercase font-black text-gray-400 tracking-widest">Phone</th>
                    <th className="pb-4 text-[10px] uppercase font-black text-gray-400 tracking-widest text-center">Status</th>
                    <th className="pb-4 text-[10px] uppercase font-black text-gray-400 tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {requests.map(req => (
                    <tr key={req.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="py-4">
                        <div className="font-bold text-xs dark:text-white">{req.requestedAt?.toDate().toLocaleDateString() || 'N/A'}</div>
                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">{req.id.substring(0, 8)}...</div>
                      </td>
                      <td className="py-4 text-xs font-mono text-gray-500 dark:text-gray-400">{req.userId}</td>
                      <td className="py-4 text-right font-black text-green-600 dark:text-green-400">{req.amountUGX.toLocaleString()}</td>
                      <td className="py-4 text-right font-bold text-yellow-600 dark:text-yellow-500">{req.bcDeducted.toLocaleString()}</td>
                      <td className="py-4 text-xs font-bold dark:text-white">{req.phoneNumber}</td>
                      <td className="py-4 text-center">
                        <span className={`inline-block px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wider ${
                          req.status === 'completed' ? 'bg-green-100 text-green-700' :
                          req.status === 'failed' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="py-4 text-right">
                        {req.status === 'pending' || req.status === 'processing' ? (
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => handleProcess(req.id, 'completed')}
                              disabled={processingId === req.id}
                              className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg flex items-center justify-center transition-colors disabled:opacity-50"
                              title="Mark as Completed"
                            >
                              {processingId === req.id ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
                            </button>
                            <button 
                              onClick={() => handleProcess(req.id, 'failed')}
                              disabled={processingId === req.id}
                              className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg flex items-center justify-center transition-colors disabled:opacity-50"
                              title="Reject / Fail & Refund"
                            >
                              {processingId === req.id ? <Loader2 className="animate-spin" size={14} /> : <X size={14} />}
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-gray-400 uppercase">Processed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminWithdrawals;
