import { useState, useEffect, useRef } from "react";
import {
  Search, Send, Mic, Paperclip, Phone, Video,
  MoreVertical, Moon, Sun, Check, CheckCheck,
  ChevronLeft, X, Bell, BellOff, Archive, Edit3,
  Zap, Shield, MessageCircle, Play, Pause,
  ArrowDown, Users, Hash, Settings, Plus, ImageIcon,
  Loader, AlertTriangle
} from "lucide-react";

// ── API Base ──────────────────────────────────────────────────────────────────
const API = "http://localhost:8000";

// ── Fetch users from backend (encrypted → decrypted) ─────────────────────────
// Step 1: GET /api/users  → [{id:"u1", enc:"gAAA...gibberish"}, ...]
// Step 2: GET /api/decrypt/u1 → {id:"u1", name:"Aiko Tanaka", role:..., ...}
// MOCK_USERS is completely removed. Backend is the only source of truth.
async function fetchAllUsers() {
  const res  = await fetch(`${API}/api/users`, { headers: { "Content-Type": "application/json" } });
  const data = await res.json();
  const decrypted = await Promise.all(
    data.users.map(({ id }) =>
      fetch(`${API}/api/decrypt/${id}`, { headers: { "Content-Type": "application/json" } }).then(r => r.json())
    )
  );
  return decrypted.map(u => ({ ...u, unread: 0 }));
}

async function apiFetch(path, opts = {}) {
  try {
    const r = await fetch(`${API}${path}`, { headers: { "Content-Type": "application/json" }, ...opts });
    return r.json();
  } catch { return null; }
}

function openWS(userId, handlers) {
  const ws = new WebSocket(`ws://localhost:8000/ws/${userId}`);
  ws.onmessage = ({ data }) => {
    const e = JSON.parse(data);
    if (e.event === "new_message")  handlers.onMsg?.(e);
    if (e.event === "typing")       handlers.onTyping?.(e);
    if (e.event === "user_offline") handlers.onOffline?.(e);
  };
  ws.onerror = () => console.warn("[G-Chart WS] connection error");
  return ws;
}

function wsSend(ws, payload) {
  if (ws?.readyState === 1) ws.send(JSON.stringify(payload));
}

// ── Seed messages (shown while backend messages load) ─────────────────────────
const SEED_MESSAGES = {
  u1:  [{ id:"s1",  sender:"u1",  text:"Hey! Just finished the new mockups 🎨",      time:"10:02", reactions:{},          status:"seen",      type:"text" },
        { id:"s2",  sender:"me",  text:"They look incredible!",                        time:"10:05", reactions:{"❤️":true}, status:"seen",      type:"text" },
        { id:"s3",  sender:"u1",  text:"Thanks! Ready for review whenever you are 😊", time:"10:06", reactions:{},          status:"seen",      type:"text" }],
  u2:  [{ id:"s4",  sender:"me",  text:"Did the CI pipeline pass?",                    time:"09:45", reactions:{},          status:"seen",      type:"text" },
        { id:"s5",  sender:"u2",  text:"Yes! All 247 tests green 🟢",                  time:"09:47", reactions:{"🔥":true}, status:"seen",      type:"text" },
        { id:"s6",  sender:"u2",  text:"Deploying to staging now",                     time:"09:48", reactions:{},          status:"delivered", type:"text" }],
  u4:  [{ id:"s7",  sender:"u4",  text:"Check this anomaly in the dataset 📊",         time:"Yesterday", reactions:{},          status:"seen", type:"text" },
        { id:"s8",  sender:"me",  text:"Interesting spike around 3PM",                 time:"Yesterday", reactions:{},          status:"seen", type:"text" },
        { id:"s9",  sender:"u4",  text:"Exactly — timezone bug 🐛",                    time:"Yesterday", reactions:{"😮":true}, status:"seen", type:"text" }],
  u6:  [{ id:"s10", sender:"u6",  text:"Infra replicated across 3 zones ✅",           time:"08:30", reactions:{},          status:"seen", type:"text" },
        { id:"s11", sender:"me",  text:"Zero downtime confirmed?",                      time:"08:32", reactions:{},          status:"seen", type:"text" },
        { id:"s12", sender:"u6",  text:"Zero. 99.99% uptime this quarter 🚀",          time:"08:33", reactions:{"💯":true}, status:"seen", type:"text" }],
  u8:  [{ id:"s13", sender:"me",  text:"New endpoint is live!",                         time:"11:00", reactions:{}, status:"seen",      type:"text" },
        { id:"s14", sender:"u8",  text:"Rate limiting in place?",                       time:"11:02", reactions:{}, status:"seen",      type:"text" },
        { id:"s15", sender:"me",  text:"Yes — 1000 req/min per user 🔒",              time:"11:03", reactions:{}, status:"delivered", type:"text" }],
  u12: [{ id:"s16", sender:"u12", text:"System design doc ready for review 📄",        time:"Mon", reactions:{},          status:"seen", type:"text" },
        { id:"s17", sender:"me",  text:"Brilliant architecture, love it!",              time:"Mon", reactions:{"🎉":true}, status:"seen", type:"text" }],
};

const EMOJI_LIST   = ["❤️","😂","😮","😢","👍","🔥","🎉","💯","✅","🌿"];
const AUTO_REPLIES = ["Got it! 👍","Sounds good to me!","Interesting…","Let me check on that","On it! 🚀","Perfect, thanks!","Will do ✅","Makes sense!","Noted 📝"];

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
function VoiceNote({ duration = "0:23" }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const bars = useRef(Array.from({ length:28 }, (_,i) => 18 + Math.sin(i*0.85)*14 + (i%3)*6)).current;
  useEffect(() => {
    if (!playing) return;
    const iv = setInterval(() => setProgress(p => { if (p>=100){setPlaying(false);return 0;} return p+1.8; }), 80);
    return () => clearInterval(iv);
  }, [playing]);
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:190 }}>
      <button onClick={()=>setPlaying(p=>!p)} style={{ width:34,height:34,borderRadius:"50%",border:"none",flexShrink:0,background:"rgba(52,211,153,0.18)",color:"#34d399",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer" }}>
        {playing ? <Pause size={13}/> : <Play size={13}/>}
      </button>
      <div style={{ display:"flex", alignItems:"center", gap:2, flex:1 }}>
        {bars.map((h,i) => (
          <div key={i} style={{ width:3, borderRadius:2, height:Math.max(4,(h/55)*28), background: i/bars.length < progress/100 ? "linear-gradient(to top,#059669,#34d399)" : "rgba(52,211,153,0.18)", transition:"background 0.1s" }} />
        ))}
      </div>
      <span style={{ fontSize:11, color:"rgba(167,243,208,0.4)", flexShrink:0 }}>{duration}</span>
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
          {msg.type === "voice" ? <VoiceNote duration={msg.duration}/> : <span>{msg.text}</span>}
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

// ══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════════════════════════
export default function GChart() {

  const [dark, setDark]                   = useState(true);
  // users come from backend fetch — NO hardcoded MOCK_USERS
  const [users, setUsers]                 = useState([]);
  const [loadingUsers, setLoadingUsers]   = useState(true);
  const [usersError, setUsersError]       = useState(null);
  const [messages, setMessages]           = useState({ ...SEED_MESSAGES });
  const [activeUser, setActiveUser]       = useState(null);
  const [input, setInput]                 = useState("");
  const [search, setSearch]               = useState("");
  const [msgSearch, setMsgSearch]         = useState("");
  const [showMsgSearch, setShowMsgSearch] = useState(false);
  const [isTyping, setIsTyping]           = useState(false);
  const [showProfile, setShowProfile]     = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording]     = useState(false);
  const [mobileView, setMobileView]       = useState("list");
  const [filter, setFilter]               = useState("all");
  const [sidebarTab, setSidebarTab]       = useState("chats");
  const [notifications, setNotifications] = useState(true);

  const messagesEndRef = useRef(null);
  const chatBodyRef    = useRef(null);
  const inputRef       = useRef(null);
  const typingTimer    = useRef(null);
  const wsRef          = useRef(null);

  // ── FETCH USERS FROM BACKEND ON MOUNT ─────────────────────────────────────
  // This replaces MOCK_USERS entirely.
  // Network tab will show: GET /api/users → [{id, enc}...]  (encrypted)
  // Then: GET /api/decrypt/u1 → real user data per user
  useEffect(() => {
    (async () => {
      try {
        setLoadingUsers(true);
        setUsersError(null);
        const fetched = await fetchAllUsers();
        setUsers(fetched);
      } catch (err) {
        setUsersError("Cannot connect to backend. Is FastAPI running on port 8000?");
      } finally {
        setLoadingUsers(false);
      }
    })();
  }, []);

  // ── WEBSOCKET for real-time events ────────────────────────────────────────
  useEffect(() => {
    wsRef.current = openWS("me", {
      onMsg: ({ message, from }) => {
        setMessages(p => ({ ...p, [from]: [...(p[from]||[]), message] }));
        setUsers(p => p.map(u => u.id===from ? {...u, unread:(u.unread||0)+1} : u));
      },
      onTyping: ({ from, isTyping: t }) => {
        setActiveUser(curr => { if (curr?.id===from) setIsTyping(t); return curr; });
      },
      onOffline: ({ user_id }) => {
        setUsers(p => p.map(u => u.id===user_id ? {...u, status:"offline"} : u));
      },
    });
    return () => wsRef.current?.close();
  }, []);

  // ── Derived state ─────────────────────────────────────────────────────────
  const filteredUsers = users.filter(u => {
    const m = u.name.toLowerCase().includes(search.toLowerCase()) || u.role?.toLowerCase().includes(search.toLowerCase());
    if (filter==="online") return m && u.status==="online";
    if (filter==="unread") return m && u.unread>0;
    return m;
  });

  const currentMsgs  = activeUser ? (messages[activeUser.id]||[]) : [];
  const filteredMsgs = msgSearch ? currentMsgs.filter(m=>m.text?.toLowerCase().includes(msgSearch.toLowerCase())) : currentMsgs;
  const getUserById  = id => users.find(u=>u.id===id) || { name:"You", avatar:"YO", color:"#34d399", status:"online", id:"me" };
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
    if (!messages[u.id]) {
      try {
        const { messages: enc } = await apiFetch(`/api/messages/${u.id}`);
        if (enc?.length) {
          const { messages: dec } = await apiFetch(`/api/messages/${u.id}/decrypt`, { method:"POST", body:JSON.stringify({ messages:enc }) });
          if (dec?.length) setMessages(p => ({...p, [u.id]: dec}));
        }
      } catch { /* fall back to seed */ }
    }
  };

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!input.trim() || !activeUser) return;
    const msg = { id:`opt_${Date.now()}`, sender:"me", text:input.trim(), time:new Date().toLocaleTimeString("en",{hour:"2-digit",minute:"2-digit"}), reactions:{}, status:"sent", type:"text" };
    setMessages(p => ({...p, [activeUser.id]:[...(p[activeUser.id]||[]),msg]}));
    setInput("");
    apiFetch(`/api/send/${activeUser.id}`, { method:"POST", body:JSON.stringify({text:msg.text, type:"text"}) });
    setTimeout(() => setIsTyping(true), 800);
    setTimeout(() => {
      setIsTyping(false);
      const reply = { id:`rep_${Date.now()}`, sender:activeUser.id, text:AUTO_REPLIES[Math.floor(Math.random()*AUTO_REPLIES.length)], time:new Date().toLocaleTimeString("en",{hour:"2-digit",minute:"2-digit"}), reactions:{}, status:"delivered", type:"text" };
      setMessages(p => ({...p, [activeUser.id]:[...(p[activeUser.id]||[]),reply]}));
    }, 3500);
  };

  const sendVoiceNote = () => {
    if (!activeUser) return;
    setIsRecording(false);
    const durations = ["0:07","0:12","0:23","0:45","1:02"];
    const msg = { id:`v_${Date.now()}`, sender:"me", text:"", time:new Date().toLocaleTimeString("en",{hour:"2-digit",minute:"2-digit"}), reactions:{}, status:"sent", type:"voice", duration:durations[Math.floor(Math.random()*5)] };
    setMessages(p => ({...p, [activeUser.id]:[...(p[activeUser.id]||[]),msg]}));
  };

  const handleReact = async (msgId, emoji) => {
    setMessages(p => ({...p, [activeUser.id]:(p[activeUser.id]||[]).map(m => {
      if (m.id!==msgId) return m;
      const r = {...m.reactions};
      if (r[emoji]) delete r[emoji]; else r[emoji]=true;
      return {...m, reactions:r};
    })}));
    apiFetch(`/api/react/${msgId}`, { method:"POST", body:JSON.stringify({emoji, other_id:activeUser.id}) });
  };

  const handleKeyDown = (e) => {
    if (e.key==="Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    wsSend(wsRef.current, {event:"typing", to:activeUser?.id, isTyping:true});
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => wsSend(wsRef.current, {event:"typing", to:activeUser?.id, isTyping:false}), 1500);
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
              <div style={{ width:36, height:36, borderRadius:"50%", background:"linear-gradient(135deg,rgba(5,150,105,0.5),rgba(52,211,153,0.25))", border:"2px solid rgba(52,211,153,0.4)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:12, color:"#34d399" }}>YO</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, color:T.text }}>You</div>
                <div style={{ fontSize:11, color:"#34d399", display:"flex", alignItems:"center", gap:4 }}><StatusDot status="online" size={7}/> Active now</div>
              </div>
              <button style={{ background:"none", border:"none", cursor:"pointer", color:T.muted, display:"flex", padding:0 }}><Edit3 size={14}/></button>
            </div>

            {/* Tabs */}
            <div style={{ display:"flex", gap:4, marginBottom:14, background:T.glass, borderRadius:12, padding:4 }}>
              {["chats","groups"].map(tab => (
                <button key={tab} onClick={()=>setSidebarTab(tab)} style={{ flex:1, padding:"7px 0", borderRadius:9, border:"none", cursor:"pointer", background:sidebarTab===tab?"rgba(52,211,153,0.18)":"transparent", color:sidebarTab===tab?"#34d399":T.muted, fontSize:13, fontWeight:500, transition:"all 0.2s" }}>
                  {tab[0].toUpperCase()+tab.slice(1)}
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

            {/* Groups tab */}
            {sidebarTab==="groups" && (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", marginTop:60, gap:12 }}>
                <div style={{ width:56, height:56, borderRadius:"50%", background:T.glass, border:`1px solid ${T.border}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <Hash size={22} color="rgba(52,211,153,0.5)"/>
                </div>
                <div style={{ color:T.muted, fontSize:13 }}>Groups coming soon</div>
                <button style={{ background:"linear-gradient(135deg,#059669,#34d399)", border:"none", borderRadius:12, padding:"8px 18px", color:"#022c22", fontSize:12, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}><Plus size={14}/> Create Group</button>
              </div>
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
            {[[MessageCircle,"Chats"],[Users,"Contacts"],[Settings,"Settings"]].map(([Icon,label]) => (
              <button key={label} style={{ background:"none", border:"none", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:4, color:T.muted, fontSize:10, padding:"6px 12px", borderRadius:10, transition:"all 0.2s" }}
                onMouseEnter={ev=>{ev.currentTarget.style.color="#34d399";ev.currentTarget.style.background="rgba(52,211,153,0.08)";}}
                onMouseLeave={ev=>{ev.currentTarget.style.color=T.muted;ev.currentTarget.style.background="none";}}
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
                : filteredMsgs.map(msg => (
                    <MessageBubble key={msg.id} msg={msg} user={getUserById(msg.sender)} isMe={msg.sender==="me"} onReact={handleReact}/>
                  ))
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
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <button style={{ background:T.glass, border:`1px solid ${T.border}`, borderRadius:12, width:40, height:40, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:T.sub, flexShrink:0, transition:"all 0.2s" }}
                  onMouseEnter={ev=>ev.currentTarget.style.background="rgba(52,211,153,0.1)"}
                  onMouseLeave={ev=>ev.currentTarget.style.background=T.glass}
                ><Paperclip size={17}/></button>
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
                      onMouseDown={()=>setIsRecording(true)}
                      onMouseUp={()=>{if(isRecording)sendVoiceNote();}}
                      onMouseLeave={()=>setIsRecording(false)}
                      style={{ width:44, height:44, borderRadius:"50%", border:isRecording?"none":`1px solid ${T.border}`, cursor:"pointer", background:isRecording?"linear-gradient(135deg,#dc2626,#f87171)":T.glass, display:"flex", alignItems:"center", justifyContent:"center", color:isRecording?"#fff":T.sub, boxShadow:isRecording?"0 4px 20px rgba(220,38,38,0.45)":"none", animation:isRecording?"recPulse 1s ease infinite":"none", transition:"background 0.2s", flexShrink:0 }}
                    ><Mic size={17}/></button>
                }
              </div>
              <div style={{ textAlign:"center", marginTop:8, fontSize:10, color:"rgba(52,211,153,0.25)", display:"flex", justifyContent:"center", alignItems:"center", gap:4 }}>
                <Shield size={9}/><span>End-to-end encrypted · G-Chart</span>
              </div>
            </div>

            {/* Profile panel overlay */}
            {showProfile && <ProfilePanel user={activeUser} onClose={()=>setShowProfile(false)} dark={dark}/>}

          </>)}
        </div>
      </div>
    </>
  );
}