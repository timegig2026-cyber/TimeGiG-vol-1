import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBpR2SyQnfBxjXRmpmKQaqhzVCoy2gs2Cg",
  authDomain: "gen-lang-client-0530555722.firebaseapp.com",
  projectId: "gen-lang-client-0530555722",
  storageBucket: "gen-lang-client-0530555722.firebasestorage.app",
  messagingSenderId: "518497463646",
  appId: "1:518497463646:web:69dc16a1c7606b396833cf"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app, "ai-studio-walletandreferra-284125b6-7f7d-4b7c-b98f-58a6a075ca49");
const auth = getAuth(app);

export { app, db, auth };
