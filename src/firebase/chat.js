import {
  doc, getDoc, setDoc, updateDoc, collection, query, where,
  orderBy, onSnapshot, addDoc, deleteDoc, serverTimestamp, getDocs,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "./config";

function getChatId(uid1, uid2) {
  return [uid1, uid2].sort().join('_');
}

export function getOrCreateChat(uid1, uid2) {
  const chatId = getChatId(uid1, uid2);
  const ref = doc(db, "chats", chatId);
  return { chatId, ref };
}

export async function ensureChatExists(uid1, uid2) {
  const { chatId, ref } = getOrCreateChat(uid1, uid2);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      participants: [uid1, uid2],
      createdAt: serverTimestamp(),
      lastMessage: null,
      lastTimestamp: null,
    });
  }
  return chatId;
}

export function listenToMessages(chatId, callback) {
  const messagesRef = collection(db, "chats", chatId, "messages");
  const q = query(messagesRef, orderBy("timestamp", "asc"));
  return onSnapshot(q, (snap) => {
    const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(msgs);
  }, (err) => console.warn("listenToMessages error:", err?.code || err?.message));
}

export async function sendTextMessage(chatId, senderId, text) {
  const messagesRef = collection(db, "chats", chatId, "messages");
  await addDoc(messagesRef, {
    senderId,
    text,
    type: "text",
    timestamp: Date.now(),
  });
  await updateDoc(doc(db, "chats", chatId), {
    lastMessage: text,
    lastTimestamp: Date.now(),
  });
}

export async function sendImageMessage(chatId, senderId, file) {
  const timestamp = Date.now();
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `chats/${chatId}/images/${timestamp}_${senderId}.${ext}`;
  const storageRef = ref(storage, path);
  const snap = await uploadBytes(storageRef, file);
  const imageUrl = await getDownloadURL(snap.ref);
  const messagesRef = collection(db, "chats", chatId, "messages");
  await addDoc(messagesRef, {
    senderId,
    imageUrl,
    type: "image",
    timestamp,
  });
  await updateDoc(doc(db, "chats", chatId), {
    lastMessage: "📷 Photo",
    lastTimestamp: timestamp,
  });
}

export async function sendStreakInvite(chatId, senderId, senderName, challenge = {}) {
  const messagesRef = collection(db, "chats", chatId, "messages");
  await addDoc(messagesRef, {
    senderId,
    senderName,
    type: "streakInvite",
    accepted: false,
    title: challenge.title || '',
    description: challenge.description || '',
    duration: challenge.duration || null,
    timestamp: Date.now(),
  });
  await updateDoc(doc(db, "chats", chatId), {
    lastMessage: `🔥 ${senderName} sent a streak invite`,
    lastTimestamp: Date.now(),
  });
}

export async function acceptStreakInvite(chatId, messageId, currentUid, partnerUid) {
  const msgRef = doc(db, "chats", chatId, "messages", messageId);
  const snap = await getDoc(msgRef);
  const data = snap.data() || {};
  await updateDoc(msgRef, { accepted: true });
  await updateDoc(doc(db, "users", currentUid), { streakPartner: partnerUid });
  await updateDoc(doc(db, "users", partnerUid), { streakPartner: currentUid });
  return {
    title: data.title || '',
    description: data.description || '',
    duration: data.duration || null,
    partnerName: data.senderName || '',
  };
}

export async function getUserChats(uid) {
  const chatsRef = collection(db, "chats");
  const q = query(chatsRef, where("participants", "array-contains", uid));
  const snap = await getDocs(q);
  const chats = [];
  function pickChatPartnerFields(id, data) {
    return {
      id,
      handle: data.handle || '',
      displayName: data.displayName || '',
      photoURL: data.photoURL || '',
    };
  }
  for (const d of snap.docs) {
    const data = d.data();
    const partnerId = data.participants.find(p => p !== uid);
    const partnerSnap = await getDoc(doc(db, "users", partnerId));
    chats.push({
      chatId: d.id,
      partner: partnerSnap.exists() ? pickChatPartnerFields(partnerSnap.id, partnerSnap.data()) : { id: partnerId },
      lastMessage: data.lastMessage,
      lastTimestamp: data.lastTimestamp,
    });
  }
  chats.sort((a, b) => (b.lastTimestamp || 0) - (a.lastTimestamp || 0));
  return chats;
}

export async function deleteMessage(chatId, messageId) {
  await deleteDoc(doc(db, "chats", chatId, "messages", messageId));
}
