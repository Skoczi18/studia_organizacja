import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'

// Konfiguracja webowa Firebase jest publiczna z założenia — dostęp chronią reguły Firestore.
const firebaseConfig = {
  apiKey: 'AIzaSyAhEymJeNFSXxoUjJK3bamnJX5yH6yOkP0',
  authDomain: 'studia-organizacja.firebaseapp.com',
  projectId: 'studia-organizacja',
  storageBucket: 'studia-organizacja.firebasestorage.app',
  messagingSenderId: '375516120485',
  appId: '1:375516120485:web:f43be07c86d84b5580544c'
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
})
