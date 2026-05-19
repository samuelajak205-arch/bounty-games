import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);

      if (user) {
        // Sync user profile to Firestore asynchronously so it doesn't block loading
        const syncUser = async () => {
          try {
            const userRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userRef);
            
            const userData = {
              displayName: user.displayName || user.email?.split('@')[0] || 'Unknown Player',
              email: user.email || 'no-email',
              photoURL: user.photoURL || null,
              lastActive: serverTimestamp(),
            };

            if (!userDoc.exists()) {
              await setDoc(userRef, {
                ...userData,
                bountyCoins: 0, // No signup rewards
                elo: 1200, // Initial rating
                isPublicCoins: false,
                createdAt: serverTimestamp(),
              });
            } else {
              await setDoc(userRef, { lastActive: serverTimestamp() }, { merge: true });
            }
          } catch (err: any) {
            console.error("User sync failed. Error:", err?.message || err);
            // More detailed diagnostics for "Missing or insufficient permissions"
            if (err?.message?.includes('permissions')) {
              console.log("Auth State at failure:", {
                uid: user.uid,
                email: user.email,
                emailVerified: user.emailVerified
              });
            }
          }
        };
        syncUser();
      }
    });

    return () => unsubscribe();
  }, []);

  // Heartbeat for active users
  useEffect(() => {
    if (!user) return;
    
    const interval = setInterval(async () => {
      try {
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, { lastActive: serverTimestamp() }, { merge: true });
      } catch (err) {
        // Silently fail heartbeat
      }
    }, 60000); // Once per minute

    return () => clearInterval(interval);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
