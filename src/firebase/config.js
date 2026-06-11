import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAIOcnx1-35mXPaSE3n9DZChEUvUQ0gZwU",
  authDomain: "lifeflow-eed92.firebaseapp.com",
  projectId: "lifeflow-eed92",
  storageBucket: "lifeflow-eed92.firebasestorage.app",
  messagingSenderId: "659656165907",
  appId: "1:659656165907:web:fb3d2a4fa02fb73cb78de6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

export default app;
export { db, storage };
