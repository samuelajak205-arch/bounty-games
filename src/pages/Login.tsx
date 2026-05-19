import React from 'react';
import { signInWithGoogle } from '../lib/firebase';
import { motion } from 'motion/react';
import { BrainCircuit, LogIn } from 'lucide-react';

export default function Login() {
  return (
    <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white p-10 rounded-[32px] shadow-2xl shadow-gray-200 text-center"
      >
        <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center text-white mx-auto mb-6 shadow-lg">
          <BrainCircuit size={32} />
        </div>
        <h1 className="text-3xl font-black text-[#1D1D1F] mb-2 tracking-tight">Grandmaster AI</h1>
        <p className="text-gray-500 mb-10 leading-relaxed">
          Welcome back. Sign in to track your matches and play with others.
        </p>

        <button 
          onClick={() => signInWithGoogle()}
          className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 py-4 rounded-2xl transition-all font-bold text-lg shadow-sm active:scale-95"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/smartlock/google.svg" alt="Google" className="w-6 h-6" />
          Sign in with Google
        </button>

        <div className="mt-8 pt-8 border-t border-gray-100 flex items-center justify-center gap-2 text-[10px] text-gray-300 uppercase tracking-[0.2em] font-bold">
          <LogIn size={10} />
          Secure Enterprise Authentication
        </div>
      </motion.div>
    </div>
  );
}
