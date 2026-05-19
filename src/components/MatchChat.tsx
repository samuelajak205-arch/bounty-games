import React, { useState, useEffect, useRef } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, query, orderBy, limit, onSnapshot, 
  addDoc, serverTimestamp, where 
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { Send, MessageSquare, Shield } from 'lucide-react';

interface Message {
  id: string;
  fromId: string;
  fromName: string;
  content: string;
  timestamp: any;
}

export const MatchChat: React.FC<{ matchId: string }> = ({ matchId }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!matchId) return;

    const q = query(
      collection(db, 'matches', matchId, 'chat'),
      orderBy('timestamp', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(msgs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `matches/${matchId}/chat`);
    });

    return () => unsubscribe();
  }, [matchId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !matchId) return;

    const content = newMessage.trim();
    setNewMessage('');

    try {
      await addDoc(collection(db, 'matches', matchId, 'chat'), {
        fromId: user.uid,
        fromName: user.displayName || 'Anonymous',
        content,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error("Chat error:", error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 overflow-hidden">
      <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
        <MessageSquare className="text-blue-500" size={16} />
        <h3 className="text-[10px] font-black uppercase tracking-widest dark:text-gray-400">Battle Chat</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex flex-col ${msg.fromId === user?.uid ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[8px] font-black uppercase text-gray-400">
                {msg.fromName}
              </span>
            </div>
            <div 
              className={`max-w-[80%] p-3 rounded-2xl text-xs font-medium ${
                msg.fromId === user?.uid 
                  ? 'bg-blue-600 text-white rounded-tr-none' 
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-none'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>

      <form onSubmit={sendMessage} className="p-4 border-t border-gray-100 dark:border-gray-800 flex gap-2">
        <input 
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 px-4 py-3 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:text-white"
        />
        <button 
          type="submit"
          className="bg-black dark:bg-blue-600 text-white p-3 rounded-xl hover:scale-105 active:scale-95 transition-all"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
};
