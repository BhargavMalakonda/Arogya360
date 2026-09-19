import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  // loading stays TRUE until the full async sequence (auth check + Firestore fetch)
  // has resolved at least once. It NEVER drops to false before that is complete.
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // isMounted guards against StrictMode's double-invoke unmount/remount cycle:
    // if the effect cleanup runs before the async getDoc resolves, we must not
    // call setLoading(false) on the dead first instance.
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // If this callback fires after the effect has been cleaned up (StrictMode
      // unmount, or component unmount), discard the result entirely.
      if (!isMounted) return;

      if (firebaseUser) {
        // Do NOT touch loading or user state until the full profile fetch is done.
        // This ensures IndexRedirect never evaluates while userProfile is still null
        // for a user who actually has a Firestore document.
        try {
          const userRef = doc(db, 'users', firebaseUser.uid);
          const userSnap = await getDoc(userRef);

          // Check again after the await — the component may have unmounted
          // while getDoc was in flight (e.g. StrictMode cleanup).
          if (!isMounted) return;

          if (userSnap.exists()) {
            setUserProfile(userSnap.data());
          } else {
            setUserProfile(null);
          }
        } catch (err) {
          console.error('[AuthContext] getDoc failed:', err);
          if (!isMounted) return;
          setUserProfile(null);
        }

        // Set user and drop loading in a single batch, AFTER profile is settled.
        // React 18/19 batches these two calls into one render since they're in
        // the same async continuation.
        setUser(firebaseUser);
        setLoading(false);
      } else {
        // Logged out — clear everything and drop loading.
        setUser(null);
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const logout = () => {
    signOut(auth);
  };

  const refreshProfile = async () => {
    if (user) {
      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setUserProfile(userSnap.data());
        } else {
          setUserProfile(null);
        }
      } catch (err) {
        console.error('[AuthContext] refreshProfile failed:', err);
      }
    }
  };

  const value = {
    user,
    userProfile,
    loading,
    logout,
    refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
