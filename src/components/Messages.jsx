import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  const [showCamera, setShowCamera] = useState(false);
  const [facingMode, setFacingMode] = useState('environment');
  const [dualCamera, setDualCamera] = useState(false);
  const [pipPos, setPipPos] = useState({ x: 16, y: 16 });
  const fileInputRef = useRef(null);
  const selfieInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const frontVideoRef = useRef(null);
  const frontStreamRef = useRef(null);
  const chatEndRef = useRef(null);
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

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
    } catch (e) { console.warn('Upload failed'); }
    setUploading(false);
    setPreview(null);
  };

  const startCamera = useCallback(async (mode) => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      alert('Could not access camera. Please check permissions.');
      setShowCamera(false);
    }
  }, []);

  const startFrontCamera = useCallback(async () => {
    try {
      if (frontStreamRef.current) {
        frontStreamRef.current.getTracks().forEach(t => t.stop());
        frontStreamRef.current = null;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 640 } },
        audio: false,
      });
      frontStreamRef.current = stream;
      if (frontVideoRef.current) {
        frontVideoRef.current.srcObject = stream;
      }
    } catch (e) {
      console.warn('Front camera failed');
    }
  }, []);

  // FIX 1: Main camera effect — lock to 'environment' when dual mode is active
  useEffect(() => {
    if (!showCamera) {
      if (frontStreamRef.current) {
        frontStreamRef.current.getTracks().forEach(t => t.stop());
        frontStreamRef.current = null;
      }
      setDualCamera(false);
      return;
    }
    // In dual mode the main camera is always back-facing
    startCamera(dualCamera ? 'environment' : facingMode);
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (frontStreamRef.current) {
        frontStreamRef.current.getTracks().forEach(t => t.stop());
        frontStreamRef.current = null;
      }
    };
  }, [showCamera, facingMode, dualCamera, startCamera]);

  // FIX 2: Dual camera toggle — restart main as back, start front separately
  useEffect(() => {
    if (!showCamera) return;
    if (dualCamera) {
      // Force main camera to back, then open front in PiP
      startCamera('environment');
      startFrontCamera();
    } else {
      // Stop front stream and restore main to current facingMode
      if (frontStreamRef.current) {
        frontStreamRef.current.getTracks().forEach(t => t.stop());
        frontStreamRef.current = null;
      }
      startCamera(facingMode);
    }
  }, [dualCamera, showCamera, startFrontCamera, startCamera, facingMode]);

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    if (dualCamera && frontVideoRef.current && frontVideoRef.current.videoWidth) {
      // Composite both cameras into one image
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');

      // Draw main camera
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Draw PiP (front camera) top-right, ~30% width
      const pipW = Math.round(canvas.width * 0.3);
      const pipH = Math.round(pipW * (frontVideoRef.current.videoHeight / frontVideoRef.current.videoWidth));
      const pipX = canvas.width - pipW - 20;
      const pipY = 20;

      // Clip to rounded rect
      const r = 16;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(pipX + r, pipY);
      ctx.lineTo(pipX + pipW - r, pipY);
      ctx.quadraticCurveTo(pipX + pipW, pipY, pipX + pipW, pipY + r);
      ctx.lineTo(pipX + pipW, pipY + pipH - r);
      ctx.quadraticCurveTo(pipX + pipW, pipY + pipH, pipX + pipW - r, pipY + pipH);
      ctx.lineTo(pipX + r, pipY + pipH);
      ctx.quadraticCurveTo(pipX, pipY + pipH, pipX, pipY + pipH - r);
      ctx.lineTo(pipX, pipY + r);
      ctx.quadraticCurveTo(pipX, pipY, pipX + r, pipY);
      ctx.closePath();
      ctx.clip();

      // Flip front camera horizontally (mirror)
      ctx.translate(pipX + pipW, pipY);
      ctx.scale(-1, 1);
      ctx.drawImage(frontVideoRef.current, 0, 0, pipW, pipH);
      ctx.restore();

      // Border around PiP
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = Math.max(3, Math.round(canvas.width * 0.004));
      ctx.beginPath();
      ctx.moveTo(pipX + r, pipY);
      ctx.lineTo(pipX + pipW - r, pipY);
      ctx.quadraticCurveTo(pipX + pipW, pipY, pipX + pipW, pipY + r);
      ctx.lineTo(pipX + pipW, pipY + pipH - r);
      ctx.quadraticCurveTo(pipX + pipW, pipY + pipH, pipX + pipW - r, pipY + pipH);
      ctx.lineTo(pipX + r, pipY + pipH);
      ctx.quadraticCurveTo(pipX, pipY + pipH, pipX, pipY + pipH - r);
      ctx.lineTo(pipX, pipY + r);
      ctx.quadraticCurveTo(pipX, pipY, pipX + r, pipY);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();

      canvas.toBlob(async (blob) => {
        if (!blob || !chatId) return;
        setShowCamera(false);
        setPreview(URL.createObjectURL(blob));
        setUploading(true);
        try { await sendImageMessage(chatId, uid, blob); } catch { console.warn('Upload failed'); }
        setUploading(false);
        setPreview(null);
      }, 'image/jpeg', 0.88);
    } else {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      canvas.toBlob(async (blob) => {
        if (!blob || !chatId) return;
        setShowCamera(false);
        setPreview(URL.createObjectURL(blob));
        setUploading(true);
        try { await sendImageMessage(chatId, uid, blob); } catch { console.warn('Upload failed'); }
        setUploading(false);
        setPreview(null);
      }, 'image/jpeg', 0.85);
    }
  };

  const handleSelfie = () => {
    setShowCamera(true);
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
                    <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', margin: 0 }}>Streak Accepted!</p>
                    {m.title && <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>"{m.title}"</p>}
                  </div>
                ) : (
                  <div style={{
                    background: 'linear-gradient(135deg, var(--accent)08, var(--accent)18)',
                    borderRadius: 20, padding: 20,
                    border: '1.5px solid var(--accent)40',
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
                          background: 'var(--accent)', color: 'var(--text-on-brand)', fontSize: 14, fontWeight: 700,
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
                background: isMe(m.senderId) ? 'var(--accent)' : 'var(--surface-secondary)',
                color: isMe(m.senderId) ? 'var(--text-on-brand)' : 'var(--text)',
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
              <button onClick={async () => { setUploading(true); try { const file = await fetch(preview).then(r => r.blob()); await sendImageMessage(chatId, uid, file); } catch {} setUploading(false); setPreview(null); }} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'var(--text-on-brand)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Send</button>
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
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Take a Photo</div>
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
          background: input.trim() ? 'var(--accent)' : 'var(--surface-alt)',
          border: 'none', borderRadius: 10, padding: '8px 10px', cursor: input.trim() ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', flexShrink: 0,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill={input.trim() ? 'var(--text-on-brand)' : 'var(--text-muted)'} stroke="none">
            <path d="M22 2L11 13" stroke={input.trim() ? 'var(--text-on-brand)' : 'var(--text-muted)'} strokeWidth="2" strokeLinecap="round" /><path d="M22 2L15 22l-4-9-9-4z" />
          </svg>
        </button>
      </div>

      {/* Hidden file inputs */}
      <input ref={selfieInputRef} type="file" accept="image/*" capture="user" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelected(f); e.target.value = ''; }} />
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelected(f); e.target.value = ''; }} />

      {/* Camera screen */}
      {showCamera && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 30,
          background: '#000',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Main camera — objectFit: contain fixes the zoom/crop */}
          <video
            ref={videoRef}
            autoPlay playsInline
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              objectFit: 'contain',
              background: '#000',
            }}
          />

          {/* Draggable PiP — front camera */}
          {dualCamera && (
            <div
              style={{
                position: 'absolute',
                top: pipPos.y,
                left: pipPos.x,
                width: 110, height: 150,
                borderRadius: 16,
                overflow: 'hidden',
                border: '2px solid rgba(255,255,255,0.75)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                zIndex: 35,
                cursor: 'grab',
                touchAction: 'none',
              }}
              onPointerDown={e => {
                dragging.current = true;
                dragOffset.current = { x: e.clientX - pipPos.x, y: e.clientY - pipPos.y };
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={e => {
                if (!dragging.current) return;
                setPipPos({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y });
              }}
              onPointerUp={() => { dragging.current = false; }}
            >
              <video
                ref={frontVideoRef}
                autoPlay playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
              />
            </div>
          )}

          {/* Top bar */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 16px',
            background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, transparent 100%)',
            zIndex: 36,
          }}>
            {/* Close */}
            <button
              onClick={() => setShowCamera(false)}
              style={{
                background: 'rgba(255,255,255,0.2)', border: 'none',
                width: 36, height: 36, borderRadius: '50%',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                backdropFilter: 'blur(4px)',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18" /><path d="M6 6l12 12" />
              </svg>
            </button>

            <div style={{ display: 'flex', gap: 10 }}>
              {/* Dual camera toggle */}
              <button
                onClick={() => setDualCamera(d => !d)}
                title="Dual camera"
                style={{
                  background: dualCamera ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.2)',
                  border: 'none', width: 36, height: 36, borderRadius: '50%',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backdropFilter: 'blur(4px)',
                }}
              >
                {/* PiP icon */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={dualCamera ? '#000' : 'white'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="5" width="20" height="14" rx="2"/>
                  <rect x="13" y="10" width="7" height="5" rx="1" fill={dualCamera ? '#000' : 'white'} stroke={dualCamera ? '#000' : 'white'} strokeWidth="1"/>
                </svg>
              </button>

              {/* FIX 3: Flip camera — disabled in dual mode */}
              <button
                onClick={toggleCamera}
                disabled={dualCamera}
                title={dualCamera ? 'Flip disabled in dual mode' : 'Flip camera'}
                style={{
                  background: 'rgba(255,255,255,0.2)', border: 'none',
                  width: 36, height: 36, borderRadius: '50%',
                  cursor: dualCamera ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backdropFilter: 'blur(4px)',
                  opacity: dualCamera ? 0.4 : 1,
                  transition: 'opacity 0.2s',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 4v6h6"/><path d="M23 20v-6h-6"/>
                  <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Bottom capture bar */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            display: 'flex', justifyContent: 'center',
            padding: '24px 0 40px',
            background: 'linear-gradient(0deg, rgba(0,0,0,0.55) 0%, transparent 100%)',
            zIndex: 36,
          }}>
            <button
              onClick={capturePhoto}
              style={{
                width: 72, height: 72, borderRadius: '50%',
                border: '4px solid rgba(255,255,255,0.8)',
                background: 'transparent', cursor: 'pointer', padding: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <div style={{ width: 58, height: 58, borderRadius: '50%', background: 'white' }} />
            </button>
          </div>
        </div>
      )}
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