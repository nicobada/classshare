import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'

const AuthContext = createContext(null)

const DEMO_ADMIN_EMAIL = (import.meta.env.VITE_DEMO_ADMIN_EMAIL || 'admin@classshare.app').trim().toLowerCase()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser)

        // Check Firebase Custom User Claim `admin`, with fallback for designated demo admin account
        const tokenResult = await firebaseUser.getIdTokenResult()
        const isClaimAdmin = !!tokenResult.claims.admin
        const isDemoAdmin = Boolean(
          DEMO_ADMIN_EMAIL && firebaseUser.email?.toLowerCase() === DEMO_ADMIN_EMAIL
        )
        setIsAdmin(isClaimAdmin || isDemoAdmin)

        const snap = await getDoc(doc(db, 'profiles', firebaseUser.uid))
        if (snap.exists()) setProfile(snap.data())
      } else {
        setUser(null)
        setProfile(null)
        setIsAdmin(false)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  return (
    <AuthContext.Provider value={{ user, profile, setProfile, isAdmin, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
