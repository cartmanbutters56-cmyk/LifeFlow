import React, { useState, useEffect, useRef } from 'react';
import { getUserProfile } from '../firebase/friends';
import {
  getUserChats, ensureChatExists, listenToMessages,
  sendTextMessage, sendImageMessage, sendStreakInvite, acceptStreakInvite, deleteMessage,
} from '../firebase/chat';

function getInitials(name) {
  if (!name) return 'U';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'U';
}

export default function Messages({ uid, profileName, onClose, store, onAcceptStreak, initialPartner }) {
  const [screen, setScreen] = useState('list'); // list | chat
  const [chats, setChats] = useState([]);
  const [chatId, setChatId] = useState(null);
  const [partner, setPartner] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [showAttach, setShowAttach] = useState(false);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [viewingImage, setViewingImage] = useState(null);
  const [menuMsgId, setMenuMsgId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const fileInputRef = useRef(null);
  const selfieInputRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Load conversations
  useEffect(() => {
    if (!uid) return;
    getUserChats(uid).then(setChats).catch(() => {});
    const interval = setInterval(() => {
      getUserChats(uid).then(setChats).catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [uid]);

  const openChat = async (partnerProfile) => {
    setPartner(partnerProfile);
    const id = await ensureChatExists(uid, partnerProfile.id);
    setChatId(id);
    setScreen('chat');
  };

  // Auto-open chat when initialPartner is set
  useEffect(() => {
    if (initialPartner && uid) {
      openChat(initialPartner);
    }
  }, [initialPartner, uid]);

  // Listen to messages in real-time
  useEffect(() => {
    if (!chatId) return;
    const unsub = listenToMessages(chatId, setMessages);
    return () => unsub();
  }, [chatId]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !chatId) return;
    setInput('');
    await sendTextMessage(chatId, uid, text);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleFileSelected = async (file) => {
    if (!file || !chatId) return;
    setShowAttach(false);
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      await sendImageMessage(chatId, uid, file);
    } catch (e) { console.warn('Upload failed:', e); }
    setUploading(false);
    setPreview(null);
  };

  const handleSelfie = () => {
    selfieInputRef.current?.click();
  };

  const handleGallery = () => {
    fileInputRef.current?.click();
  };

  const handleInviteToStreak = async () => {
    if (!chatId) return;
    const prof = await getUserProfile(uid);
    await sendStreakInvite(chatId, uid, prof?.displayName || profileName || 'Someone');
  };

  // Format timestamp
  const fmtTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
  };

  const convoList = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
          </svg>
        </button>
        <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Messages</p>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {chats.length === 0 ? (
          <div style={{ padding: '60px 32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
            No conversations yet. Follow someone to start chatting.
          </div>
        ) : chats.map(c => (
          <div key={c.chatId} onClick={() => openChat(c.partner)} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
            borderBottom: '1px solid var(--border)', cursor: 'pointer',
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
              background: c.partner.photoURL ? 'transparent' : 'var(--surface-alt)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 700, color: 'var(--text-sub)', overflow: 'hidden',
            }}>
              {c.partner.photoURL ? (
                <img src={c.partner.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
              ) : getInitials(c.partner.displayName)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{c.partner.displayName || 'User'}</span>
                {c.lastTimestamp && <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{fmtTime(c.lastTimestamp)}</span>}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {c.lastMessage || 'Start chatting'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const isMe = (senderId) => senderId === uid;

  const chatScreen = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
        <button onClick={() => { setScreen('list'); setChatId(null); setMessages([]); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: partner?.photoURL ? 'transparent' : 'var(--surface-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--text-sub)', overflow: 'hidden', flexShrink: 0 }}>
          {partner?.photoURL ? <img src={partner.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" /> : getInitials(partner?.displayName)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{partner?.displayName || 'User'}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>@{partner?.handle}</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'flex-end' }}>
        {messages.map(m => (
          <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe(m.senderId) ? 'flex-end' : 'flex-start' }}>
            {m.type === 'streakInvite' ? (
              <div style={{ alignSelf: 'center', width: '100%', maxWidth: 300 }}>
                {m.accepted ? (
                  <div style={{
                    background: 'var(--surface-alt)', borderRadius: 16, padding: 16, textAlign: 'center',
                    border: '1px solid var(--border)',
                  }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#1CE3A0', margin: 0 }}>Streak Accepted!</p>
                    {m.title && <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>"{m.title}"</p>}
                  </div>
                ) : (
                  <div style={{
                    background: 'linear-gradient(135deg, #1CE3A008, #1CE3A018)',
                    borderRadius: 20, padding: 20,
                    border: '1.5px solid #1CE3A040',
                    boxShadow: '0 4px 24px rgba(28,227,160,0.08)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <div style={{ fontSize: 36 }}>🔥</div>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                          Streak Invitation
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
                          from {m.senderName || 'Someone'}
                        </div>
                      </div>
                    </div>
                    {m.title && (
                      <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                        {m.title}
                      </div>
                    )}
                    {m.description && (
                      <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.5, marginBottom: 12 }}>
                        {m.description}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                      {m.duration && (
                        <div style={{
                          padding: '4px 10px', borderRadius: 8, background: 'var(--surface-alt)',
                          fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
                        }}>{m.duration} days</div>
                      )}
                      <div style={{
                        padding: '4px 10px', borderRadius: 8, background: 'var(--surface-alt)',
                        fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
                      }}>🔥 Shared</div>
                    </div>
                    {!isMe(m.senderId) && (
                      <button
                        onClick={async () => {
                          const partnerId = messages.find(msg => msg.senderId !== uid)?.senderId || '';
                          const data = await acceptStreakInvite(chatId, m.id, uid, partnerId || partner?.id);
                          if (onAcceptStreak) {
                            onAcceptStreak({
                              title: data.title || m.title || '',
                              description: data.description || m.description || '',
                              duration: data.duration || m.duration || null,
                              partnerName: data.partnerName || m.senderName || '',
                            });
                          }
                        }}
                        style={{
                          width: '100%', padding: '12px', borderRadius: 12, border: 'none',
                          background: '#1CE3A0', color: '#0A5C3E', fontSize: 14, fontWeight: 700,
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >Accept Challenge</button>
                    )}
                  </div>
                )}
              </div> 
            ) : m.type === 'image' ? (
              <img
                src={m.imageUrl}
                alt=""
                onClick={() => setViewingImage(m.imageUrl)}
                style={{
                  maxWidth: 220, borderRadius: 14, cursor: 'pointer',
                  border: '1px solid var(--border)', display: 'block',
                }}
              />
            ) : (
              <div style={{
                maxWidth: '75%', padding: '10px 14px', borderRadius: 16,
                background: isMe(m.senderId) ? '#1CE3A0' : '#e5e5ea',
                color: isMe(m.senderId) ? '#0A5C3E' : 'var(--text)',
                fontSize: 14, lineHeight: 1.4,
              }}>
                {m.text}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', padding: '0 4px' }}>{fmtTime(m.timestamp)}</span>
              {isMe(m.senderId) && (
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setMenuMsgId(menuMsgId === m.id ? null : m.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', display: 'flex', alignItems: 'center', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'inherit', lineHeight: 1 }}
                  >•••</button>
                  {menuMsgId === m.id && (
                    <>
                      <div style={{ position: 'absolute', inset: 0, zIndex: 9 }} onClick={() => setMenuMsgId(null)} />
                      <div style={{
                        position: 'absolute', bottom: '100%', right: 0, zIndex: 10,
                        background: 'var(--surface)', borderRadius: 10,
                        border: '1px solid var(--border)', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                        minWidth: 100, overflow: 'hidden', marginBottom: 4,
                      }}>
                        <button
                          onClick={() => { setConfirmDeleteId(m.id); setMenuMsgId(null); }}
                          style={{
                            width: '100%', padding: '10px 14px', background: 'none', border: 'none',
                            fontSize: 13, color: 'var(--status-error)', cursor: 'pointer',
                            fontFamily: 'inherit', textAlign: 'left', whiteSpace: 'nowrap', fontWeight: 600,
                          }}
                        >Delete</button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            {confirmDeleteId === m.id && (
              <div style={{ position: 'absolute', inset: 0, zIndex: 20, background: 'var(--overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setConfirmDeleteId(null)}>
                <div onClick={e => e.stopPropagation()} style={{
                  background: 'var(--surface)', borderRadius: 16, padding: 24, width: 260,
                  textAlign: 'center', boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
                }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 20px' }}>Delete this message?</p>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => setConfirmDeleteId(null)} style={{
                      flex: 1, padding: '11px 0', borderRadius: 10, border: '1px solid var(--border)',
                      background: 'transparent', color: 'var(--text)', fontSize: 13, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}>Cancel</button>
                    <button
                      onClick={async () => {
                        try { await deleteMessage(chatId, m.id); } catch {}
                        setConfirmDeleteId(null);
                      }}
                      style={{
                        flex: 1, padding: '11px 0', borderRadius: 10, border: 'none',
                        background: 'var(--status-error)', color: '#fff', fontSize: 13, fontWeight: 600,
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >Delete</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Image preview */}
      {preview && (
        <div style={{ padding: '8px 12px', background: 'var(--surface)', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={preview} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />
          <span style={{ fontSize: 13, color: 'var(--text-muted)', flex: 1 }}>{uploading ? 'Uploading...' : 'Send this photo?'}</span>
          {!uploading && (
            <>
              <button onClick={() => { setPreview(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={async () => { setUploading(true); try { const file = await fetch(preview).then(r => r.blob()); await sendImageMessage(chatId, uid, file); } catch {} setUploading(false); setPreview(null); }} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#1CE3A0', color: '#0A5C3E', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Send</button>
            </>
          )}
        </div>
      )}

      {/* Attach sheet */}
      {showAttach && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 10, background: 'var(--overlay)', display: 'flex', alignItems: 'flex-end' }} onClick={() => setShowAttach(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '20px 20px 36px' }}>
            <div style={{ width: 40, height: 4, background: 'var(--border)', borderRadius: 99, margin: '0 auto 16px' }} />
            <div style={{ display: 'flex', gap: 16 }}>
              <button onClick={handleSelfie} style={{ flex: 1, padding: 16, borderRadius: 14, background: 'var(--surface-alt)', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>📷</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Take a Selfie</div>
              </button>
              <button onClick={handleGallery} style={{ flex: 1, padding: 16, borderRadius: 14, background: 'var(--surface-alt)', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>🖼️</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Choose from Gallery</div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full screen image viewer */}
      {viewingImage && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 20, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setViewingImage(null)}>
          <img src={viewingImage} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        </div>
      )}

      {/* Input bar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', padding: '8px 12px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        <button onClick={() => setShowAttach(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 4px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
        </button>
        <div style={{ flex: 1, display: 'flex', background: 'var(--bg)', borderRadius: 12, border: '1.5px solid var(--border)', padding: '0 12px', alignItems: 'flex-end' }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message..."
            rows={1}
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontSize: 14, color: 'var(--text)', fontFamily: 'inherit',
              padding: '10px 0', resize: 'none', lineHeight: 1.4,
              maxHeight: 80,
            }}
          />
        </div>
        <button onClick={handleSend} disabled={!input.trim()} style={{
          background: input.trim() ? '#1CE3A0' : 'var(--surface-alt)',
          border: 'none', borderRadius: 10, padding: '8px 10px', cursor: input.trim() ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', flexShrink: 0,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill={input.trim() ? '#0A5C3E' : 'var(--text-muted)'} stroke="none">
            <path d="M22 2L11 13" stroke={input.trim() ? '#0A5C3E' : 'var(--text-muted)'} strokeWidth="2" strokeLinecap="round" /><path d="M22 2L15 22l-4-9-9-4z" />
          </svg>
        </button>
      </div>

      {/* Hidden file inputs */}
      <input ref={selfieInputRef} type="file" accept="image/*" capture="user" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelected(f); e.target.value = ''; }} />
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelected(f); e.target.value = ''; }} />
    </div>
  );

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 300, background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
    }}>
      {screen === 'list' ? convoList : chatScreen}
    </div>
  );
}