import { useState, useEffect, useRef } from "react";
import {
  Search, Send, Mic, Paperclip, Phone, Video,
  MoreVertical, Moon, Sun, Check, CheckCheck,
  ChevronLeft, X, Bell, BellOff, Archive, Edit3,
  Shield, MessageCircle, Play, Pause,
  ArrowDown, Users, Hash, Settings, Plus, ImageIcon,
  Loader, AlertTriangle, UserPlus, LogOut, Lock, Circle
} from "lucide-react";

// ── API Base ──────────────────────────────────────────────────────────────────
const API = "http://localhost:8000";

// ── Auth API ──────────────────────────────────────────────────────────────────
async function apiRegister(payload) {
  const r = await fetch(`${API}/api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.detail || "Registration failed");
  return data.user;
}

async function apiLogin(identifier, password) {
  const r = await fetch(`${API}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.detail || "Login failed");
  return data.user;
}

async function apiGetContacts(userId) {
  const r = await fetch(`${API}/api/contacts/${userId}`);
  const data = await r.json();
  return (data.contacts || []).map(u => ({
    ...u,
    name: u.fullName || u.name || u.username,
    unread: 0
  }));
}

async function apiAddContact(userId, phone) {
  const r = await fetch(`${API}/api/contacts/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, phone })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.detail || "Could not add contact");
  const c = data.contact;
  // normalize fullName → name so the UI renders correctly
  return { ...c, name: c.fullName || c.name || c.username, unread: 0 };
}

async function apiGetMessages(userId, otherId) {
  const r = await fetch(`${API}/api/messages/${userId}/${otherId}`);
  const data = await r.json();
  return data.messages || [];
}

//Mark a message as seen
async function apiMarkSeen(userId, otherId) {
  await fetch(`${API}/api/messages/${userId}/${otherId}/seen`, {
    method: "POST",
    headers: { "Content-Type": "application/json" }
  });
}

//Post a status 

async function apiPostStatus(formData) {
  const r = await fetch(`${API}/api/status`, {
    method: "POST",
    body: formData
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.detail || "Failed to post status");
  return data.status;
}

async function apiGetStatuses(userId) {
  const r = await fetch(`${API}/api/statuses/${userId}`);
  const data = await r.json();
  return data.statuses || [];
}

async function apiViewStatus(statusId, viewerId) {
  await fetch(`${API}/api/status/${statusId}/view`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ viewer_id: viewerId })
  });
}

async function apiDeleteStatus(statusId, userId) {
  await fetch(`${API}/api/status/${statusId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId })
  });
}

// Upload a file and send as message
async function apiUploadFile(senderId, otherId, file) {
  const formData = new FormData();
  formData.append("sender_id", senderId);
  formData.append("file", file);
  const r = await fetch(`${API}/api/upload/${otherId}`, {
    method: "POST",
    body: formData
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.detail || "Upload failed");
  return data.message;
}


async function apiFetch(path, opts = {}) {
  try {
    const r = await fetch(`${API}${path}`, { headers: { "Content-Type": "application/json" }, ...opts });
    return r.json();
  } catch { return null; }
}

function openWS(userId, handlers) {
  let ws;
  let reconnectTimer;

  function connect() {
    ws = new WebSocket(`ws://localhost:8000/ws/${userId}`);

    ws.onopen = () => {
      console.log(`[G-Talk WS] connected as ${userId}`);
    };

    ws.onmessage = ({ data }) => {
      const e = JSON.parse(data);
      if (e.event === "new_message")  handlers.onMsg?.(e);
      if (e.event === "typing")       handlers.onTyping?.(e);
      if (e.event === "user_offline") handlers.onOffline?.(e);
      if (e.event === "messages_seen") handlers.onSeen?.(e);
    };

    ws.onerror = (err) => {
      console.warn("[G-Talk WS] error, will reconnect…", err);
    };

    ws.onclose = () => {
      console.warn("[G-Talk WS] closed, reconnecting in 2s…");
      reconnectTimer = setTimeout(connect, 2000);
    };
  }

  connect();

  // Return a controller object instead of raw ws
  return {
    send: (payload) => {
      if (ws?.readyState === 1) ws.send(JSON.stringify(payload));
    },
    close: () => {
      clearTimeout(reconnectTimer);
      ws?.close();
    }
  };
}

function wsSend(wsController, payload) {
  wsController?.send?.(payload);
}

const EMOJI_LIST   = ["❤️","😂","😮","😢","👍","🔥","🎉","💯","✅","🌿"];

// ── StatusDot ─────────────────────────────────────────────────────────────────
function StatusDot({ status, size = 10 }) {
  const colors = { online:"#34d399", away:"#fbbf24", offline:"#4b5563" };
  return (
    <span style={{
      display:"inline-block", width:size, height:size, borderRadius:"50%",
      background: colors[status] || "#4b5563",
      boxShadow: status==="online" ? `0 0 7px ${colors.online}` : "none",
      flexShrink:0,
    }} />
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ user, size = 44, showStatus = true }) {
  return (
    <div style={{ position:"relative", flexShrink:0 }}>
      <div style={{
        width:size, height:size, borderRadius:"50%",
        background:`linear-gradient(135deg, ${user.color}55, ${user.color}22)`,
        border:`2px solid ${user.color}44`,
        display:"flex", alignItems:"center", justifyContent:"center",
        fontSize:size*0.32, fontWeight:700, color:user.color,
        letterSpacing:"0.5px", backdropFilter:"blur(8px)", flexShrink:0,
      }}>
        {user.avatar}
      </div>
      {showStatus && (
        <div style={{ position:"absolute", bottom:1, right:1, background:"#030f0a", borderRadius:"50%", padding:2 }}>
          <StatusDot status={user.status} size={size > 36 ? 10 : 8} />
        </div>
      )}
    </div>
  );
}

// ── VoiceNote ─────────────────────────────────────────────────────────────────
function VoiceNote({ duration = "0:23", url = null }) {
  const [playing, setPlaying]   = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState("0:00");
  const audioRef = useRef(null);
  const bars = useRef(Array.from({ length:28 }, (_,i) => 18 + Math.sin(i*0.85)*14 + (i%3)*6)).current;

  useEffect(() => {
    if (!url) return;
    const audio = new Audio(`http://localhost:8000${url}`);
    audioRef.current = audio;

    audio.ontimeupdate = () => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
        const s = Math.floor(audio.currentTime);
        setCurrentTime(`${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`);
      }
    };

    audio.onended = () => {
      setPlaying(false);
      setProgress(0);
      setCurrentTime("0:00");
    };

    return () => {
      audio.pause();
      audio.src = "";
    };
  }, [url]);

  const togglePlay = () => {
    if (!url) return;
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play();
      setPlaying(true);
    }
  };

  // Fallback fake progress for non-url voice notes
  useEffect(() => {
    if (url || !playing) return;
    const iv = setInterval(() => setProgress(p => {
      if (p >= 100) { setPlaying(false); return 0; }
      return p + 1.8;
    }), 80);
    return () => clearInterval(iv);
  }, [playing, url]);

  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:200 }}>
      <button
        onClick={togglePlay}
        style={{ width:34, height:34, borderRadius:"50%", border:"none", flexShrink:0, background:"rgba(52,211,153,0.18)", color:"#34d399", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}
      >
        {playing ? <Pause size={13}/> : <Play size={13}/>}
      </button>
      <div style={{ display:"flex", alignItems:"center", gap:2, flex:1 }}>
        {bars.map((h,i) => (
          <div key={i} style={{ width:3, borderRadius:2, height:Math.max(4,(h/55)*28), background: i/bars.length < progress/100 ? "linear-gradient(to top,#059669,#34d399)" : "rgba(52,211,153,0.18)", transition:"background 0.1s", cursor:"pointer" }}/>
        ))}
      </div>
      <span style={{ fontSize:11, color:"rgba(167,243,208,0.4)", flexShrink:0 }}>
        {playing ? currentTime : duration}
      </span>
    </div>
  );
}

// ── MessageBubble ─────────────────────────────────────────────────────────────
function MessageBubble({ msg, user, onReact, isMe }) {
  const [hovered, setHovered]   = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const reactions = Object.keys(msg.reactions || {});
  return (
    <div style={{ display:"flex", flexDirection:isMe?"row-reverse":"row", alignItems:"flex-end", gap:8, maxWidth:"72%", marginLeft:isMe?"auto":0, animation:"fadeUp 0.25s ease", position:"relative" }}
      onMouseEnter={()=>setHovered(true)}
      onMouseLeave={()=>{setHovered(false);setShowEmoji(false);}}
    >
      {!isMe && <Avatar user={user} size={30} showStatus={false} />}
      <div style={{ position:"relative" }}>
        <div style={{
          backdropFilter:"blur(12px)", padding:"10px 14px", fontSize:14, lineHeight:1.5,
          color:"rgba(255,255,255,0.9)",
          ...(isMe
            ? { background:"linear-gradient(135deg,rgba(5,150,105,0.6),rgba(52,211,153,0.4))", border:"1px solid rgba(52,211,153,0.3)", borderRadius:"20px 4px 20px 20px", marginLeft:"auto", boxShadow:"0 4px 20px rgba(16,185,129,0.2)" }
            : { background:"rgba(6,78,59,0.28)", border:"1px solid rgba(52,211,153,0.12)", borderRadius:"4px 20px 20px 20px", marginRight:"auto", boxShadow:"0 4px 20px rgba(0,0,0,0.2)" })
        }}>
          {msg.type === "voice"
            ? <VoiceNote duration={msg.duration} url={msg.fileUrl}/>
            : msg.type === "image" || msg.type === "video" || msg.type === "document"
            ? <FileMessage msg={msg} isMe={isMe} onImageClick={(url,name) => window._openLightbox?.(url,name)}/>
            : <span>{msg.text}</span>
          }
          <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:4, justifyContent:isMe?"flex-end":"flex-start" }}>
            <span style={{ fontSize:10, color:"rgba(167,243,208,0.38)" }}>{msg.time}</span>
            {isMe && (
              msg.status==="seen"      ? <CheckCheck size={12} color="#34d399"/> :
              msg.status==="delivered" ? <CheckCheck size={12} color="rgba(167,243,208,0.38)"/> :
                                         <Check size={12} color="rgba(167,243,208,0.25)"/>
            )}
          </div>
        </div>
        {reactions.length > 0 && (
          <div style={{ position:"absolute", bottom:-12, right:isMe?8:"auto", left:isMe?"auto":8, display:"flex", gap:2, background:"rgba(3,15,10,0.85)", border:"1px solid rgba(52,211,153,0.18)", borderRadius:20, padding:"2px 6px", backdropFilter:"blur(8px)", zIndex:1 }}>
            {reactions.map(e => <span key={e} style={{ fontSize:12 }}>{e}</span>)}
          </div>
        )}
        {hovered && (
          <div style={{ position:"absolute", top:"50%", transform:"translateY(-50%)", [isMe?"left":"right"]:"100%", [isMe?"paddingRight":"paddingLeft"]:8, display:"flex", gap:4, alignItems:"center" }}>
            <div style={{ position:"relative" }}>
              <button onClick={()=>setShowEmoji(p=>!p)} style={{ background:"rgba(6,78,59,0.5)", border:"1px solid rgba(52,211,153,0.2)", borderRadius:10, padding:"4px 8px", cursor:"pointer", fontSize:14, backdropFilter:"blur(8px)" }}>😊</button>
              {showEmoji && (
                <div style={{ position:"absolute", bottom:"100%", right:0, marginBottom:8, background:"rgba(3,15,10,0.97)", backdropFilter:"blur(24px)", border:"1px solid rgba(52,211,153,0.22)", borderRadius:16, padding:"10px 12px", display:"flex", gap:6, zIndex:200, boxShadow:"0 20px 60px rgba(0,0,0,0.6)", animation:"fadeUp 0.18s ease" }}>
                  {EMOJI_LIST.map(e => (
                    <button key={e} onClick={()=>{onReact(msg.id,e);setShowEmoji(false);}} style={{ background:"none",border:"none",cursor:"pointer",fontSize:19,borderRadius:8,padding:"3px 5px",transition:"transform 0.15s" }}
                      onMouseEnter={ev=>ev.currentTarget.style.transform="scale(1.35)"}
                      onMouseLeave={ev=>ev.currentTarget.style.transform="scale(1)"}
                    >{e}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── FileMessage ───────────────────────────────────────────────────────────────
function FileMessage({ msg, isMe, onImageClick }) {
  const url = `http://localhost:8000${msg.fileUrl}`;
  const sizeMB = msg.fileSize ? (msg.fileSize / (1024*1024)).toFixed(2) : "?";
  const sizeKB = msg.fileSize ? (msg.fileSize / 1024).toFixed(0) : "?";
  const displaySize = msg.fileSize > 1024*1024 ? `${sizeMB} MB` : `${sizeKB} KB`;

  if (msg.type === "image") {
    return (
      <div style={{ position:"relative", cursor:"pointer" }} onClick={() => onImageClick(url, msg.fileName)}>
        <img
          src={url}
          alt={msg.fileName}
          style={{
            maxWidth: 220, maxHeight: 200, borderRadius: 12,
            display: "block", objectFit: "cover",
            border: "1px solid rgba(52,211,153,0.2)"
          }}
        />
        <div style={{
          position:"absolute", bottom:6, right:8,
          background:"rgba(0,0,0,0.5)", borderRadius:8,
          padding:"2px 6px", fontSize:10, color:"#fff"
        }}>
          {displaySize}
        </div>
      </div>
    );
  }

  if (msg.type === "video") {
    return (
      <div style={{ position:"relative" }}>
        <video
          src={url}
          controls
          style={{
            maxWidth: 240, maxHeight: 180, borderRadius: 12,
            display:"block", border:"1px solid rgba(52,211,153,0.2)"
          }}
        />
        <div style={{ fontSize:11, color:"rgba(167,243,208,0.5)", marginTop:4 }}>
          {msg.fileName} · {displaySize}
        </div>
      </div>
    );
  }

  // Document
  const isPDF = msg.mimeType === "application/pdf";
  return (
    <div style={{
      display:"flex", alignItems:"center", gap:12,
      background:"rgba(6,78,59,0.3)", border:"1px solid rgba(52,211,153,0.15)",
      borderRadius:14, padding:"10px 14px", minWidth:200, maxWidth:260
    }}>
      <div style={{
        width:42, height:42, borderRadius:10, flexShrink:0,
        background: isPDF ? "rgba(239,68,68,0.15)" : "rgba(59,130,246,0.15)",
        border: isPDF ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(59,130,246,0.3)",
        display:"flex", alignItems:"center", justifyContent:"center",
        fontSize:11, fontWeight:700,
        color: isPDF ? "#f87171" : "#93c5fd"
      }}>
        {isPDF ? "PDF" : "DOC"}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{
          fontSize:13, fontWeight:600, color:"rgba(236,253,245,0.9)",
          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"
        }}>
          {msg.fileName}
        </div>
        <div style={{ fontSize:11, color:"rgba(167,243,208,0.45)", marginTop:2 }}>
          {displaySize}
        </div>
      </div>
      <a
        href={url}
        download={msg.fileName}
        target="_blank"
        rel="noreferrer"
        onClick={e => e.stopPropagation()}
        style={{
          background:"rgba(52,211,153,0.15)", border:"1px solid rgba(52,211,153,0.25)",
          borderRadius:8, padding:"6px 8px", color:"#34d399",
          display:"flex", alignItems:"center", justifyContent:"center",
          textDecoration:"none", flexShrink:0
        }}
      >
        <ArrowDown size={14}/>
      </a>
    </div>
  );
}



// ── Lightbox ──────────────────────────────────────────────────────────────────
function Lightbox({ url, name, onClose }) {
  return (
    <div onClick={onClose}
      style={{
        position:"fixed", inset:0, zIndex:1000,
        background:"rgba(0,0,0,0.92)", backdropFilter:"blur(12px)",
        display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center",
        animation:"fadeIn 0.2s ease"
      }}
    >
      <div style={{
        position:"absolute", top:20, right:20, display:"flex", gap:10
      }}>
        
         <a href={url}
          download={name}
          onClick={e => e.stopPropagation()}
          style={{
            background:"rgba(52,211,153,0.15)", border:"1px solid rgba(52,211,153,0.3)",
            borderRadius:12, padding:"8px 16px", color:"#34d399",
            textDecoration:"none", fontSize:13, fontWeight:600,
            display:"flex", alignItems:"center", gap:6
          }}
        >
          <ArrowDown size={14}/> Download
        </a>
        <button
          onClick={onClose}
          style={{
            background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.15)",
            borderRadius:12, width:38, height:38, cursor:"pointer",
            color:"rgba(255,255,255,0.7)", display:"flex",
            alignItems:"center", justifyContent:"center"
          }}
        >
          <X size={16}/>
        </button>
      </div>
      <img
        src={url}
        alt={name}
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth:"90vw", maxHeight:"85vh",
          borderRadius:16, objectFit:"contain",
          boxShadow:"0 25px 80px rgba(0,0,0,0.8)"
        }}
      />
      <div style={{
        marginTop:14, fontSize:13,
        color:"rgba(255,255,255,0.4)"
      }}>
        {name}
      </div>
    </div>
  );
}


// ── ProfilePanel ──────────────────────────────────────────────────────────────
function ProfilePanel({ user, onClose, dark }) {
  return (
    <div style={{ position:"absolute", right:0, top:0, bottom:0, width:300, background:dark?"rgba(3,15,10,0.96)":"rgba(240,253,244,0.96)", backdropFilter:"blur(30px)", borderLeft:"1px solid rgba(52,211,153,0.1)", zIndex:20, display:"flex", flexDirection:"column", padding:24, animation:"slideRight 0.25s ease" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <span style={{ fontWeight:700, color:dark?"rgba(255,255,255,0.9)":"rgba(2,44,34,0.9)" }}>Profile</span>
        <button onClick={onClose} style={{ background:"rgba(6,78,59,0.3)", border:"1px solid rgba(52,211,153,0.15)", borderRadius:10, width:32, height:32, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"rgba(167,243,208,0.5)" }}><X size={16}/></button>
      </div>
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:12, marginBottom:24 }}>
        <Avatar user={user} size={80}/>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontWeight:700, fontSize:18, color:dark?"rgba(255,255,255,0.95)":"rgba(2,44,34,0.9)" }}>{user.name}</div>
          <div style={{ fontSize:12, color:user.color, marginTop:2 }}>{user.role}</div>
          <div style={{ fontSize:12, color:"rgba(167,243,208,0.45)", marginTop:4 }}>{user.bio}</div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <StatusDot status={user.status} size={9}/>
          <span style={{ fontSize:12, color:"rgba(167,243,208,0.5)" }}>{user.status} · Last seen {user.lastSeen}</span>
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        {[[Phone,"Call"],[Video,"Video"],[Bell,"Mute"],[Archive,"Archive"]].map(([Icon,label]) => (
          <button key={label} style={{ background:"rgba(6,78,59,0.3)", border:"1px solid rgba(52,211,153,0.12)", borderRadius:14, padding:"12px 8px", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:6, color:"rgba(167,243,208,0.6)", fontSize:12, transition:"all 0.2s" }}
            onMouseEnter={ev=>{ev.currentTarget.style.background="rgba(52,211,153,0.12)";ev.currentTarget.style.color="#34d399";}}
            onMouseLeave={ev=>{ev.currentTarget.style.background="rgba(6,78,59,0.3)";ev.currentTarget.style.color="rgba(167,243,208,0.6)";}}
          ><Icon size={18}/>{label}</button>
        ))}
      </div>
      <div style={{ marginTop:20, borderTop:"1px solid rgba(52,211,153,0.08)", paddingTop:20 }}>
        <div style={{ fontSize:11, color:"rgba(167,243,208,0.35)", marginBottom:10, textTransform:"uppercase", letterSpacing:"0.08em" }}>Media & Files</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6 }}>
          {[...Array(6)].map((_,i) => (
            <div key={i} style={{ aspectRatio:"1", borderRadius:10, background:`linear-gradient(135deg,${user.color}22,${user.color}11)`, border:`1px solid ${user.color}22`, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}
              onMouseEnter={ev=>ev.currentTarget.style.background=`${user.color}28`}
              onMouseLeave={ev=>ev.currentTarget.style.background=`linear-gradient(135deg,${user.color}22,${user.color}11)`}
            ><ImageIcon size={14} color={user.color}/></div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── StatusComposer ────────────────────────────────────────────────────────────
function StatusComposer({ currentUser, onPost, onClose, T }) {
  const [type, setType]         = useState("text");
  const [text, setText]         = useState("");
  const [bgColor, setBgColor]   = useState("#059669");
  const [file, setFile]         = useState(null);
  const [preview, setPreview]   = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const fileRef                 = useRef(null);

  const BG_COLORS = [
    "#059669","#0891b2","#7c3aed","#db2777",
    "#d97706","#dc2626","#065f46","#1e40af"
  ];

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handlePost = async () => {
    if (type === "text" && !text.trim()) { setError("Write something first"); return; }
    if (type === "image" && !file) { setError("Pick an image first"); return; }
    setLoading(true); setError("");
    try {
      const formData = new FormData();
      formData.append("user_id", currentUser.id);
      formData.append("status_type", type);
      formData.append("text", text);
      formData.append("bg_color", bgColor);
      if (file) formData.append("file", file);
      const status = await apiPostStatus(formData);
      onPost(status);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:200,
      background:"rgba(0,0,0,0.85)", backdropFilter:"blur(12px)",
      display:"flex", alignItems:"center", justifyContent:"center",
      animation:"fadeIn 0.2s ease"
    }}>
      <div style={{
        width:"100%", maxWidth:400, margin:"0 20px",
        background:"rgba(3,15,10,0.97)", border:"1px solid rgba(52,211,153,0.2)",
        borderRadius:24, padding:24, backdropFilter:"blur(32px)"
      }}>
        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <span style={{ fontWeight:700, fontSize:16, color:"rgba(236,253,245,0.95)" }}>Add Status</span>
          <button onClick={onClose} style={{ background:"rgba(6,78,59,0.3)", border:"1px solid rgba(52,211,153,0.15)", borderRadius:10, width:32, height:32, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"rgba(167,243,208,0.5)" }}>
            <X size={16}/>
          </button>
        </div>

        {/* Type tabs */}
        <div style={{ display:"flex", gap:4, marginBottom:20, background:"rgba(3,15,10,0.4)", borderRadius:12, padding:4 }}>
          {["text","image"].map(t => (
            <button key={t} onClick={()=>setType(t)} style={{
              flex:1, padding:"8px 0", borderRadius:9, border:"none", cursor:"pointer",
              background: type===t ? "rgba(52,211,153,0.18)" : "transparent",
              color: type===t ? "#34d399" : "rgba(110,231,183,0.45)",
              fontSize:13, fontWeight:600, fontFamily:"'Plus Jakarta Sans',sans-serif"
            }}>
              {t === "text" ? "✏️ Text" : "🖼️ Image"}
            </button>
          ))}
        </div>

        {/* Text status */}
        {type === "text" && (
          <>
            <div style={{
              width:"100%", height:160, borderRadius:16, marginBottom:14,
              background:bgColor, display:"flex", alignItems:"center",
              justifyContent:"center", padding:16, boxSizing:"border-box"
            }}>
              <textarea
                value={text}
                onChange={e=>setText(e.target.value)}
                maxLength={200}
                placeholder="Type your status…"
                style={{
                  background:"none", border:"none", outline:"none", resize:"none",
                  width:"100%", textAlign:"center", fontSize:18, fontWeight:700,
                  color:"#fff", fontFamily:"'Plus Jakarta Sans',sans-serif",
                  textShadow:"0 2px 8px rgba(0,0,0,0.3)"
                }}
              />
            </div>
            <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
              {BG_COLORS.map(c => (
                <button key={c} onClick={()=>setBgColor(c)} style={{
                  width:32, height:32, borderRadius:"50%", border: bgColor===c ? "3px solid #34d399" : "2px solid transparent",
                  background:c, cursor:"pointer", flexShrink:0
                }}/>
              ))}
            </div>
          </>
        )}

        {/* Image status */}
        {type === "image" && (
          <>
            <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleFile}/>
            {preview
              ? (
                <div style={{ position:"relative", marginBottom:14 }}>
                  <img src={preview} style={{ width:"100%", height:180, objectFit:"cover", borderRadius:16 }}/>
                  <button onClick={()=>{setFile(null);setPreview(null);}} style={{ position:"absolute", top:8, right:8, background:"rgba(0,0,0,0.6)", border:"none", borderRadius:"50%", width:28, height:28, cursor:"pointer", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <X size={13}/>
                  </button>
                </div>
              )
              : (
                <div onClick={()=>fileRef.current?.click()} style={{ width:"100%", height:180, borderRadius:16, border:"2px dashed rgba(52,211,153,0.3)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8, cursor:"pointer", marginBottom:14, color:"rgba(52,211,153,0.5)" }}>
                  <ImageIcon size={28}/>
                  <span style={{ fontSize:13 }}>Click to pick image</span>
                </div>
              )
            }
            <textarea
              value={text}
              onChange={e=>setText(e.target.value)}
              placeholder="Add a caption… (optional)"
              maxLength={100}
              style={{
                width:"100%", background:"rgba(6,78,59,0.28)", border:"1px solid rgba(52,211,153,0.18)",
                borderRadius:12, padding:"10px 14px", color:"rgba(236,253,245,0.9)",
                fontSize:13, outline:"none", resize:"none", fontFamily:"'Plus Jakarta Sans',sans-serif",
                marginBottom:14, boxSizing:"border-box"
              }}
            />
          </>
        )}

        {error && (
          <div style={{ background:"rgba(220,38,38,0.1)", border:"1px solid rgba(220,38,38,0.25)", borderRadius:10, padding:"8px 12px", marginBottom:12, fontSize:12, color:"#f87171" }}>
            {error}
          </div>
        )}

        <button onClick={handlePost} disabled={loading} style={{
          width:"100%", padding:"12px", borderRadius:13, border:"none",
          background: loading ? "rgba(52,211,153,0.2)" : "linear-gradient(135deg,#059669,#34d399)",
          color: loading ? "rgba(167,243,208,0.4)" : "#022c22",
          fontSize:14, fontWeight:700, cursor: loading ? "not-allowed" : "pointer",
          fontFamily:"'Plus Jakarta Sans',sans-serif",
          display:"flex", alignItems:"center", justifyContent:"center", gap:8
        }}>
          {loading ? <><Loader size={14} style={{animation:"spin 1s linear infinite"}}/> Posting…</> : "Post Status"}
        </button>
      </div>
    </div>
  );
}


// ── StatusReply ───────────────────────────────────────────────────────────────
function StatusReply({ status, currentUser, onClose }) {
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      await fetch(`${API}/api/send/${status.user_id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `↩️ Replied to your status: "${reply.trim()}"`,
          type: "text",
          sender_id: currentUser.id
        })
      });
      setSent(true);
      setReply("");
      setTimeout(() => { setSent(false); onClose(); }, 1500);
    } catch {
      // silent fail
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{
      position:"absolute", bottom:0, left:0, right:0,
      padding:"12px 16px 24px", zIndex:10,
      background:"linear-gradient(to top,rgba(0,0,0,0.85),transparent)"
    }}>
      {sent && (
        <div style={{ textAlign:"center", color:"#34d399", fontSize:13, fontWeight:600, marginBottom:8 }}>
          Reply sent! ✓
        </div>
      )}
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <input
          value={reply}
          onChange={e => setReply(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSend()}
          placeholder="Reply to status…"
          style={{
            flex:1, background:"rgba(255,255,255,0.12)",
            border:"1px solid rgba(255,255,255,0.2)",
            borderRadius:24, padding:"10px 16px",
            color:"#fff", fontSize:14, outline:"none",
            fontFamily:"'Plus Jakarta Sans',sans-serif"
          }}
        />
        <button
          onClick={handleSend}
          disabled={sending || !reply.trim()}
          style={{
            width:42, height:42, borderRadius:"50%", border:"none",
            background: reply.trim() ? "linear-gradient(135deg,#059669,#34d399)" : "rgba(255,255,255,0.1)",
            cursor: reply.trim() ? "pointer" : "not-allowed",
            display:"flex", alignItems:"center", justifyContent:"center",
            flexShrink:0
          }}
        >
          {sending
            ? <Loader size={16} color="#022c22" style={{animation:"spin 1s linear infinite"}}/>
            : <Send size={16} color={reply.trim() ? "#022c22" : "rgba(255,255,255,0.4)"}/>
          }
        </button>
      </div>
    </div>
  );
}


// ── ViewersList ───────────────────────────────────────────────────────────────
function ViewersList({ status, currentUser }) {
  const [showViewers, setShowViewers] = useState(false);
  const [viewers, setViewers]         = useState([]);
  const [loading, setLoading]         = useState(false);

  const fetchViewers = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/status/${status.id}/viewers`);
      const data = await r.json();
      setViewers(data.viewers || []);
    } catch {
      setViewers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setShowViewers(true);
    fetchViewers();
  };

  return (
    <>
      {/* Clickable views count */}
      <div
        onClick={handleOpen}
        style={{
          position:"absolute", bottom:30, left:0, right:0,
          display:"flex", justifyContent:"center", cursor:"pointer", zIndex:10
        }}
      >
        <div style={{
          background:"rgba(0,0,0,0.65)", borderRadius:20,
          padding:"8px 20px", display:"flex", alignItems:"center", gap:8,
          border:"1px solid rgba(255,255,255,0.1)",
          transition:"all 0.2s"
        }}
          onMouseEnter={ev => ev.currentTarget.style.background="rgba(0,0,0,0.85)"}
          onMouseLeave={ev => ev.currentTarget.style.background="rgba(0,0,0,0.65)"}
        >
          <Users size={14} color="rgba(255,255,255,0.7)"/>
          <span style={{ fontSize:13, color:"rgba(255,255,255,0.7)" }}>
            {status.views?.length || 0} {status.views?.length === 1 ? "view" : "views"}
          </span>
          <ChevronLeft size={13} color="rgba(255,255,255,0.4)" style={{transform:"rotate(-90deg)"}}/>
        </div>
      </div>

      {/* Viewers modal */}
      {showViewers && (
        <div
          onClick={() => setShowViewers(false)}
          style={{
            position:"fixed", inset:0, zIndex:400,
            background:"rgba(0,0,0,0.7)", backdropFilter:"blur(8px)",
            display:"flex", alignItems:"flex-end", justifyContent:"center"
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width:"100%", maxWidth:480,
              background:"rgba(3,15,10,0.98)", backdropFilter:"blur(32px)",
              border:"1px solid rgba(52,211,153,0.15)",
              borderRadius:"24px 24px 0 0", padding:"20px 20px 32px",
              animation:"fadeUp 0.25s ease"
            }}
          >
            {/* Handle bar */}
            <div style={{ width:40, height:4, borderRadius:2, background:"rgba(52,211,153,0.2)", margin:"0 auto 20px" }}/>

            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
              <div>
                <div style={{ fontWeight:700, fontSize:16, color:"rgba(236,253,245,0.95)" }}>Viewed by</div>
                <div style={{ fontSize:12, color:"rgba(110,231,183,0.5)", marginTop:2 }}>{status.views?.length || 0} people</div>
              </div>
              <button
                onClick={() => setShowViewers(false)}
                style={{ background:"rgba(6,78,59,0.3)", border:"1px solid rgba(52,211,153,0.15)", borderRadius:10, width:32, height:32, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"rgba(167,243,208,0.5)" }}
              >
                <X size={16}/>
              </button>
            </div>

            {loading && (
              <div style={{ display:"flex", justifyContent:"center", padding:30 }}>
                <Loader size={22} color="#34d399" style={{animation:"spin 1s linear infinite"}}/>
              </div>
            )}

            {!loading && viewers.length === 0 && (
              <div style={{ textAlign:"center", color:"rgba(110,231,183,0.4)", fontSize:13, padding:30 }}>
                No views yet
              </div>
            )}

            {!loading && viewers.map(v => (
              <div key={v.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 4px", borderBottom:"1px solid rgba(52,211,153,0.06)" }}>
                <div style={{ width:42, height:42, borderRadius:"50%", background:`linear-gradient(135deg,${v.color||"#34d399"}55,${v.color||"#34d399"}22)`, border:`2px solid ${v.color||"#34d399"}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:v.color||"#34d399", flexShrink:0 }}>
                  {v.avatar || v.name?.[0]?.toUpperCase()}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:600, fontSize:14, color:"rgba(236,253,245,0.9)" }}>{v.name}</div>
                  <div style={{ fontSize:12, color:"rgba(110,231,183,0.4)" }}>{v.role || "G-Talk User"}</div>
                </div>
                <CheckCheck size={16} color="#34d399"/>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ── StatusViewer ──────────────────────────────────────────────────────────────
function StatusViewer({ statusData, currentUser, onClose, onNext, onPrev, hasNext, hasPrev }) {
  const { user, statuses } = statusData;
  const [index, setIndex]   = useState(0);
  const [progress, setProgress] = useState(0);
  const status = statuses[index];
  const isOwn = user.id === currentUser.id;

  useEffect(() => {
    apiViewStatus(status.id, currentUser.id);
    setProgress(0);
    const iv = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(iv);
          if (index < statuses.length - 1) {
            setIndex(i => i + 1);
          } else {
            onNext?.();
          }
          return 0;
        }
        return p + 2;
      });
    }, 100);
    return () => clearInterval(iv);
  }, [index, status.id]);

  const timeAgo = (iso) => {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
    return `${Math.floor(diff/3600)}h ago`;
  };

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:300,
      background:"#000", display:"flex", alignItems:"center",
      justifyContent:"center", animation:"fadeIn 0.2s ease"
    }}>
      {/* Progress bars */}
      <div style={{ position:"absolute", top:16, left:16, right:16, display:"flex", gap:4, zIndex:10 }}>
        {statuses.map((_, i) => (
          <div key={i} style={{ flex:1, height:3, borderRadius:2, background:"rgba(255,255,255,0.3)", overflow:"hidden" }}>
            <div style={{
              height:"100%", borderRadius:2, background:"#fff",
              width: i < index ? "100%" : i === index ? `${progress}%` : "0%",
              transition: i === index ? "none" : "none"
            }}/>
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{ position:"absolute", top:36, left:16, right:16, display:"flex", alignItems:"center", gap:10, zIndex:10 }}>
        <Avatar user={{...user, color: user.color || "#34d399"}} size={38} showStatus={false}/>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:700, fontSize:14, color:"#fff" }}>{user.name}</div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.55)" }}>{timeAgo(status.created_at)}</div>
        </div>
        <button onClick={onClose} style={{ background:"rgba(255,255,255,0.1)", border:"none", borderRadius:"50%", width:34, height:34, cursor:"pointer", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <X size={16}/>
        </button>
      </div>

      {/* Status content */}
      <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center" }}>
        {status.type === "image" && status.file_url
          ? (
            <div style={{ width:"100%", height:"100%", position:"relative" }}>
              <img src={`http://localhost:8000${status.file_url}`} style={{ width:"100%", height:"100%", objectFit:"contain" }}/>
              {status.text && (
                <div style={{ position:"absolute", bottom:80, left:0, right:0, textAlign:"center", padding:"10px 20px", background:"rgba(0,0,0,0.5)", color:"#fff", fontSize:16, fontWeight:600 }}>
                  {status.text}
                </div>
              )}
            </div>
          )
          : (
            <div style={{ width:"100%", height:"100%", background:status.bg_color || "#059669", display:"flex", alignItems:"center", justifyContent:"center", padding:40 }}>
              <div style={{ fontSize:24, fontWeight:800, color:"#fff", textAlign:"center", textShadow:"0 2px 12px rgba(0,0,0,0.3)", lineHeight:1.4 }}>
                {status.text}
              </div>
            </div>
          )
        }
      </div>

      {/* Reply input for contacts' statuses */}
      {!isOwn && (
        <StatusReply
          status={status}
          currentUser={currentUser}
          onClose={onClose}
        />
      )}

      {/* Views count for own status — clickable */}
      {isOwn && (
        <ViewersList status={status} currentUser={currentUser}/>
      )}

      {/* Nav areas */}
      <div onClick={()=> index > 0 ? setIndex(i=>i-1) : onPrev?.()} style={{ position:"absolute", left:0, top:0, bottom:0, width:"35%", cursor:"pointer", zIndex:5 }}/>
      <div onClick={()=> index < statuses.length-1 ? setIndex(i=>i+1) : onNext?.()} style={{ position:"absolute", right:0, top:0, bottom:0, width:"35%", cursor:"pointer", zIndex:5 }}/>
    </div>
  );
}


// ── AddContactPanel ───────────────────────────────────────────────────────────

function AddContactPanel({ currentUser, onAdd, onChatWith, contacts, T }) {
  const [phone, setPhone]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch]   = useState("");

  const handleAdd = async () => {
    if (!phone.trim()) { setError("Enter a phone number"); return; }
    setLoading(true); setError(""); setSuccess("");
    try {
      const contact = await apiAddContact(currentUser.id, phone.trim());
      setSuccess(`${contact.fullName || contact.name} added to your contacts!`);
      setPhone("");
      onAdd(contact);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const filtered = contacts.filter(c => {
    const name = c.name || c.fullName || c.username || "";
    const username = c.username || "";
    return name.toLowerCase().includes(search.toLowerCase()) ||
           username.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div style={{ padding:"16px 14px", display:"flex", flexDirection:"column", height:"100%" }}>

      {/* Section title */}
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
        <UserPlus size={16} color="#34d399"/>
        <span style={{ fontWeight:700, fontSize:14, color:T.text }}>Contacts</span>
      </div>

      {/* Add new contact box */}
      <div style={{ background:T.glass, border:`1px solid ${T.border}`, borderRadius:16, padding:14, marginBottom:18 }}>
        <div style={{ fontSize:12, color:"#34d399", fontWeight:600, marginBottom:10 }}>+ Add New Contact</div>

        {error && (
          <div style={{ background:"rgba(220,38,38,0.1)", border:"1px solid rgba(220,38,38,0.25)", borderRadius:10, padding:"8px 12px", marginBottom:10, display:"flex", alignItems:"center", gap:6 }}>
            <AlertTriangle size={12} color="#f87171"/>
            <span style={{ fontSize:12, color:"#f87171" }}>{error}</span>
          </div>
        )}
        {success && (
          <div style={{ background:"rgba(5,150,105,0.12)", border:"1px solid rgba(52,211,153,0.25)", borderRadius:10, padding:"8px 12px", marginBottom:10, display:"flex", alignItems:"center", gap:6 }}>
            <Shield size={12} color="#34d399"/>
            <span style={{ fontSize:12, color:"#34d399" }}>{success}</span>
          </div>
        )}

        <div style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(3,15,10,0.4)", border:`1px solid ${T.border}`, borderRadius:12, padding:"9px 12px", marginBottom:10 }}>
          <Phone size={13} color={T.muted}/>
          <input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAdd()}
            placeholder="Phone number e.g. +250781234567"
            style={{ background:"none", border:"none", outline:"none", flex:1, color:T.text, fontSize:13, fontFamily:"'Plus Jakarta Sans',sans-serif" }}
          />
        </div>

        <button onClick={handleAdd} disabled={loading} style={{
          width:"100%", padding:"10px", borderRadius:11, border:"none",
          background: loading ? "rgba(52,211,153,0.2)" : "linear-gradient(135deg,#059669,#34d399)",
          color: loading ? "rgba(167,243,208,0.4)" : "#022c22",
          fontSize:13, fontWeight:700, cursor: loading ? "not-allowed" : "pointer",
          fontFamily:"'Plus Jakarta Sans',sans-serif",
          display:"flex", alignItems:"center", justifyContent:"center", gap:6
        }}>
          {loading
            ? <><Loader size={13} style={{animation:"spin 1s linear infinite"}}/> Searching…</>
            : <><UserPlus size={13}/> Add Contact</>
          }
        </button>
      </div>

      {/* Contacts list */}
      {contacts.length > 0 && (
        <>
          <div style={{ fontSize:11, color:"rgba(52,211,153,0.4)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:10 }}>
            My Contacts ({contacts.length})
          </div>

          {/* Search contacts */}
          <div style={{ display:"flex", alignItems:"center", gap:8, background:T.glass, border:`1px solid ${T.border}`, borderRadius:12, padding:"8px 12px", marginBottom:12 }}>
            <Search size={13} color={T.muted}/>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search contacts…"
              style={{ background:"none", border:"none", outline:"none", flex:1, color:T.text, fontSize:13, fontFamily:"'Plus Jakarta Sans',sans-serif" }}
            />
            {search && <button onClick={()=>setSearch("")} style={{ background:"none", border:"none", cursor:"pointer", color:T.muted, display:"flex", padding:0 }}><X size={12}/></button>}
          </div>

          <div style={{ flex:1, overflowY:"auto" }}>
            {filtered.length === 0
              ? <div style={{ textAlign:"center", color:T.muted, fontSize:13, marginTop:20 }}>No contacts found</div>
              : filtered.map(c => (
                <div
                  key={c.id}
                  onClick={() => onChatWith(c)}
                  style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 8px", borderRadius:14, cursor:"pointer", marginBottom:2, transition:"all 0.2s" }}
                  onMouseEnter={ev => ev.currentTarget.style.background="rgba(52,211,153,0.07)"}
                  onMouseLeave={ev => ev.currentTarget.style.background="transparent"}
                >
                  <div style={{ width:42, height:42, borderRadius:"50%", background:`linear-gradient(135deg,${c.color||"#34d399"}55,${c.color||"#34d399"}22)`, border:`2px solid ${c.color||"#34d399"}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:c.color||"#34d399", flexShrink:0 }}>
                    {c.avatar || c.name?.[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:14, color:T.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.name || c.fullName || c.username}</div>
                    <div style={{ fontSize:12, color:T.muted }}>@{c.username}</div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                    <StatusDot status={c.status||"offline"} size={7}/>
                    <MessageCircle size={14} color="rgba(52,211,153,0.4)"/>
                  </div>
                </div>
              ))
            }
          </div>
        </>
      )}

      {contacts.length === 0 && (
        <div style={{ textAlign:"center", color:T.muted, marginTop:30, fontSize:13, lineHeight:1.8 }}>
          No contacts yet.<br/>
          <span style={{ fontSize:12, color:"rgba(52,211,153,0.35)" }}>Add someone above to start chatting</span>
        </div>
      )}
    </div>
  );
}

// ── PhoneInput ────────────────────────────────────────────────────────────────
function PhoneInput({ value, onChange, placeholder = "Phone number" }) {
  const [countries, setCountries]       = useState([]);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [search, setSearch]             = useState("");
  const [loadingC, setLoadingC]         = useState(true);
  const dropdownRef                     = useRef(null);

  // Fetch all countries from REST Countries API
  useEffect(() => {
    fetch("https://restcountries.com/v3.1/all?fields=name,idd,flag,cca2")
      .then(r => r.json())
      .then(data => {
        const parsed = data
          .filter(c => c.idd?.root && c.idd?.suffixes?.length)
          .map(c => ({
            code: c.cca2,
            name: c.name.common,
            dial: c.idd.root + (c.idd.suffixes.length === 1 ? c.idd.suffixes[0] : ""),
            flag: `https://flagcdn.com/w40/${c.cca2.toLowerCase()}.png`
          }))

          .filter(c => c.dial.length > 1)
          .sort((a, b) => a.name.localeCompare(b.name));
        setCountries(parsed);
        // Default to Rwanda
        const rw = parsed.find(c => c.code === "RW") || parsed[0];
        setSelectedCountry(rw);
        if (!value) onChange(rw.dial);
        setLoadingC(false);
      })
      .catch(() => setLoadingC(false));
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = countries.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.dial.includes(search)
  );

  const handleNumberChange = (e) => {
    const num = e.target.value.replace(/\D/g, "");
    if (selectedCountry) onChange(selectedCountry.dial + num);
  };

  const displayNumber = selectedCountry && value.startsWith(selectedCountry.dial)
    ? value.slice(selectedCountry.dial.length)
    : "";

  const handleCountrySelect = (country) => {
    setSelectedCountry(country);
    setShowDropdown(false);
    setSearch("");
    const num = displayNumber;
    onChange(country.dial + num);
  };

  if (loadingC) return (
    <div style={{ display:"flex", alignItems:"center", gap:8, padding:"12px 16px", borderRadius:14, border:"1px solid rgba(52,211,153,0.18)", background:"rgba(6,78,59,0.28)", marginBottom:12 }}>
      <Loader size={14} color="#34d399" style={{animation:"spin 1s linear infinite"}}/>
      <span style={{ fontSize:13, color:"rgba(110,231,183,0.5)" }}>Loading countries…</span>
    </div>
  );

  return (
    <div style={{ position:"relative", marginBottom:12 }} ref={dropdownRef}>
      <div style={{
        display:"flex", alignItems:"center",
        borderRadius:14, border:"1px solid rgba(52,211,153,0.18)",
        background:"rgba(6,78,59,0.28)", overflow:"hidden"
      }}>
        {/* Country selector */}
        <button
          type="button"
          onClick={() => setShowDropdown(p => !p)}
          style={{
            display:"flex", alignItems:"center", gap:6,
            padding:"12px 12px", background:"rgba(52,211,153,0.06)",
            border:"none", borderRight:"1px solid rgba(52,211,153,0.12)",
            cursor:"pointer", flexShrink:0,
            fontFamily:"'Plus Jakarta Sans',sans-serif"
          }}
        >
          <img src={selectedCountry?.flag} style={{ width:24, height:16, objectFit:"cover", borderRadius:2, flexShrink:0 }}/>
          <span style={{ fontSize:12, color:"rgba(110,231,183,0.7)" }}>{selectedCountry?.dial}</span>
          <ChevronLeft size={11} color="rgba(110,231,183,0.5)" style={{ transform: showDropdown ? "rotate(90deg)" : "rotate(-90deg)", transition:"transform 0.2s" }}/>
        </button>

        {/* Number input */}
        <input
          value={displayNumber}
          onChange={handleNumberChange}
          placeholder={placeholder}
          type="tel"
          style={{
            flex:1, background:"none", border:"none", outline:"none",
            padding:"12px 14px", color:"rgba(236,253,245,0.95)",
            fontSize:14, fontFamily:"'Plus Jakarta Sans',sans-serif"
          }}
        />
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div style={{
          position:"absolute", top:"100%", left:0, right:0, zIndex:500,
          background:"rgba(3,15,10,0.98)", backdropFilter:"blur(24px)",
          border:"1px solid rgba(52,211,153,0.18)", borderRadius:14,
          marginTop:4, maxHeight:240, display:"flex", flexDirection:"column",
          boxShadow:"0 20px 60px rgba(0,0,0,0.6)", overflow:"hidden"
        }}>
          {/* Search */}
          <div style={{ padding:"10px 12px", borderBottom:"1px solid rgba(52,211,153,0.08)", flexShrink:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(6,78,59,0.3)", borderRadius:10, padding:"7px 10px" }}>
              <Search size={12} color="rgba(110,231,183,0.4)"/>
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search country or code…"
                style={{ background:"none", border:"none", outline:"none", flex:1, color:"rgba(236,253,245,0.9)", fontSize:13, fontFamily:"'Plus Jakarta Sans',sans-serif" }}
              />
            </div>
          </div>

          {/* List */}
          <div style={{ overflowY:"auto", flex:1 }}>
            {filtered.map(c => (
              <div
                key={c.code}
                onClick={() => handleCountrySelect(c)}
                style={{
                  display:"flex", alignItems:"center", gap:10,
                  padding:"9px 14px", cursor:"pointer",
                  background: selectedCountry?.code === c.code ? "rgba(52,211,153,0.1)" : "transparent"
                }}
                onMouseEnter={ev => ev.currentTarget.style.background="rgba(52,211,153,0.07)"}
                onMouseLeave={ev => ev.currentTarget.style.background = selectedCountry?.code === c.code ? "rgba(52,211,153,0.1)" : "transparent"}
              >
                <img src={c.flag} style={{ width:24, height:16, objectFit:"cover", borderRadius:2, flexShrink:0 }}/>
                <span style={{ flex:1, fontSize:13, color:"rgba(236,253,245,0.85)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.name}</span>
                <span style={{ fontSize:12, color:"rgba(110,231,183,0.5)", flexShrink:0 }}>{c.dial}</span>
              </div>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding:16, textAlign:"center", color:"rgba(110,231,183,0.4)", fontSize:13 }}>No country found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── AuthPage ──────────────────────────────────────────────────────────────────
function AuthPage({ onAuth }) {
  const [mode, setMode]       = useState("login"); // "login" | "register"
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");

  // Login fields
  const [loginId, setLoginId]         = useState("");
  const [loginPass, setLoginPass]     = useState("");
  const [loginPhone, setLoginPhone]   = useState("");
  const [loginByPhone, setLoginByPhone] = useState(true);

  // Register fields
  const [regFullName, setRegFullName] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail]       = useState("");
  const [regPhone, setRegPhone]       = useState("");
  const [regPass, setRegPass]         = useState("");
  const [regPass2, setRegPass2]       = useState("");

  const handleLogin = async () => {
    const identifier = loginByPhone ? loginPhone : loginId;
    if (!identifier.trim() || !loginPass.trim()) { setError("Please fill in all fields"); return; }
    setLoading(true); setError("");
    try {
      const user = await apiLogin(identifier, loginPass);
      onAuth(user);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleRegister = async () => {
    if (!regFullName || !regUsername || !regEmail || !regPhone || !regPass || !regPass2) {
      setError("Please fill in all fields"); return;
    }
    if (regPass !== regPass2) { setError("Passwords do not match"); return; }
    if (regPass.length < 6)   { setError("Password must be at least 6 characters"); return; }
    if (!regPhone || regPhone.length < 7) { setError("Enter a valid phone number with country code"); return; }
    setLoading(true); setError("");
    try {
      const user = await apiRegister({
        fullName: regFullName, username: regUsername,
        email: regEmail, phone: regPhone, password: regPass
      });
      setSuccess("Account created! Logging you in…");
      setTimeout(() => onAuth(user), 1000);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const inputStyle = {
    width: "100%", padding: "12px 16px", borderRadius: 14,
    background: "rgba(6,78,59,0.28)", border: "1px solid rgba(52,211,153,0.18)",
    color: "rgba(236,253,245,0.95)", fontSize: 14, outline: "none",
    fontFamily: "'Plus Jakarta Sans',sans-serif", marginBottom: 12,
    boxSizing: "border-box"
  };

  const btnStyle = {
    width: "100%", padding: "13px", borderRadius: 14, border: "none",
    background: loading ? "rgba(52,211,153,0.3)" : "linear-gradient(135deg,#059669,#34d399)",
    color: loading ? "rgba(167,243,208,0.5)" : "#022c22",
    fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
    fontFamily: "'Plus Jakarta Sans',sans-serif", marginTop: 4,
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8
  };

  return (
    <div style={{
      height: "100vh", width: "100vw", display: "flex", alignItems: "center",
      justifyContent: "center", overflow: "hidden",
      background: "radial-gradient(ellipse at 15% 20%,rgba(5,150,105,0.12) 0%,transparent 55%),radial-gradient(ellipse at 85% 80%,rgba(20,184,166,0.08) 0%,transparent 55%),#030f0a",
      fontFamily: "'Plus Jakarta Sans',sans-serif"
    }}>
      {/* Ambient orbs */}
      <div style={{ position:"fixed", top:"8%", left:"3%", width:400, height:400, borderRadius:"50%", background:"radial-gradient(circle,rgba(5,150,105,0.08) 0%,transparent 70%)", pointerEvents:"none" }}/>
      <div style={{ position:"fixed", bottom:"8%", right:"3%", width:300, height:300, borderRadius:"50%", background:"radial-gradient(circle,rgba(20,184,166,0.06) 0%,transparent 70%)", pointerEvents:"none" }}/>

      <div style={{
        width: "100%", maxWidth: 420, padding: "0 20px",
        animation: "fadeUp 0.35s ease", position: "relative", zIndex: 1
      }}>
        {/* Logo */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", marginBottom:32 }}>
          <div style={{ width:64, height:64, borderRadius:22, background:"linear-gradient(135deg,#059669,#34d399)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 8px 32px rgba(16,185,129,0.4)", fontSize:32, fontWeight:800, color:"#022c22", marginBottom:14, letterSpacing:"-2px" }}>G</div>
          <div style={{ fontWeight:800, fontSize:26, color:"rgba(236,253,245,0.95)", letterSpacing:"-0.5px" }}>
            G<span style={{color:"#34d399"}}>-</span>Talk
          </div>
          <div style={{ fontSize:12, color:"rgba(110,231,183,0.5)", marginTop:4 }}>Encrypted · Real-time · Private</div>
        </div>

        {/* Card */}
        <div style={{
          background: "rgba(6,78,59,0.18)", backdropFilter: "blur(32px)",
          border: "1px solid rgba(52,211,153,0.15)", borderRadius: 24,
          padding: "28px 28px 24px"
        }}>
          {/* Tabs */}
          <div style={{ display:"flex", gap:4, marginBottom:24, background:"rgba(3,15,10,0.4)", borderRadius:14, padding:4 }}>
            {["login","register"].map(t => (
              <button key={t} onClick={()=>{setMode(t);setError("");setSuccess("");}} style={{
                flex:1, padding:"9px 0", borderRadius:11, border:"none", cursor:"pointer",
                background: mode===t ? "rgba(52,211,153,0.18)" : "transparent",
                color: mode===t ? "#34d399" : "rgba(110,231,183,0.45)",
                fontSize:13, fontWeight:600, fontFamily:"'Plus Jakarta Sans',sans-serif",
                transition:"all 0.2s"
              }}>
                {t === "login" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>

          {/* Error / Success */}
          {error && (
            <div style={{ background:"rgba(220,38,38,0.1)", border:"1px solid rgba(220,38,38,0.25)", borderRadius:12, padding:"10px 14px", marginBottom:14, display:"flex", alignItems:"center", gap:8 }}>
              <AlertTriangle size={14} color="#f87171"/>
              <span style={{ fontSize:13, color:"#f87171" }}>{error}</span>
            </div>
          )}
          {success && (
            <div style={{ background:"rgba(5,150,105,0.12)", border:"1px solid rgba(52,211,153,0.25)", borderRadius:12, padding:"10px 14px", marginBottom:14, display:"flex", alignItems:"center", gap:8 }}>
              <Shield size={14} color="#34d399"/>
              <span style={{ fontSize:13, color:"#34d399" }}>{success}</span>
            </div>
          )}

          {/* LOGIN FORM */}
          {mode === "login" && (
            <>
              {/* Toggle phone/username */}
              <div style={{ display:"flex", gap:4, marginBottom:14, background:"rgba(3,15,10,0.4)", borderRadius:10, padding:3 }}>
                {[["Phone","phone"],[" Username","username"]].map(([label,val]) => (
                  <button key={val} onClick={()=>setLoginByPhone(val==="phone")} style={{
                    flex:1, padding:"7px 0", borderRadius:8, border:"none", cursor:"pointer",
                    background: (loginByPhone && val==="phone") || (!loginByPhone && val==="username") ? "rgba(52,211,153,0.18)" : "transparent",
                    color: (loginByPhone && val==="phone") || (!loginByPhone && val==="username") ? "#34d399" : "rgba(110,231,183,0.4)",
                    fontSize:12, fontWeight:600, fontFamily:"'Plus Jakarta Sans',sans-serif"
                  }}>{label}</button>
                ))}
              </div>

              {loginByPhone
                ? <PhoneInput value={loginPhone} onChange={setLoginPhone} placeholder="Your number"/>
                : <input value={loginId} onChange={e=>setLoginId(e.target.value)} placeholder="Username" style={inputStyle} onKeyDown={e=>e.key==="Enter"&&handleLogin()}/>
              }
              <input value={loginPass} onChange={e=>setLoginPass(e.target.value)} placeholder="Password" type="password" style={inputStyle}
                onKeyDown={e=>e.key==="Enter"&&handleLogin()}/>
              <button onClick={handleLogin} style={btnStyle} disabled={loading}>
                {loading ? <><Loader size={15} style={{animation:"spin 1s linear infinite"}}/> Signing in…</> : "Sign In"}
              </button>
            </>
          )}

          {/* REGISTER FORM */}
          {mode === "register" && (
            <>
              <input value={regFullName}  onChange={e=>setRegFullName(e.target.value)}  placeholder="Full name"        style={inputStyle}/>
              <input value={regUsername}  onChange={e=>setRegUsername(e.target.value)}  placeholder="Username"         style={inputStyle}/>
              <input value={regEmail}     onChange={e=>setRegEmail(e.target.value)}     placeholder="Email address"    style={inputStyle} type="email"/>
              <PhoneInput value={regPhone} onChange={setRegPhone} placeholder="Your number"/>
              <input value={regPass}      onChange={e=>setRegPass(e.target.value)}      placeholder="Password"         style={inputStyle} type="password"/>
              <input value={regPass2}     onChange={e=>setRegPass2(e.target.value)}     placeholder="Confirm password" style={{...inputStyle, marginBottom:4}} type="password"
                onKeyDown={e=>e.key==="Enter"&&handleRegister()}/>
              <button onClick={handleRegister} style={btnStyle} disabled={loading}>
                {loading ? <><Loader size={15} style={{animation:"spin 1s linear infinite"}}/> Creating account…</> : "Create Account"}
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ display:"flex", justifyContent:"center", alignItems:"center", gap:6, marginTop:20 }}>
          <Lock size={11} color="rgba(52,211,153,0.4)"/>
          <span style={{ fontSize:11, color:"rgba(52,211,153,0.4)" }}>End-to-end encrypted · G-Talk</span>
        </div>
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════════════════════════
export default function GChart() {

  const [dark, setDark]                   = useState(true);
  const [currentUser, setCurrentUser]     = useState(null);
  const [users, setUsers]                 = useState([]);
  const [loadingUsers, setLoadingUsers]   = useState(false);
  const [usersError, setUsersError]       = useState(null);
  const [messages, setMessages]           = useState({});
  const [activeUser, setActiveUser]       = useState(null);
  const [input, setInput]                 = useState("");
  const [search, setSearch]               = useState("");
  const [msgSearch, setMsgSearch]         = useState("");
  const [showMsgSearch, setShowMsgSearch] = useState(false);
  const [isTyping, setIsTyping]           = useState(false);
  const [showProfile, setShowProfile]     = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [mobileView, setMobileView]       = useState("list");
  const [filter, setFilter]               = useState("all");
  const [sidebarTab, setSidebarTab]       = useState("chats");
  const [notifications, setNotifications] = useState(true);
  const [lightbox, setLightbox]           = useState(null);
  const [uploading, setUploading]         = useState(false);
  const [uploadError, setUploadError]     = useState("");
  const [isRecording, setIsRecording]     = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [statuses, setStatuses]           = useState([]);
  const [showStatusViewer, setShowStatusViewer] = useState(null);
  const [showStatusComposer, setShowStatusComposer] = useState(false);
  const [activeStatusUser, setActiveStatusUser] = useState(null);
  const [activeStatusIndex, setActiveStatusIndex] = useState(0);
  
  const messagesEndRef = useRef(null);
  const chatBodyRef    = useRef(null);
  const inputRef       = useRef(null);
  const fileInputRef    = useRef(null);
  const typingTimer     = useRef(null);
  const wsRef           = useRef(null);
  const mediaRecorder   = useRef(null);
  const audioChunks     = useRef([]);
  const recordingTimer  = useRef(null);

  // ── FETCH CONTACTS + STATUSES WHEN USER LOGS IN ───────────────────────────
  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      try {
        setLoadingUsers(true);
        setUsersError(null);
        const contacts = await apiGetContacts(currentUser.id);
        setUsers(contacts);
        const fetchedStatuses = await apiGetStatuses(currentUser.id);
        setStatuses(fetchedStatuses);
      } catch {
        setUsersError("Could not load contacts. Is FastAPI running?");
      } finally {
        setLoadingUsers(false);
      }
    })();
  }, [currentUser]);


  // ── WEBSOCKET for real-time events ────────────────────────────────────────
  useEffect(() => {
    if (!currentUser) return;
    console.log("[G-Talk] Attempting WS connect for:", currentUser.id);
    wsRef.current = openWS(currentUser.id, {
      onMsg: ({ message, from }) => {
        setMessages(p => ({
          ...p,
          [from]: [...(p[from] || []), { ...message, sender: from }]
        }));
        // If chat with this user is currently open, mark as seen immediately
        setActiveUser(curr => {
          if (curr?.id === from) {
            apiMarkSeen(currentUser.id, from);
            wsSend(wsRef.current, { event: "message_seen", from_user: from });
          } else {
            // Otherwise increment unread badge
            setUsers(p => p.map(u =>
              u.id === from ? { ...u, unread: (u.unread || 0) + 1 } : u
            ));
          }
          return curr;
        });
      },

      onTyping: ({ from, isTyping: t }) => {
        setActiveUser(curr => { if (curr?.id===from) setIsTyping(t); return curr; });
      },
      onOffline: ({ user_id }) => {
        setUsers(p => p.map(u => u.id===user_id ? {...u, status:"offline"} : u));
      },
      onSeen: ({ by }) => {
        // Update all sent messages in the conversation to "seen"
        setMessages(p => {
          const updated = { ...p };
          if (updated[by]) {
            updated[by] = updated[by].map(m =>
              m.sender === currentUser.id ? { ...m, status: "seen" } : m
            );
          }
          return updated;
        });
      },

    });
    return () => wsRef.current?.close?.();
  }, [currentUser]);

  // ── Derived state ─────────────────────────────────────────────────────────
  const filteredUsers = users.filter(u => {
    if (!u || !u.name) return false;
    const m = u.name.toLowerCase().includes(search.toLowerCase()) || (u.role || "").toLowerCase().includes(search.toLowerCase());
    if (filter==="online") return m && u.status==="online";
    if (filter==="unread") return m && u.unread>0;
    return m;
  });

  const currentMsgs  = activeUser ? (messages[activeUser.id]||[]) : [];
  const filteredMsgs = msgSearch ? currentMsgs.filter(m=>m.text?.toLowerCase().includes(msgSearch.toLowerCase())) : currentMsgs;
  const getUserById  = id => {
    if (id === "me" || id === currentUser?.id) return { ...currentUser, name: currentUser?.fullName || "You" };
    return users.find(u => u.id === id) || { name:"Unknown", avatar:"??", color:"#34d399", status:"offline", id };
  };
  const lastMsgFor   = uid => { const ms=messages[uid]||[]; const l=ms[ms.length-1]; return l?(l.sender==="me"?`You: ${l.text}`:l.text):""; };

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior:"smooth" });
  useEffect(() => { scrollToBottom(); }, [currentMsgs.length, activeUser]);

  const handleScroll = () => {
    const el = chatBodyRef.current;
    if (!el) return;
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 200);
  };

  // ── Select user + fetch their messages from backend ───────────────────────
  const selectUser = async (u) => {
    setActiveUser(u);
    setInput("");
    setShowProfile(false);
    setMobileView("chat");
    setUsers(p => p.map(x => x.id===u.id ? {...x, unread:0} : x));
    // Mark their messages as seen
    if (currentUser) {
      apiMarkSeen(currentUser.id, u.id);
      console.log("[G-Talk] Sending message_seen for:", u.id);
      wsSend(wsRef.current, { event: "message_seen", from_user: u.id });
    }
    if (!messages[u.id]) {
        try {
          const msgs = await apiGetMessages(currentUser.id, u.id);
          if (msgs.length) setMessages(p => ({...p, [u.id]: msgs}));
        } catch { /* stay empty */ }
      }
  };

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!input.trim() || !activeUser) return;
    const msg = { id:`opt_${Date.now()}`, sender:"me", text:input.trim(), time:new Date().toLocaleTimeString("en",{hour:"2-digit",minute:"2-digit"}), reactions:{}, status:"sent", type:"text" };
    setMessages(p => ({...p, [activeUser.id]:[...(p[activeUser.id]||[]),msg]}));
    setInput("");
    apiFetch(`/api/send/${activeUser.id}`, { method:"POST", body:JSON.stringify({ text:msg.text, type:"text", sender_id: currentUser.id }) });    
  };

  const handleReact = async (msgId, emoji) => {
    setMessages(p => ({...p, [activeUser.id]:(p[activeUser.id]||[]).map(m => {
      if (m.id!==msgId) return m;
      const r = {...m.reactions};
      if (r[emoji]) delete r[emoji]; else r[emoji]=true;
      return {...m, reactions:r};
    })}));
    apiFetch(`/api/react/${msgId}`, { method:"POST", body:JSON.stringify({ emoji, user_id: currentUser.id, other_id: activeUser.id }) });
  };


  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeUser) return;
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("File too large. Max size is 10MB");
      setTimeout(() => setUploadError(""), 3000);
      return;
    }
    setUploading(true);
    setUploadError("");
    try {
      const msg = await apiUploadFile(currentUser.id, activeUser.id, file);
      setMessages(p => ({...p, [activeUser.id]: [...(p[activeUser.id]||[]), msg]}));
    } catch (e) {
      setUploadError(e.message);
      setTimeout(() => setUploadError(""), 3000);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const startRecording = async () => {
    if (!activeUser) return;
      console.log("[G-Talk] Starting recording...");
      console.log("[G-Talk] mediaDevices available:", !!navigator.mediaDevices);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log("[G-Talk] Got stream:", stream);
      audioChunks.current = [];
      setRecordingTime(0);

      // Start timer
      recordingTimer.current = setInterval(() => {
        setRecordingTime(t => {
          if (t >= 120) {
            stopRecording();
            return t;
          }
          return t + 1;
        });
      }, 1000);

      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/ogg")
        ? "audio/ogg"
        : "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorder.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.current.push(e.data);
      };

      recorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach(t => t.stop());
        clearInterval(recordingTimer.current);
        setRecordingTime(0);

        const mimeUsed = mediaRecorder.current?.mimeType || "audio/webm";
        const ext = mimeUsed.includes("ogg") ? "ogg" : "webm";
        const blob = new Blob(audioChunks.current, { type: mimeUsed });
        if (blob.size < 1000) return;
        const file = new File([blob], `voice_${Date.now()}.${ext}`, { type: mimeUsed });

        setUploading(true);
        try {
          const msg = await apiUploadFile(currentUser.id, activeUser.id, file);
          setMessages(p => ({...p, [activeUser.id]: [...(p[activeUser.id]||[]), msg]}));
        } catch (e) {
          setUploadError("Failed to send voice note");
          setTimeout(() => setUploadError(""), 3000);
        } finally {
          setUploading(false);
        }
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.log("[G-Talk] Recording error:", err.name, err.message, err);
      setUploadError("Microphone access denied");
      setTimeout(() => setUploadError(""), 3000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current?.state === "recording") {
      mediaRecorder.current.stop();
    }
    clearInterval(recordingTimer.current);
    setIsRecording(false);
  };

  const formatRecordingTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleKeyDown = (e) => {
    if (e.key==="Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    wsSend(wsRef.current, {event:"typing", to:activeUser?.id, isTyping:true});
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => wsSend(wsRef.current, {event:"typing", to:activeUser?.id, isTyping:false}), 1500);
  };

  // ── Auth gate ─────────────────────────────────────────────────────────────
  if (!currentUser) {
    return <AuthPage onAuth={(user) => setCurrentUser(user)} />;
  }
  window._openLightbox = (url, name) => setLightbox({ url, name });
  const handleLogout = async () => {
    await apiFetch(`/api/logout/${currentUser.id}`, { method: "POST" });
    setCurrentUser(null);
    setUsers([]);
    setMessages({});
    setActiveUser(null);
  };
  
  // ── Theme colours ─────────────────────────────────────────────────────────
  const T = {
    sidebar:  dark ? "rgba(3,15,10,0.82)"   : "rgba(236,253,245,0.82)",
    chat:     dark ? "rgba(3,12,8,0.45)"    : "rgba(240,253,244,0.45)",
    header:   dark ? "rgba(3,15,10,0.72)"   : "rgba(220,252,231,0.72)",
    input:    dark ? "rgba(3,15,10,0.75)"   : "rgba(220,252,231,0.75)",
    text:     dark ? "rgba(236,253,245,0.95)": "rgba(2,44,34,0.9)",
    sub:      dark ? "rgba(167,243,208,0.6)" : "rgba(4,120,87,0.7)",
    muted:    dark ? "rgba(110,231,183,0.32)": "rgba(4,120,87,0.38)",
    border:   dark ? "rgba(52,211,153,0.12)" : "rgba(5,150,105,0.2)",
    borderS:  dark ? "rgba(52,211,153,0.3)"  : "rgba(5,150,105,0.45)",
    glass:    dark ? "rgba(6,78,59,0.28)"    : "rgba(209,250,229,0.55)",
  };

  // ── CSS animations ────────────────────────────────────────────────────────
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
    *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
    html, body, #root { height:100%; width:100%; overflow:hidden; font-family:'Plus Jakarta Sans',sans-serif; }
    ::-webkit-scrollbar { width:3px; } ::-webkit-scrollbar-track { background:transparent; } ::-webkit-scrollbar-thumb { background:rgba(52,211,153,0.22); border-radius:4px; }
    input, textarea, button { font-family:'Plus Jakarta Sans',sans-serif; }
    input::placeholder, textarea::placeholder { color:rgba(110,231,183,0.32); }
    @keyframes fadeUp    { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
    @keyframes fadeIn    { from { opacity:0; } to { opacity:1; } }
    @keyframes slideRight{ from { transform:translateX(100%); } to { transform:translateX(0); } }
    @keyframes bounce    { 0%,60%,100% { transform:translateY(0); } 30% { transform:translateY(-7px); } }
    @keyframes glow      { 0%,100% { box-shadow:0 0 14px rgba(16,185,129,0.4); } 50% { box-shadow:0 0 32px rgba(16,185,129,0.75); } }
    @keyframes recPulse  { 0%,100% { transform:scale(1); opacity:1; } 50% { transform:scale(0.93); opacity:0.6; } }
    @keyframes spin      { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
    @keyframes orbFloat  { 0%,100% { transform:translateY(0) scale(1); } 50% { transform:translateY(-18px) scale(1.04); } }
    @media (max-width:768px) {
      .sidebar  { width:100% !important; display:${mobileView==="list"?"flex":"none"} !important; }
      .chatpanel{ display:${mobileView==="chat"?"flex":"none"} !important; }
    }
  `;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{css}</style>
      <div style={{
        height:"100vh", width:"100vw", display:"flex", overflow:"hidden",
        fontFamily:"'Plus Jakarta Sans',sans-serif",
        background: dark
          ? "radial-gradient(ellipse at 15% 20%,rgba(5,150,105,0.1) 0%,transparent 55%),radial-gradient(ellipse at 85% 80%,rgba(20,184,166,0.07) 0%,transparent 55%),#030f0a"
          : "radial-gradient(ellipse at 15% 20%,rgba(5,150,105,0.07) 0%,transparent 55%),#f0fdf4",
        position:"relative",
      }}>

        {/* Ambient orbs */}
        <div style={{ position:"fixed", top:"8%", left:"3%", width:480, height:480, borderRadius:"50%", background:"radial-gradient(circle,rgba(5,150,105,0.07) 0%,transparent 70%)", pointerEvents:"none", zIndex:0, animation:"orbFloat 8s ease infinite" }}/>
        <div style={{ position:"fixed", bottom:"8%", right:"3%", width:380, height:380, borderRadius:"50%", background:"radial-gradient(circle,rgba(20,184,166,0.05) 0%,transparent 70%)", pointerEvents:"none", zIndex:0, animation:"orbFloat 11s ease 2s infinite" }}/>

        {/* ════════════════════════════════════════════════════════════════
            LEFT PANEL — SIDEBAR
        ════════════════════════════════════════════════════════════════ */}
        <div className="sidebar" style={{ width:340, flexShrink:0, display:"flex", flexDirection:"column", background:T.sidebar, backdropFilter:"blur(32px)", borderRight:`1px solid ${T.border}`, position:"relative", zIndex:10 }}>

          {/* Brand */}
          <div style={{ padding:"20px 18px 0", flexShrink:0 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18 }}>
              <div style={{ display:"flex", alignItems:"center", gap:11 }}>
                <div style={{ width:40, height:40, borderRadius:14, background:"linear-gradient(135deg,#059669,#34d399)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 4px 18px rgba(16,185,129,0.45)", animation:"glow 3s ease infinite", fontSize:22, fontWeight:800, color:"#022c22", letterSpacing:"-1px" }}>G</div>
                <div>
                  <div style={{ fontWeight:800, fontSize:18, color:T.text, letterSpacing:"-0.4px" }}>G<span style={{color:"#34d399"}}>-</span>Chart</div>
                  <div style={{ fontSize:10, color:"#34d399", fontWeight:500, opacity:0.75 }}>Encrypted · Realtime</div>
                </div>
              </div>
              <div style={{ display:"flex", gap:6 }}>
                <button onClick={()=>setNotifications(n=>!n)} style={{ background:T.glass, border:`1px solid ${T.border}`, borderRadius:10, width:34, height:34, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:T.sub }}>
                  {notifications ? <Bell size={15}/> : <BellOff size={15}/>}
                </button>
                <button onClick={()=>setDark(d=>!d)} style={{ background:T.glass, border:`1px solid ${T.border}`, borderRadius:10, width:34, height:34, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:T.sub }}>
                  {dark ? <Sun size={15}/> : <Moon size={15}/>}
                </button>
              </div>
            </div>

            {/* My profile pill */}
            <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 13px", background:T.glass, border:`1px solid ${T.border}`, borderRadius:14, marginBottom:16, backdropFilter:"blur(10px)" }}>
                <div style={{ width:36, height:36, borderRadius:"50%", background:`linear-gradient(135deg,${currentUser.color}55,${currentUser.color}22)`, border:`2px solid ${currentUser.color}44`, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:12, color:currentUser.color }}>{currentUser.avatar}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:T.text }}>{currentUser.fullName}</div>
                    <div style={{ fontSize:11, color:"#34d399", display:"flex", alignItems:"center", gap:4 }}><StatusDot status="online" size={7}/> Active now</div>
                </div>
                  <div style={{ display:"flex", gap:6 }}>
                    <button onClick={()=>setShowStatusComposer(true)} title="Add status" style={{ background:"none", border:"none", cursor:"pointer", color:T.muted, display:"flex", padding:0 }}><Plus size={14}/></button>
                    <button onClick={handleLogout} title="Logout" style={{ background:"none", border:"none", cursor:"pointer", color:T.muted, display:"flex", padding:0 }}><LogOut size={14}/></button>
                  </div>
            </div>

            {/* Tabs */}
            <div style={{ display:"flex", gap:4, marginBottom:14, background:T.glass, borderRadius:12, padding:4 }}>
              {["chats","groups"].map(tab => (
              <button key={tab} onClick={()=>{setSidebarTab(tab);}} style={{ flex:1, padding:"7px 0", borderRadius:9, border:"none", cursor:"pointer", background:sidebarTab===tab?"rgba(52,211,153,0.18)":"transparent", color:sidebarTab===tab?"#34d399":T.muted, fontSize:13, fontWeight:500, transition:"all 0.2s" }}>
                  {tab === "groups" ? "Contacts" : "Chats"}
                </button>
              ))}
            </div>

            {/* Search */}
            <div style={{ display:"flex", alignItems:"center", gap:10, background:T.glass, border:`1px solid ${T.border}`, borderRadius:14, padding:"9px 14px", backdropFilter:"blur(8px)" }}>
              <Search size={15} color={T.muted} strokeWidth={2.5}/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search people, messages…" style={{ background:"none", border:"none", outline:"none", flex:1, color:T.text, fontSize:13 }}/>
              {search && <button onClick={()=>setSearch("")} style={{ background:"none", border:"none", cursor:"pointer", color:T.muted, display:"flex", padding:0 }}><X size={13}/></button>}
            </div>

            {/* Filter chips */}
            <div style={{ display:"flex", gap:6, marginTop:12, marginBottom:4, overflowX:"auto", paddingBottom:4 }}>
              {["all","online","unread"].map(f => (
                <button key={f} onClick={()=>setFilter(f)} style={{ padding:"5px 12px", borderRadius:20, border:"none", cursor:"pointer", flexShrink:0, background:filter===f?"linear-gradient(135deg,#059669,#34d399)":T.glass, color:filter===f?"#022c22":T.sub, fontSize:11, fontWeight:filter===f?700:500, boxShadow:filter===f?"0 2px 12px rgba(16,185,129,0.4)":"none", border:filter===f?"none":`1px solid ${T.border}`, transition:"all 0.2s" }}>
                  {f[0].toUpperCase()+f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* User list */}
              <div style={{ flex:1, overflowY:"auto", padding:"6px 10px 20px" }}>
                      {/* Status row */}
              {sidebarTab==="chats" && statuses.length > 0 && (
                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:11, color:"rgba(52,211,153,0.4)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em", padding:"0 4px", marginBottom:8 }}>Recent Updates</div>
                  <div style={{ display:"flex", gap:12, overflowX:"auto", paddingBottom:6 }}>
                    {statuses.map((sd, i) => (
                      <div key={sd.user.id} onClick={()=>setShowStatusViewer(i)} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, cursor:"pointer", flexShrink:0 }}>
                        <div style={{ width:52, height:52, borderRadius:"50%", padding:2, background: sd.all_seen ? "rgba(110,231,183,0.2)" : "linear-gradient(135deg,#059669,#34d399)", boxShadow: sd.all_seen ? "none" : "0 0 12px rgba(52,211,153,0.4)" }}>
                          <div style={{ width:"100%", height:"100%", borderRadius:"50%", background:`linear-gradient(135deg,${sd.user.color||"#34d399"}55,${sd.user.color||"#34d399"}22)`, border:"2px solid rgba(3,15,10,0.8)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:700, color:sd.user.color||"#34d399" }}>
                            {sd.user.avatar || sd.user.name?.[0]?.toUpperCase()}
                          </div>
                        </div>
                        <span style={{ fontSize:10, color:"rgba(167,243,208,0.6)", maxWidth:52, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", textAlign:"center" }}>
                          {sd.user.id === currentUser.id ? "You" : sd.user.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            {/* Loading state — fetching from backend */}
            {loadingUsers && sidebarTab==="chats" && (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", marginTop:60, gap:14 }}>
                <div style={{ animation:"spin 1s linear infinite", color:"#34d399" }}><Loader size={28}/></div>
                <div style={{ color:T.muted, fontSize:13, textAlign:"center" }}>Fetching encrypted users from backend…</div>
                <div style={{ fontSize:11, color:"rgba(52,211,153,0.3)", textAlign:"center", maxWidth:200 }}>Decrypting via /api/decrypt/:id</div>
              </div>
            )}

            {/* Error state — backend offline */}
            {usersError && sidebarTab==="chats" && (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", marginTop:40, gap:12, padding:"0 16px" }}>
                <div style={{ width:52, height:52, borderRadius:"50%", background:"rgba(220,38,38,0.1)", border:"1px solid rgba(220,38,38,0.25)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <AlertTriangle size={22} color="#f87171"/>
                </div>
                <div style={{ color:"#f87171", fontSize:13, fontWeight:600, textAlign:"center" }}>Backend Offline</div>
                <div style={{ color:T.muted, fontSize:11, textAlign:"center", lineHeight:1.6 }}>{usersError}</div>
                <div style={{ background:T.glass, border:`1px solid ${T.border}`, borderRadius:10, padding:"8px 12px", fontSize:11, color:"rgba(52,211,153,0.6)", textAlign:"center" }}>
                  Run: <code style={{color:"#34d399"}}>python main.py</code>
                </div>
              </div>
            )}

            {/* Updates tab */}
            {sidebarTab==="updates" && (
              <div style={{ padding:"10px 4px" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, padding:"0 10px" }}>
                  <span style={{ fontWeight:700, fontSize:14, color:T.text }}>Status Updates</span>
                  <button onClick={()=>setShowStatusComposer(true)} style={{ background:"linear-gradient(135deg,#059669,#34d399)", border:"none", borderRadius:10, padding:"6px 12px", color:"#022c22", fontSize:12, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
                    <Plus size={13}/> Add
                  </button>
                </div>

                {/* My status */}
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:11, color:"rgba(52,211,153,0.4)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em", padding:"0 10px", marginBottom:8 }}>My Status</div>
                  {statuses.find(s => s.user.id === currentUser.id)
                    ? (
                      <div onClick={()=>setShowStatusViewer(statuses.findIndex(s=>s.user.id===currentUser.id))} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", borderRadius:16, cursor:"pointer", background:"rgba(52,211,153,0.05)", border:"1px solid rgba(52,211,153,0.1)" }}>
                        <div style={{ width:48, height:48, borderRadius:"50%", padding:2, background:"linear-gradient(135deg,#059669,#34d399)" }}>
                          <div style={{ width:"100%", height:"100%", borderRadius:"50%", background:`linear-gradient(135deg,${currentUser.color}55,${currentUser.color}22)`, border:"2px solid rgba(3,15,10,0.8)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:700, color:currentUser.color }}>
                            {currentUser.avatar}
                          </div>
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontWeight:600, fontSize:14, color:T.text }}>My Status</div>
                          <div style={{ fontSize:12, color:T.muted }}>{statuses.find(s=>s.user.id===currentUser.id)?.statuses?.length} update{statuses.find(s=>s.user.id===currentUser.id)?.statuses?.length > 1 ? "s" : ""}</div>
                        </div>
                      </div>
                    )
                    : (
                      <div onClick={()=>setShowStatusComposer(true)} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", borderRadius:16, cursor:"pointer" }}>
                        <div style={{ width:48, height:48, borderRadius:"50%", background:T.glass, border:`2px dashed rgba(52,211,153,0.3)`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                          <Plus size={18} color="rgba(52,211,153,0.5)"/>
                        </div>
                        <div>
                          <div style={{ fontWeight:600, fontSize:14, color:T.text }}>Add Status</div>
                          <div style={{ fontSize:12, color:T.muted }}>Tap to add update</div>
                        </div>
                      </div>
                    )
                  }
                </div>

                {/* Contacts statuses */}
                {statuses.filter(s => s.user.id !== currentUser.id).length > 0 && (
                  <div>
                    <div style={{ fontSize:11, color:"rgba(52,211,153,0.4)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em", padding:"0 10px", marginBottom:8 }}>Recent Updates</div>
                    {statuses.filter(s => s.user.id !== currentUser.id).map((sd) => (
                      <div key={sd.user.id} onClick={()=>setShowStatusViewer(statuses.indexOf(sd))} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", borderRadius:16, cursor:"pointer", marginBottom:2 }}
                        onMouseEnter={ev=>ev.currentTarget.style.background="rgba(52,211,153,0.05)"}
                        onMouseLeave={ev=>ev.currentTarget.style.background="transparent"}
                      >
                        <div style={{ width:48, height:48, borderRadius:"50%", padding:2, background: sd.all_seen ? "rgba(110,231,183,0.15)" : "linear-gradient(135deg,#059669,#34d399)", boxShadow: sd.all_seen ? "none" : "0 0 12px rgba(52,211,153,0.3)", flexShrink:0 }}>
                          <div style={{ width:"100%", height:"100%", borderRadius:"50%", background:`linear-gradient(135deg,${sd.user.color||"#34d399"}55,${sd.user.color||"#34d399"}22)`, border:"2px solid rgba(3,15,10,0.8)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:700, color:sd.user.color||"#34d399" }}>
                            {sd.user.avatar || sd.user.name?.[0]?.toUpperCase()}
                          </div>
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontWeight:600, fontSize:14, color:T.text }}>{sd.user.name}</div>
                          <div style={{ fontSize:12, color: sd.all_seen ? T.muted : "#34d399", fontWeight: sd.all_seen ? 400 : 600 }}>
                            {sd.all_seen ? "Viewed" : "New update"} · {sd.statuses.length} update{sd.statuses.length > 1 ? "s" : ""}
                          </div>
                        </div>
                        {!sd.all_seen && <div style={{ width:10, height:10, borderRadius:"50%", background:"#34d399", flexShrink:0 }}/>}
                      </div>
                    ))}
                  </div>
                )}

                {statuses.filter(s => s.user.id !== currentUser.id).length === 0 && (
                  <div style={{ textAlign:"center", color:T.muted, marginTop:40, fontSize:13, lineHeight:1.8 }}>
                    No updates from contacts yet.<br/>
                    <span style={{ fontSize:12, color:"rgba(52,211,153,0.35)" }}>Updates disappear after 24 hours</span>
                  </div>
                )}
              </div>
            )}

            {/* Contacts tab */}
            {/* Contacts tab */}
            {sidebarTab==="groups" && (
              <AddContactPanel
                currentUser={currentUser}
                contacts={users}
                onAdd={(newContact) => setUsers(p => [...p, newContact])}
                onChatWith={(contact) => {
                  selectUser(contact);
                  setSidebarTab("chats");
                }}
                T={T}
              />
            )}

            {/* Real users fetched and decrypted from backend */}
            {!loadingUsers && !usersError && sidebarTab==="chats" && (
              filteredUsers.length===0
                ? <div style={{ textAlign:"center", color:T.muted, marginTop:40, fontSize:13 }}>No users found</div>
                : filteredUsers.map(u => (
                  <div key={u.id} onClick={()=>selectUser(u)} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", borderRadius:16, cursor:"pointer", marginBottom:2, background:activeUser?.id===u.id?"rgba(52,211,153,0.12)":"transparent", border:activeUser?.id===u.id?`1px solid ${T.borderS}`:"1px solid transparent", backdropFilter:activeUser?.id===u.id?"blur(8px)":"none", transition:"all 0.2s" }}
                    onMouseEnter={ev=>{if(activeUser?.id!==u.id){ev.currentTarget.style.background="rgba(52,211,153,0.05)";ev.currentTarget.style.border=`1px solid ${T.border}`;}}}
                    onMouseLeave={ev=>{if(activeUser?.id!==u.id){ev.currentTarget.style.background="transparent";ev.currentTarget.style.border="1px solid transparent";}}}
                  >
                    <Avatar user={u} size={48}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        <span style={{ fontWeight:600, fontSize:14, color:T.text }}>{u.name}</span>
                        <span style={{ fontSize:10, color:T.muted }}>{u.lastSeen}</span>
                      </div>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:2 }}>
                        <span style={{ fontSize:12, color:T.muted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:140 }}>{lastMsgFor(u.id)||u.bio}</span>
                        {u.unread>0 && <div style={{ background:"linear-gradient(135deg,#059669,#34d399)", color:"#022c22", borderRadius:20, minWidth:20, height:20, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:800, padding:"0 6px", flexShrink:0 }}>{u.unread}</div>}
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:2 }}>
                        <StatusDot status={u.status} size={7}/>
                        <span style={{ fontSize:10, color:u.status==="online"?"#34d399":T.muted }}>{u.status}</span>
                        <span style={{ fontSize:10, color:T.muted, marginLeft:4 }}>• {u.role}</span>
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>

          {/* Bottom nav */}
          <div style={{ padding:"12px 18px 16px", borderTop:`1px solid ${T.border}`, display:"flex", justifyContent:"space-around" }}>
            {[[MessageCircle,"Chats","chats"],[Circle,"Updates","updates"],[UserPlus,"Contacts","groups"],[Settings,"Settings","settings"]].map(([Icon,label,tab]) => (
                <button key={label} onClick={()=>setSidebarTab(tab)} style={{ background:"none", border:"none", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:4, color:sidebarTab===tab?"#34d399":T.muted, fontSize:10, padding:"6px 12px", borderRadius:10, transition:"all 0.2s" }}
                  onMouseEnter={ev=>{ev.currentTarget.style.color="#34d399";ev.currentTarget.style.background="rgba(52,211,153,0.08)";}}
                  onMouseLeave={ev=>{ev.currentTarget.style.color=sidebarTab===tab?"#34d399":T.muted;ev.currentTarget.style.background="none";}}
                ><Icon size={18}/>{label}</button>
              ))}
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════
            RIGHT PANEL — CHAT
        ════════════════════════════════════════════════════════════════ */}
        <div className="chatpanel" style={{ flex:1, display:"flex", flexDirection:"column", position:"relative", overflow:"hidden", background:T.chat, backdropFilter:"blur(10px)" }}>

          {/* Empty state */}
          {!activeUser && (
            <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:20, padding:40, animation:"fadeIn 0.4s ease" }}>
              <div style={{ width:100, height:100, borderRadius:"50%", background:"linear-gradient(135deg,rgba(5,150,105,0.2),rgba(52,211,153,0.1))", border:`1px solid ${T.borderS}`, display:"flex", alignItems:"center", justifyContent:"center", animation:"glow 3s ease infinite" }}>
                <MessageCircle size={40} color="rgba(52,211,153,0.6)"/>
              </div>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontWeight:800, fontSize:22, color:T.text, marginBottom:8 }}>Select a conversation</div>
                <div style={{ fontSize:14, color:T.muted, maxWidth:280, lineHeight:1.6 }}>Choose someone from the left to start chatting with end-to-end encryption</div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 16px", borderRadius:20, background:T.glass, border:`1px solid ${T.border}` }}>
                <Shield size={13} color="rgba(52,211,153,0.65)"/>
                <span style={{ fontSize:12, color:"rgba(52,211,153,0.65)" }}>All messages encrypted end-to-end</span>
              </div>
            </div>
          )}

          {activeUser && (<>

            {/* Chat header */}
            <div style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 20px", background:T.header, backdropFilter:"blur(20px)", borderBottom:`1px solid ${T.border}`, flexShrink:0, position:"relative", zIndex:5 }}>
              <button onClick={()=>setMobileView("list")} style={{ display:"none", background:"none", border:"none", cursor:"pointer", color:T.sub, marginRight:4 }}><ChevronLeft size={20}/></button>
              <div onClick={()=>setShowProfile(p=>!p)} style={{ display:"flex", alignItems:"center", gap:12, cursor:"pointer", flex:1 }}>
                <Avatar user={activeUser} size={44}/>
                <div>
                  <div style={{ fontWeight:700, fontSize:15, color:T.text }}>{activeUser.name}</div>
                  <div style={{ fontSize:12, display:"flex", alignItems:"center", gap:5 }}>
                    {isTyping
                      ? <span style={{ color:"#34d399", fontStyle:"italic" }}>typing…</span>
                      : <><StatusDot status={activeUser.status} size={7}/><span style={{color:activeUser.status==="online"?"#34d399":T.muted}}>{activeUser.status}</span><span style={{color:T.muted}}>· {activeUser.role}</span></>
                    }
                  </div>
                </div>
              </div>
              <div style={{ display:"flex", gap:4 }}>
                {[
                  [Search,  ()=>setShowMsgSearch(p=>!p), showMsgSearch],
                  [Phone,   ()=>{},                       false],
                  [Video,   ()=>{},                       false],
                  [MoreVertical, ()=>setShowProfile(p=>!p), showProfile],
                ].map(([Icon,fn,active],i) => (
                  <button key={i} onClick={fn} style={{ background:active?"rgba(52,211,153,0.18)":T.glass, border:`1px solid ${active?T.borderS:T.border}`, borderRadius:12, width:38, height:38, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:active?"#34d399":T.sub, transition:"all 0.2s" }}
                    onMouseEnter={ev=>ev.currentTarget.style.background="rgba(52,211,153,0.1)"}
                    onMouseLeave={ev=>ev.currentTarget.style.background=active?"rgba(52,211,153,0.18)":T.glass}
                  ><Icon size={16}/></button>
                ))}
              </div>
            </div>

            {/* Message search bar */}
            {showMsgSearch && (
              <div style={{ padding:"8px 20px", borderBottom:`1px solid ${T.border}`, background:T.header, backdropFilter:"blur(10px)", flexShrink:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, background:T.glass, border:`1px solid ${T.border}`, borderRadius:14, padding:"9px 14px" }}>
                  <Search size={15} color={T.muted}/>
                  <input value={msgSearch} onChange={e=>setMsgSearch(e.target.value)} placeholder="Search in conversation…" style={{ background:"none", border:"none", outline:"none", flex:1, color:T.text, fontSize:13 }}/>
                  {msgSearch && <button onClick={()=>setMsgSearch("")} style={{ background:"none", border:"none", cursor:"pointer", color:T.muted, display:"flex", padding:0 }}><X size={13}/></button>}
                </div>
              </div>
            )}

            {/* Encryption badge */}
            <div style={{ display:"flex", justifyContent:"center", padding:"10px 0 4px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, padding:"5px 14px", borderRadius:20, background:T.glass, border:`1px solid ${T.border}`, backdropFilter:"blur(8px)" }}>
                <Shield size={11} color="rgba(52,211,153,0.55)"/>
                <span style={{ fontSize:11, color:"rgba(52,211,153,0.5)" }}>Messages are encrypted end-to-end</span>
              </div>
            </div>

            {/* Messages */}
            <div ref={chatBodyRef} onScroll={handleScroll} style={{ flex:1, overflowY:"auto", padding:"10px 20px 16px", display:"flex", flexDirection:"column", gap:14 }}>
              {filteredMsgs.length===0 && msgSearch
                ? <div style={{ textAlign:"center", color:T.muted, marginTop:60, fontSize:13 }}>No messages found for "{msgSearch}"</div>
                : filteredMsgs.map(msg => {
                  const isMe = msg.sender === currentUser.id || msg.sender === "me";
                  return (
                    <MessageBubble
                      key={msg.id}
                      msg={msg}
                      user={isMe ? { ...currentUser, name: currentUser.fullName } : getUserById(msg.sender)}
                      isMe={isMe}
                      onReact={handleReact}
                    />
                  );
                })
              }
              {isTyping && (
                <div style={{ display:"flex", alignItems:"flex-end", gap:8 }}>
                  <Avatar user={activeUser} size={30} showStatus={false}/>
                  <div style={{ background:T.glass, border:`1px solid ${T.border}`, borderRadius:"4px 20px 20px 20px", padding:"10px 14px", display:"flex", alignItems:"center", gap:4, backdropFilter:"blur(10px)" }}>
                    {[0,1,2].map(i=><div key={i} style={{ width:7, height:7, borderRadius:"50%", background:"#34d399", animation:`bounce 1.1s ease ${i*0.18}s infinite` }}/>)}
                  </div>
                  <span style={{ fontSize:11, color:T.muted, marginBottom:4 }}>{activeUser.name} is typing…</span>
                </div>
              )}
              <div ref={messagesEndRef}/>
            </div>

            {/* Scroll to bottom */}
            {showScrollBtn && (
              <button onClick={scrollToBottom} style={{ position:"absolute", bottom:90, right:24, background:"linear-gradient(135deg,#059669,#34d399)", border:"none", borderRadius:"50%", width:40, height:40, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 4px 20px rgba(16,185,129,0.4)", color:"#022c22", zIndex:10, animation:"fadeUp 0.2s ease" }}>
                <ArrowDown size={16}/>
              </button>
            )}

            {/* Input area */}
            <div style={{ padding:"12px 20px 16px", flexShrink:0, background:T.input, backdropFilter:"blur(20px)", borderTop:`1px solid ${T.border}` }}>
              {isRecording && (
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10, padding:"8px 14px", background:"rgba(220,38,38,0.1)", border:"1px solid rgba(220,38,38,0.25)", borderRadius:12 }}>
                  <div style={{ width:8, height:8, borderRadius:"50%", background:"#f87171", animation:"recPulse 1s ease infinite", flexShrink:0 }}/>
                  <span style={{ fontSize:13, color:"#f87171", fontWeight:600 }}>Recording… {formatRecordingTime(recordingTime)}</span>
                  <span style={{ fontSize:11, color:"rgba(248,113,113,0.6)", marginLeft:"auto" }}>Release to send</span>
                </div>
              )}
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*,.pdf,.doc,.docx"
                  style={{ display:"none" }}
                  onChange={handleFileSelect}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  style={{ background:T.glass, border:`1px solid ${T.border}`, borderRadius:12, width:40, height:40, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:uploading?"#34d399":T.sub, flexShrink:0, transition:"all 0.2s" }}
                  onMouseEnter={ev=>ev.currentTarget.style.background="rgba(52,211,153,0.1)"}
                  onMouseLeave={ev=>ev.currentTarget.style.background=T.glass}
                >
                  {uploading ? <Loader size={17} style={{animation:"spin 1s linear infinite"}}/> : <Paperclip size={17}/>}
                </button>

                <div style={{ flex:1, display:"flex", alignItems:"center", gap:10, background:T.glass, border:`1px solid ${T.border}`, borderRadius:20, padding:"10px 16px", backdropFilter:"blur(10px)" }}>
                  <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={handleKeyDown}
                    placeholder={`Message ${activeUser.name}…`}
                    style={{ flex:1, background:"none", border:"none", outline:"none", color:T.text, fontSize:14 }}
                  />
                  <div style={{ position:"relative" }}>
                    <button onClick={()=>setShowEmojiPicker(p=>!p)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:18, lineHeight:1, padding:0 }}>😊</button>
                    {showEmojiPicker && (
                      <div style={{ position:"absolute", bottom:"100%", right:0, marginBottom:8, background:dark?"rgba(3,15,10,0.97)":"rgba(240,253,244,0.97)", backdropFilter:"blur(24px)", border:`1px solid ${T.borderS}`, borderRadius:16, padding:"12px 14px", display:"flex", gap:8, zIndex:100, boxShadow:"0 20px 60px rgba(0,0,0,0.5)" }}>
                        {EMOJI_LIST.map(e => (
                          <button key={e} onClick={()=>{setInput(p=>p+e);setShowEmojiPicker(false);inputRef.current?.focus();}} style={{ background:"none", border:"none", cursor:"pointer", fontSize:22, borderRadius:8, padding:"4px 6px", transition:"transform 0.15s" }}
                            onMouseEnter={ev=>ev.currentTarget.style.transform="scale(1.3)"}
                            onMouseLeave={ev=>ev.currentTarget.style.transform="scale(1)"}
                          >{e}</button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {input.trim()
                  ? <button onClick={sendMessage} style={{ width:44, height:44, borderRadius:"50%", border:"none", cursor:"pointer", background:"linear-gradient(135deg,#059669,#34d399)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 4px 20px rgba(16,185,129,0.5)", transition:"transform 0.15s", flexShrink:0 }}
                      onMouseEnter={ev=>ev.currentTarget.style.transform="scale(1.08)"}
                      onMouseLeave={ev=>ev.currentTarget.style.transform="scale(1)"}
                    ><Send size={17} color="#022c22"/></button>
                  : <button
                      onMouseDown={startRecording}
                      onMouseUp={stopRecording}
                      onMouseLeave={stopRecording}
                      onTouchStart={startRecording}
                      onTouchEnd={stopRecording}
                      style={{ width:44, height:44, borderRadius:"50%", border:isRecording?"none":`1px solid ${T.border}`, cursor:"pointer", background:isRecording?"linear-gradient(135deg,#dc2626,#f87171)":T.glass, display:"flex", alignItems:"center", justifyContent:"center", color:isRecording?"#fff":T.sub, boxShadow:isRecording?"0 4px 20px rgba(220,38,38,0.45)":"none", animation:isRecording?"recPulse 1s ease infinite":"none", transition:"background 0.2s", flexShrink:0, userSelect:"none" }}
                    >
                      {uploading ? <Loader size={17} style={{animation:"spin 1s linear infinite"}}/> : <Mic size={17}/>}
                    </button>
                }
              </div>
              {uploadError && (
                <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:6, padding:"6px 12px", background:"rgba(220,38,38,0.1)", border:"1px solid rgba(220,38,38,0.2)", borderRadius:10 }}>
                  <AlertTriangle size={12} color="#f87171"/>
                  <span style={{ fontSize:11, color:"#f87171" }}>{uploadError}</span>
                </div>
              )}
              <div style={{ textAlign:"center", marginTop:8, fontSize:10, color:"rgba(52,211,153,0.25)", display:"flex", justifyContent:"center", alignItems:"center", gap:4 }}>
                <Shield size={9}/><span>End-to-end encrypted · G-Talk</span>
              </div>

            </div>

            {/* Profile panel overlay */}
            {showProfile && <ProfilePanel user={activeUser} onClose={()=>setShowProfile(false)} dark={dark}/>}

          </>)}
        </div>
      </div>
      {lightbox && <Lightbox url={lightbox.url} name={lightbox.name} onClose={() => setLightbox(null)}/>}

      {showStatusComposer && (
        <StatusComposer
          currentUser={currentUser}
          T={T}
          onClose={() => setShowStatusComposer(false)}
          onPost={(newStatus) => {
            setStatuses(prev => {
              const existing = prev.findIndex(s => s.user.id === currentUser.id);
              if (existing >= 0) {
                const updated = [...prev];
                updated[existing] = { ...updated[existing], statuses: [...updated[existing].statuses, newStatus], all_seen: false };
                return updated;
              }
              return [...prev, { user: { ...currentUser, name: currentUser.fullName }, statuses: [newStatus], all_seen: false }];
            });
          }}
        />
      )}

      {showStatusViewer !== null && statuses[showStatusViewer] && (
        <StatusViewer
          statusData={statuses[showStatusViewer]}
          currentUser={currentUser}
          onClose={() => setShowStatusViewer(null)}
          onNext={() => {
            if (showStatusViewer < statuses.length - 1) setShowStatusViewer(i => i + 1);
            else setShowStatusViewer(null);
          }}
          onPrev={() => {
            if (showStatusViewer > 0) setShowStatusViewer(i => i - 1);
          }}
          hasNext={showStatusViewer < statuses.length - 1}
          hasPrev={showStatusViewer > 0}
        />
      )}
    </>
  );
}