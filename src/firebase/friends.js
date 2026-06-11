import {
  doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, query, where, getDocs, runTransaction, serverTimestamp,
} from "firebase/firestore";
import { db } from "./config";

export async function createUserProfile(uid, handle, displayName, photoURL) {
  await runTransaction(db, async (transaction) => {
    const handleRef = doc(db, "usernames", handle.toLowerCase());
    const handleSnap = await transaction.get(handleRef);
    if (handleSnap.exists()) {
      throw new Error("auth/handle-taken");
    }
    transaction.set(handleRef, { uid });
    transaction.set(doc(db, "users", uid), {
      handle: handle.toLowerCase(),
      displayName: displayName || "",
      photoURL: photoURL || "",
      friends: [],
      friendRequests: { incoming: [], outgoing: [] },
      createdAt: serverTimestamp(),
    });
  });
}

export async function checkHandleAvailability(handle) {
  const ref = doc(db, "usernames", handle.toLowerCase().replace(/^@/, ""));
  const snap = await getDoc(ref);
  return !snap.exists();
}

export async function getUserProfile(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function searchUsers(queryStr, currentUid) {
  const clean = queryStr.toLowerCase().replace(/^@/, "");
  if (!clean) return [];
  const usersRef = collection(db, "users");
  const q = query(usersRef, where("handle", ">=", clean), where("handle", "<=", clean + "\uf8ff"));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(u => u.id !== currentUid);
}

export async function sendFriendRequest(fromUid, toUid) {
  const toRef = doc(db, "users", toUid);
  const fromRef = doc(db, "users", fromUid);
  await runTransaction(db, async (transaction) => {
    const toSnap = await transaction.get(toRef);
    if (!toSnap.exists()) throw new Error("User not found");
    const toData = toSnap.data();
    const incoming = toData.friendRequests?.incoming || [];
    const fromSnap = await transaction.get(fromRef);
    const fromData = fromSnap.exists() ? fromSnap.data() : {};
    const outgoing = fromData.friendRequests?.outgoing || [];
    if (incoming.some(r => r.uid === fromUid || r === fromUid)) throw new Error("Request already sent");
    if ((toData.friends || []).includes(fromUid)) throw new Error("Already friends");
    const now = Date.now();
    transaction.update(toRef, { "friendRequests.incoming": [...incoming, { uid: fromUid, createdAt: now }] });
    transaction.update(fromRef, { "friendRequests.outgoing": [...outgoing, { uid: toUid, createdAt: now }] });
  });
}

export async function acceptFriendRequest(currentUid, fromUid) {
  const currentRef = doc(db, "users", currentUid);
  const fromRef = doc(db, "users", fromUid);
  await runTransaction(db, async (transaction) => {
    const curSnap = await transaction.get(currentRef);
    const fromSnap = await transaction.get(fromRef);
    if (!curSnap.exists() || !fromSnap.exists()) throw new Error("User not found");
    const cur = curSnap.data();
    const from = fromSnap.data();
    const incoming = (cur.friendRequests?.incoming || []).filter(r => r.uid !== fromUid && r !== fromUid);
    const friends = [...(cur.friends || []), fromUid];
    const fromOutgoing = (from.friendRequests?.outgoing || []).filter(r => r.uid !== currentUid && r !== currentUid);
    const fromFriends = [...(from.friends || []), currentUid];
    transaction.update(currentRef, { "friendRequests.incoming": incoming, friends });
    transaction.update(fromRef, { "friendRequests.outgoing": fromOutgoing, friends: fromFriends });
  });
}

export async function declineFriendRequest(currentUid, fromUid) {
  const currentRef = doc(db, "users", currentUid);
  const fromRef = doc(db, "users", fromUid);
  await runTransaction(db, async (transaction) => {
    const curSnap = await transaction.get(currentRef);
    const fromSnap = await transaction.get(fromRef);
    if (!curSnap.exists()) throw new Error("User not found");
    const cur = curSnap.data();
    const incoming = (cur.friendRequests?.incoming || []).filter(r => r.uid !== fromUid && r !== fromUid);
    transaction.update(currentRef, { "friendRequests.incoming": incoming });
    if (fromSnap.exists()) {
      const from = fromSnap.data();
      const outgoing = (from.friendRequests?.outgoing || []).filter(r => r.uid !== currentUid && r !== currentUid);
      transaction.update(fromRef, { "friendRequests.outgoing": outgoing });
    }
  });
}

export async function cancelFriendRequest(currentUid, toUid) {
  const currentRef = doc(db, "users", currentUid);
  const toRef = doc(db, "users", toUid);
  await runTransaction(db, async (transaction) => {
    const curSnap = await transaction.get(currentRef);
    const toSnap = await transaction.get(toRef);
    if (curSnap.exists()) {
      const cur = curSnap.data();
      const outgoing = (cur.friendRequests?.outgoing || []).filter(r => r.uid !== toUid && r !== toUid);
      transaction.update(currentRef, { "friendRequests.outgoing": outgoing });
    }
    if (toSnap.exists()) {
      const to = toSnap.data();
      const incoming = (to.friendRequests?.incoming || []).filter(r => r.uid !== currentUid && r !== currentUid);
      transaction.update(toRef, { "friendRequests.incoming": incoming });
    }
  });
}

export async function getFollowers(uid) {
  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("friends", "array-contains", uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { console.warn('getFollowers error:', e); return []; }
}

export async function removeFriend(currentUid, friendUid) {
  const currentRef = doc(db, "users", currentUid);
  const friendRef = doc(db, "users", friendUid);
  await runTransaction(db, async (transaction) => {
    const curSnap = await transaction.get(currentRef);
    const frSnap = await transaction.get(friendRef);
    if (curSnap.exists()) {
      const cur = curSnap.data();
      transaction.update(currentRef, { friends: (cur.friends || []).filter(u => u !== friendUid) });
    }
    if (frSnap.exists()) {
      const fr = frSnap.data();
      transaction.update(friendRef, { friends: (fr.friends || []).filter(u => u !== currentUid) });
    }
  });
}

export async function updateUserProfile(uid, data) {
  const ref = doc(db, "users", uid);
  await updateDoc(ref, data);
}

export async function updateUserHandle(uid, newHandle) {
  const userRef = doc(db, "users", uid);
  await runTransaction(db, async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists()) throw new Error("User not found");
    const oldHandle = userSnap.data().handle;
    if (oldHandle) {
      transaction.delete(doc(db, "usernames", oldHandle));
    }
    const newRef = doc(db, "usernames", newHandle.toLowerCase());
    const newSnap = await transaction.get(newRef);
    if (newSnap.exists()) throw new Error("auth/handle-taken");
    transaction.set(newRef, { uid });
    transaction.update(userRef, { handle: newHandle.toLowerCase() });
  });
}
