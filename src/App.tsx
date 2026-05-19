import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { Navbar } from './components/Navbar';
import Login from './pages/Login';
import Lobby from './pages/Lobby';
import Match from './pages/Match';
import Practice from './pages/Practice';
import Bounty from './pages/Bounty';
import Tournaments from './pages/Tournaments';
import TournamentArena from './pages/TournamentArena';
import Wallet from './pages/Wallet';
import Store from './pages/Store';
import { Admin } from './pages/Admin';
import AdminWithdrawals from './pages/AdminWithdrawals';
import { PlayVsHuman } from './pages/PlayVsHuman';
import { AlertCircle } from 'lucide-react';
import { CookieNotice } from './components/CookieNotice';
import { AdBanner } from './components/AdBanner';
import { Settings } from './components/Settings';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" />;
  return <>{children}</>;
};

export default function App() {
  const { user } = useAuth();

  return (
    <Router>
      <div className="min-h-screen bg-[#F5F5F7] dark:bg-[#000000] text-gray-900 dark:text-gray-100 transition-colors duration-300">
        {user && <Navbar />}
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
          <Route path="/" element={
            <ProtectedRoute>
              <Lobby />
            </ProtectedRoute>
          } />
          <Route path="/match/:id" element={
            <ProtectedRoute>
              <Match />
            </ProtectedRoute>
          } />
          <Route path="/practice" element={
            <ProtectedRoute>
              <Practice />
            </ProtectedRoute>
          } />
          <Route path="/bounty" element={
            <ProtectedRoute>
              <Bounty />
            </ProtectedRoute>
          } />
          <Route path="/tournaments" element={
            <ProtectedRoute>
              <Tournaments />
            </ProtectedRoute>
          } />
          <Route path="/tournament/:id" element={
            <ProtectedRoute>
              <TournamentArena />
            </ProtectedRoute>
          } />
          <Route path="/wallet" element={
            <ProtectedRoute>
              <Wallet />
            </ProtectedRoute>
          } />
          <Route path="/store" element={
            <ProtectedRoute>
              <Store />
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute>
              <Admin />
            </ProtectedRoute>
          } />
          <Route path="/admin/withdrawals" element={
            <ProtectedRoute>
              <AdminWithdrawals />
            </ProtectedRoute>
          } />
          <Route path="/play-human" element={
            <ProtectedRoute>
              <PlayVsHuman />
            </ProtectedRoute>
          } />
        </Routes>
        
        {/* Global Footer Attribution */}
        <footer className="py-12 flex flex-col items-center gap-8 border-t border-gray-100 mt-20 max-w-4xl mx-auto">
          {user && <AdBanner slot="footer-main-banner" />}
          
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-2 opacity-20 hover:opacity-100 transition-opacity">
              <AlertCircle size={14} />
              <p className="text-[10px] uppercase font-black tracking-[0.2em] text-gray-400">
                Validated Engine • Real-time Sync • AI Integration
              </p>
            </div>
            <p className="text-[10px] text-gray-300 font-bold uppercase tracking-widest">
              Built with Google AI Studio & Firebase
            </p>
          </div>
        </footer>

        <CookieNotice />
        <Settings />
      </div>
    </Router>
  );
}
