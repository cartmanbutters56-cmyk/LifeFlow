import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from "firebase/auth";
import app from "./config";

const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export function signInWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function signUpWithEmail(email, password, displayName) {
  return createUserWithEmailAndPassword(auth, email, password).then(
    (result) => {
      if (displayName) {
        return updateProfile(result.user, { displayName }).then(() => result);
      }
      return result;
    }
  );
}

export function signOut() {
  return firebaseSignOut(auth);
}

export { auth, onAuthStateChanged };
