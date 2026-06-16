import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAIOcnx1-35mXPaSE3n9DZChEUvUQ0gZwU",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "lifeflow-eed92.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "lifeflow-eed92",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "lifeflow-eed92.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "659656165907",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:659656165907:web:fb3d2a4fa02fb73cb78de6",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

export default app;
export { db, storage };
