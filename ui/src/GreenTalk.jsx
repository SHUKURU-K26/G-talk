import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search, Send, Mic, Smile, Paperclip, Phone, Video,
  MoreVertical, Moon, Sun, Check, CheckCheck, Circle,
  ChevronLeft, X, Star, Bell, BellOff, Archive, Trash2,
  Pin, Edit3, Zap, Shield, Volume2, VolumeX, MessageCircle,
  Play, Pause, Clock, ArrowDown, Users, Hash, Settings,
  LogOut, ChevronDown, Filter, Plus, ImageIcon, FileText
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────
const API = "http://localhost:8000";

async function apiFetch(path, opts = {}) {
  try {
    const r = await fetch(`${API}${path}`, { headers: { "Content-Type": "application/json" }, ...opts });
    return r.json();
  } catch { return null; }
}

function timeAgo(ts) {
  return ts || "now";
}

const EMOJI_LIST = ["❤️", "😂", "😮", "😢", "👍", "🔥", "🎉", "💯"];

const MOCK_USERS = [
  { id: "u1",  name: "Aiko Tanaka",    avatar: "AT", status: "online",  role: "Designer",        color: "#6EE7B7", bio: "Crafting pixels & dreams",    lastSeen: "now",     unread: 2 },
  { id: "u2",  name: "Marcus Rivera",  avatar: "MR", status: "online",  role: "Engineer",        color: "#93C5FD", bio: "Code is my poetry",           lastSeen: "now",     unread: 1 },
  { id: "u3",  name: "Zara Okonkwo",   avatar: "ZO", status: "away",    role: "Product Manager", color: "#FCA5A5", bio: "Building the future",          lastSeen: "5m ago",  unread: 0 },
  { id: "u4",  name: "Liam Chen",      avatar: "LC", status: "online",  role: "Data Scientist",  color: "#C4B5FD", bio: "Turning data into stories",    lastSeen: "now",     unread: 3 },
  { id: "u5",  name: "Sofia Petrov",   avatar: "SP", status: "offline", role: "Marketing",       color: "#FDE68A", bio: "Words that move people",       lastSeen: "2h ago",  unread: 0 },
  { id: "u6",  name: "Darius Webb",    avatar: "DW", status: "online",  role: "DevOps",          color: "#6EE7F7", bio: "Deploying dreams daily",       lastSeen: "now",     unread: 0 },
  { id: "u7",  name: "Nia Adeyemi",    avatar: "NA", status: "away",    role: "QA Engineer",     color: "#F9A8D4", bio: "Breaking things perfectly",    lastSeen: "12m ago", unread: 0 },
  { id: "u8",  name: "Ethan Kowalski", avatar: "EK", status: "online",  role: "Backend Dev",     color: "#86EFAC", bio: "APIs are my canvas",           lastSeen: "now",     unread: 1 },
  { id: "u9",  name: "Priya Sharma",   avatar: "PS", status: "offline", role: "UX Researcher",   color: "#FBB6CE", bio: "Understanding humans",         lastSeen: "1d ago",  unread: 0 },
  { id: "u10", name: "Kai Nakamura",   avatar: "KN", status: "online",  role: "Frontend Dev",    color: "#A5F3FC", bio: "CSS sorcerer",                 lastSeen: "now",     unread: 0 },
  { id: "u11", name: "Amara Diallo",   avatar: "AD", status: "away",    role: "Security",        color: "#DDD6FE", bio: "Keeping secrets safe",         lastSeen: "30m ago", unread: 0 },
  { id: "u12", name: "Noah Fitzgerald",avatar: "NF", status: "online",  role: "Architect",       color: "#FED7AA", bio: "Designing at scale",           lastSeen: "now",     unread: 2 },
  { id: "u13", name: "Yuki Shimizu",   avatar: "YS", status: "offline", role: "ML Engineer",     color: "#BAE6FD", bio: "Teaching machines to think",   lastSeen: "3h ago",  unread: 0 },
];

const SEED_MESSAGES = {
  u1:  [{ id: "m1", sender: "u1",  text: "Hey! Just finished the new mockups 🎨", time: "10:02", reactions: {}, status: "seen", type: "text" }, { id: "m2", sender: "me",  text: "They look incredible, Aiko!", time: "10:05", reactions: { "❤️": true }, status: "seen", type: "text" }, { id: "m3", sender: "u1",  text: "Thanks! Ready for review whenever you are 😊", time: "10:06", reactions: {}, status: "seen", type: "text" }],
  u2:  [{ id: "m4", sender: "me",  text: "Did the CI pipeline pass?", time: "09:45", reactions: {}, status: "seen", type: "text" }, { id: "m5", sender: "u2",  text: "Yes! All 247 tests green 🟢", time: "09:47", reactions: { "🔥": true }, status: "seen", type: "text" }, { id: "m6", sender: "u2",  text: "Deploying to staging now", time: "09:48", reactions: {}, status: "delivered", type: "text" }],
  u4:  [{ id: "m7", sender: "u4",  text: "Check out this anomaly in the dataset 📊", time: "Yesterday", reactions: {}, status: "seen", type: "text" }, { id: "m8", sender: "me",  text: "Interesting spike around 3PM", time: "Yesterday", reactions: {}, status: "seen", type: "text" }, { id: "m9", sender: "u4",  text: "Exactly — looks like a timezone bug 🐛", time: "Yesterday", reactions: { "😮": true }, status: "seen", type: "text" }],
  u6:  [{ id: "m10", sender: "u6", text: "Infra fully replicated across 3 availability zones ✅", time: "08:30", reactions: {}, status: "seen", type: "text" }, { id: "m11", sender: "me", text: "Zero downtime confirmed?", time: "08:32", reactions: {}, status: "seen", type: "text" }, { id: "m12", sender: "u6", text: "Zero. 99.99% uptime this quarter 🚀", time: "08:33", reactions: { "💯": true }, status: "seen", type: "text" }],
  u8:  [{ id: "m13", sender: "me", text: "The new endpoint is live!", time: "11:00", reactions: {}, status: "seen", type: "text" }, { id: "m14", sender: "u8", text: "Rate limiting in place?", time: "11:02", reactions: {}, status: "seen", type: "text" }, { id: "m15", sender: "me", text: "Yes — 1000 req/min per user 🔒", time: "11:03", reactions: {}, status: "delivered", type: "text" }],
  u12: [{ id: "m16", sender: "u12", text: "System design doc is ready for review 📄", time: "Mon", reactions: {}, status: "seen", type: "text" }, { id: "m17", sender: "me",  text: "Reading it now — brilliant architecture!", time: "Mon", reactions: { "🎉": true }, status: "seen", type: "text" }],
};

// ── StatusDot ─────────────────────────────────────────────────────────────────
function StatusDot({ status, size = 10 }) {
  const colors = { online: "#4ade80", away: "#fbbf24", offline: "#6b7280" };
  return (
    <span style={{
      display: "inline-block", width: size, height: size, borderRadius: "50%",
      background: colors[status] || "#6b7280",
      boxShadow: status === "online" ? `0 0 6px ${colors.online}` : "none",
      flexShrink: 0
    }} />
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ user, size = 44, showStatus = true }) {
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <div style={{
        width: size, height: size, borderRadius: "50%",
        background: `linear-gradient(135deg, ${user.color}55, ${user.color}22)`,
        border: `2px solid ${user.color}44`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.32, fontWeight: 700, color: user.color,
        fontFamily: "'Sora', sans-serif", letterSpacing: "0.5px",
        backdropFilter: "blur(8px)",
      }}>
        {user.avatar}
      </div>
      {showStatus && (
        <div style={{ position: "absolute", bottom: 1, right: 1, background: "var(--bg-deep)", borderRadius: "50%", padding: 2 }}>
          <StatusDot status={user.status} size={9} />
        </div>
      )}
    </div>
  );
}

// ── VoiceNoteUI ───────────────────────────────────────────────────────────────
function VoiceNote({ duration = "0:23" }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const bars = Array.from({ length: 28 }, (_, i) => 20 + Math.sin(i * 0.8) * 15 + Math.random() * 20);

  useEffect(() => {
    if (playing) {
      const iv = setInterval(() => setProgress(p => { if (p >= 100) { setPlaying(false); return 0; } return p + 2; }), 80);
      return () => clearInterval(iv);
    }
  }, [playing]);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 180 }}>
      <button onClick={() => setPlaying(!playing)} style={{
        width: 34, height: 34, borderRadius: "50%", border: "none",
        background: "rgba(129,140,248,0.3)", color: "#a5b4fc",
        display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
        flexShrink: 0
      }}>
        {playing ? <Pause size={14} /> : <Play size={14} />}
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: 2, flex: 1 }}>
        {bars.map((h, i) => (
          <div key={i} style={{
            width: 3, height: Math.max(4, (h / 55) * 28), borderRadius: 2,
            background: i / bars.length < progress / 100 ? "#818cf8" : "rgba(255,255,255,0.2)",
            transition: "background 0.1s"
          }} />
        ))}
      </div>
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", flexShrink: 0 }}>{duration}</span>
    </div>
  );
}

// ── EmojiPicker ───────────────────────────────────────────────────────────────
function EmojiPicker({ onSelect, onClose }) {
  return (
    <div style={{
      position: "absolute", bottom: "100%", right: 0, marginBottom: 8,
      background: "rgba(15,15,35,0.95)", backdropFilter: "blur(20px)",
      border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16,
      padding: "10px 12px", display: "flex", gap: 6, zIndex: 100,
      boxShadow: "0 20px 60px rgba(0,0,0,0.5)"
    }}>
      {EMOJI_LIST.map(e => (
        <button key={e} onClick={() => { onSelect(e); onClose(); }} style={{
          background: "none", border: "none", cursor: "pointer",
          fontSize: 20, borderRadius: 8, padding: "4px 6px",
          transition: "transform 0.15s",
        }}
          onMouseEnter={ev => ev.target.style.transform = "scale(1.3)"}
          onMouseLeave={ev => ev.target.style.transform = "scale(1)"}
        >{e}</button>
      ))}
    </div>
  );
}

// ── MessageBubble ─────────────────────────────────────────────────────────────
function MessageBubble({ msg, user, onReact, isMe }) {
  const [hovered, setHovered] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);

  const bubbleStyle = isMe ? {
    background: "linear-gradient(135deg, rgba(99,102,241,0.6), rgba(129,140,248,0.4))",
    border: "1px solid rgba(129,140,248,0.3)",
    borderRadius: "20px 4px 20px 20px",
    marginLeft: "auto",
  } : {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "4px 20px 20px 20px",
    marginRight: "auto",
  };

  const reactions = Object.keys(msg.reactions || {});

  return (
    <div style={{
      display: "flex", flexDirection: isMe ? "row-reverse" : "row",
      alignItems: "flex-end", gap: 8, maxWidth: "72%",
      marginLeft: isMe ? "auto" : 0,
      animation: "fadeUp 0.25s ease",
      position: "relative",
    }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setShowEmoji(false); }}
    >
      {!isMe && <Avatar user={user} size={30} showStatus={false} />}

      <div style={{ position: "relative" }}>
        <div style={{
          ...bubbleStyle,
          backdropFilter: "blur(12px)",
          padding: msg.type === "voice" ? "10px 14px" : "10px 14px",
          fontSize: 14, lineHeight: 1.5, color: "rgba(255,255,255,0.9)",
          boxShadow: isMe ? "0 4px 20px rgba(99,102,241,0.2)" : "0 4px 20px rgba(0,0,0,0.2)"
        }}>
          {msg.type === "voice" ? <VoiceNote /> : <span>{msg.text}</span>}

          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4, justifyContent: isMe ? "flex-end" : "flex-start" }}>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{msg.time}</span>
            {isMe && (
              msg.status === "seen" ? <CheckCheck size={12} color="#818cf8" /> :
              msg.status === "delivered" ? <CheckCheck size={12} color="rgba(255,255,255,0.35)" /> :
              <Check size={12} color="rgba(255,255,255,0.25)" />
            )}
          </div>
        </div>

        {reactions.length > 0 && (
          <div style={{
            position: "absolute", bottom: -12, right: isMe ? 8 : "auto", left: isMe ? "auto" : 8,
            display: "flex", gap: 2, background: "rgba(15,15,35,0.8)",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: "2px 6px",
            backdropFilter: "blur(8px)", zIndex: 1
          }}>
            {reactions.map(e => <span key={e} style={{ fontSize: 12 }}>{e}</span>)}
          </div>
        )}

        {hovered && (
          <div style={{
            position: "absolute", top: "50%", transform: "translateY(-50%)",
            [isMe ? "left" : "right"]: "100%",
            [isMe ? "paddingRight" : "paddingLeft"]: 8,
            display: "flex", gap: 4, alignItems: "center",
          }}>
            <div style={{ position: "relative" }}>
              <button onClick={() => setShowEmoji(!showEmoji)} style={{
                background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 10, padding: "4px 8px", cursor: "pointer", color: "rgba(255,255,255,0.6)",
                display: "flex", alignItems: "center", fontSize: 14, backdropFilter: "blur(8px)"
              }}>😊</button>
              {showEmoji && <EmojiPicker onSelect={(e) => onReact(msg.id, e)} onClose={() => setShowEmoji(false)} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── UserCard (left panel) ─────────────────────────────────────────────────────
function UserCard({ user, active, onClick, lastMsg }) {
  return (
    <div onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
      borderRadius: 16, cursor: "pointer", position: "relative",
      background: active ? "rgba(129,140,248,0.15)" : "transparent",
      border: active ? "1px solid rgba(129,140,248,0.25)" : "1px solid transparent",
      transition: "all 0.2s", backdropFilter: active ? "blur(8px)" : "none",
      marginBottom: 2,
    }}
      onMouseEnter={ev => { if (!active) { ev.currentTarget.style.background = "rgba(255,255,255,0.04)"; ev.currentTarget.style.border = "1px solid rgba(255,255,255,0.06)"; }}}
      onMouseLeave={ev => { if (!active) { ev.currentTarget.style.background = "transparent"; ev.currentTarget.style.border = "1px solid transparent"; }}}
    >
      <Avatar user={user} size={48} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: "rgba(255,255,255,0.9)", fontFamily: "'Sora',sans-serif" }}>
            {user.name}
          </span>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{user.lastSeen}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 140 }}>
            {lastMsg || user.bio}
          </span>
          {user.unread > 0 && (
            <div style={{
              background: "linear-gradient(135deg, #6366f1, #818cf8)",
              color: "#fff", borderRadius: 20, minWidth: 20, height: 20,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 700, padding: "0 6px", flexShrink: 0
            }}>{user.unread}</div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
          <StatusDot status={user.status} size={7} />
          <span style={{ fontSize: 10, color: user.status === "online" ? "#4ade80" : "rgba(255,255,255,0.3)" }}>
            {user.status}
          </span>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginLeft: 4 }}>• {user.role}</span>
        </div>
      </div>
    </div>
  );
}

// ── SearchBar ─────────────────────────────────────────────────────────────────
function SearchBar({ value, onChange, placeholder = "Search…" }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 14, padding: "9px 14px", backdropFilter: "blur(8px)",
    }}>
      <Search size={15} color="rgba(255,255,255,0.3)" />
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{
        background: "none", border: "none", outline: "none", flex: 1,
        color: "rgba(255,255,255,0.8)", fontSize: 13, fontFamily: "'DM Sans',sans-serif",
      }} />
      {value && <button onClick={() => onChange("")} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", display: "flex" }}><X size={13} /></button>}
    </div>
  );
}

// ── TypingIndicator ───────────────────────────────────────────────────────────
function TypingIndicator({ user }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, padding: "0 0 4px" }}>
      <Avatar user={user} size={30} showStatus={false} />
      <div style={{
        background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "4px 20px 20px 20px", padding: "10px 14px",
        display: "flex", alignItems: "center", gap: 4
      }}>
        {[0,1,2].map(i => (
          <div key={i} style={{
            width: 7, height: 7, borderRadius: "50%",
            background: "rgba(129,140,248,0.6)",
            animation: `typingBounce 1s ease ${i * 0.18}s infinite`
          }} />
        ))}
      </div>
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 4 }}>{user.name} is typing…</span>
    </div>
  );
}

// ── ProfilePanel ──────────────────────────────────────────────────────────────
function ProfilePanel({ user, onClose }) {
  return (
    <div style={{
      position: "absolute", right: 0, top: 0, bottom: 0, width: 300,
      background: "rgba(10,10,28,0.92)", backdropFilter: "blur(30px)",
      borderLeft: "1px solid rgba(255,255,255,0.06)", zIndex: 20,
      display: "flex", flexDirection: "column", padding: 24,
      animation: "slideLeft 0.25s ease",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <span style={{ fontWeight: 700, fontFamily: "'Sora',sans-serif", color: "rgba(255,255,255,0.9)" }}>Profile</span>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", display: "flex" }}><X size={18} /></button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <Avatar user={user} size={80} />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 18, fontFamily: "'Sora',sans-serif", color: "rgba(255,255,255,0.95)" }}>{user.name}</div>
          <div style={{ fontSize: 12, color: user.color, marginTop: 2 }}>{user.role}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>{user.bio}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <StatusDot status={user.status} size={9} />
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{user.status} · Last seen {user.lastSeen}</span>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[{ icon: Phone, label: "Call" }, { icon: Video, label: "Video" }, { icon: Bell, label: "Mute" }, { icon: Archive, label: "Archive" }].map(({ icon: Icon, label }) => (
          <button key={label} style={{
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 14, padding: "12px 8px", cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
            color: "rgba(255,255,255,0.6)", fontSize: 12, fontFamily: "'DM Sans',sans-serif",
            transition: "all 0.2s",
          }}
            onMouseEnter={ev => ev.currentTarget.style.background = "rgba(129,140,248,0.1)"}
            onMouseLeave={ev => ev.currentTarget.style.background = "rgba(255,255,255,0.04)"}
          >
            <Icon size={18} /> {label}
          </button>
        ))}
      </div>
      <div style={{ marginTop: 20, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 20 }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>Media & Files</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} style={{
              aspectRatio: "1", borderRadius: 10,
              background: `linear-gradient(135deg, ${user.color}22, ${user.color}11)`,
              border: `1px solid ${user.color}22`, display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <ImageIcon size={14} color={user.color} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── ScrollToBottom ─────────────────────────────────────────────────────────────
function ScrollToBottomBtn({ onClick }) {
  return (
    <button onClick={onClick} style={{
      position: "absolute", bottom: 90, right: 24,
      background: "rgba(99,102,241,0.8)", border: "1px solid rgba(129,140,248,0.3)",
      borderRadius: "50%", width: 40, height: 40, cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center",
      backdropFilter: "blur(10px)", boxShadow: "0 4px 20px rgba(99,102,241,0.4)",
      color: "#fff", zIndex: 10, animation: "fadeUp 0.2s ease"
    }}>
      <ArrowDown size={16} />
    </button>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function GreenTalk() {
  const [dark, setDark] = useState(true);
  const [users] = useState(MOCK_USERS);
  const [messages, setMessages] = useState({ ...SEED_MESSAGES });
  const [activeUser, setActiveUser] = useState(null);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [msgSearch, setMsgSearch] = useState("");
  const [showMsgSearch, setShowMsgSearch] = useState(false);
  const [typing, setTyping] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [mobileView, setMobileView] = useState("list"); // "list" | "chat"
  const [filter, setFilter] = useState("all");
  const [sidebarTab, setSidebarTab] = useState("chats");
  const [notifications, setNotifications] = useState(true);
  const messagesEndRef = useRef(null);
  const chatBodyRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimerRef = useRef(null);

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  const filteredUsers = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.role.toLowerCase().includes(search.toLowerCase());
    if (filter === "online") return matchSearch && u.status === "online";
    if (filter === "unread") return matchSearch && u.unread > 0;
    return matchSearch;
  });

  const currentMsgs = activeUser ? (messages[activeUser.id] || []) : [];

  const filteredMsgs = msgSearch
    ? currentMsgs.filter(m => m.text?.toLowerCase().includes(msgSearch.toLowerCase()))
    : currentMsgs;

  const lastMsgFor = (uid) => {
    const msgs = messages[uid] || [];
    const last = msgs[msgs.length - 1];
    return last ? (last.sender === "me" ? `You: ${last.text}` : last.text) : "";
  };

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  useEffect(() => { scrollToBottom(); }, [currentMsgs.length, activeUser]);

  const handleScroll = () => {
    const el = chatBodyRef.current;
    if (!el) return;
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 200);
  };

  // Simulate typing indicator from other user
  const simulateTyping = () => {
    setIsTyping(true);
    setTimeout(() => setIsTyping(false), 2500);
  };

  const sendMessage = () => {
    if (!input.trim() || !activeUser) return;
    const msg = {
      id: `m_${Date.now()}`, sender: "me", text: input.trim(),
      time: new Date().toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" }),
      reactions: {}, status: "sent", type: "text"
    };
    setMessages(prev => ({
      ...prev,
      [activeUser.id]: [...(prev[activeUser.id] || []), msg]
    }));
    setInput("");
    setTimeout(() => simulateTyping(), 800);
    setTimeout(() => {
      const replies = [
        "Got it! 👍", "Sounds good to me!", "Interesting…",
        "Let me check on that", "On it! 🚀", "Perfect, thanks!", "Will do ✅"
      ];
      const reply = {
        id: `r_${Date.now()}`, sender: activeUser.id,
        text: replies[Math.floor(Math.random() * replies.length)],
        time: new Date().toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" }),
        reactions: {}, status: "delivered", type: "text"
      };
      setMessages(prev => ({ ...prev, [activeUser.id]: [...(prev[activeUser.id] || []), reply] }));
    }, 3500);
  };

  const sendVoiceNote = () => {
    if (!activeUser) return;
    setIsRecording(false);
    const durations = ["0:07", "0:12", "0:23", "0:45", "1:02"];
    const msg = {
      id: `v_${Date.now()}`, sender: "me",
      text: "", time: new Date().toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" }),
      reactions: {}, status: "sent", type: "voice",
      duration: durations[Math.floor(Math.random() * durations.length)]
    };
    setMessages(prev => ({ ...prev, [activeUser.id]: [...(prev[activeUser.id] || []), msg] }));
  };

  const handleReact = (msgId, emoji) => {
    setMessages(prev => ({
      ...prev,
      [activeUser.id]: (prev[activeUser.id] || []).map(m =>
        m.id === msgId ? { ...m, reactions: { ...m.reactions, [emoji]: !m.reactions[emoji] || undefined } } : m
      ).map(m => ({ ...m, reactions: Object.fromEntries(Object.entries(m.reactions).filter(([, v]) => v)) }))
    }));
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    clearTimeout(typingTimerRef.current);
    setTyping(true);
    typingTimerRef.current = setTimeout(() => setTyping(false), 1500);
  };

  const getUserById = (id) => users.find(u => u.id === id) || { name: "You", avatar: "YO", color: "#818cf8", status: "online", id: "me" };

  // CSS-in-JS
  const styles = `
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
    :root {
      --bg-deep: ${dark ? "#08081a" : "#f0f2ff"};
      --bg-glass: ${dark ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.6)"};
      --border: ${dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)"};
      --text: ${dark ? "rgba(255,255,255,0.9)" : "rgba(0,0,20,0.85)"};
      --subtext: ${dark ? "rgba(255,255,255,0.4)" : "rgba(0,0,20,0.45)"};
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'DM Sans', sans-serif; }
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(129,140,248,0.25); border-radius: 4px; }
    @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
    @keyframes slideLeft { from { transform:translateX(100%); } to { transform:translateX(0); } }
    @keyframes typingBounce { 0%,60%,100% { transform:translateY(0); } 30% { transform:translateY(-8px); } }
    @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
    @keyframes meshAnim { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
    @keyframes glow { 0%,100% { box-shadow: 0 0 20px rgba(99,102,241,0.3); } 50% { box-shadow: 0 0 40px rgba(99,102,241,0.6); } }
    input::placeholder { color: rgba(255,255,255,0.25); }
    textarea::placeholder { color: rgba(255,255,255,0.25); }
    @media (max-width: 768px) {
      .sidebar { width: 100% !important; display: ${mobileView === "list" ? "flex" : "none"} !important; }
      .chatpanel { display: ${mobileView === "chat" ? "flex" : "none"} !important; }
    }
  `;

  const bgStyle = dark ? {
    background: "radial-gradient(ellipse at 20% 20%, rgba(99,102,241,0.12) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(139,92,246,0.08) 0%, transparent 50%), #08081a",
  } : {
    background: "radial-gradient(ellipse at 20% 20%, rgba(99,102,241,0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(139,92,246,0.05) 0%, transparent 50%), #eef0ff",
  };

  return (
    <>
      <style>{styles}</style>
      <div style={{
        height: "100vh", width: "100vw", display: "flex", overflow: "hidden",
        fontFamily: "'DM Sans', sans-serif", ...bgStyle, position: "relative",
      }}>
        {/* Ambient orbs */}
        <div style={{ position: "fixed", top: "10%", left: "5%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
        <div style={{ position: "fixed", bottom: "10%", right: "5%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

        {/* ── SIDEBAR ── */}
        <div className="sidebar" style={{
          width: 340, flexShrink: 0, display: "flex", flexDirection: "column",
          background: dark ? "rgba(8,8,26,0.7)" : "rgba(240,242,255,0.7)",
          backdropFilter: "blur(30px)", borderRight: `1px solid ${dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)"}`,
          position: "relative", zIndex: 10,
        }}>
          {/* Sidebar header */}
          <div style={{ padding: "20px 18px 0", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 12,
                  background: "green", border: "2px solid rgba(34,197,94,0.5)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 4px 15px rgba(99,102,241,0.4)", animation: "glow 3s ease infinite"
                }}>
                  <Zap size={18} color="white" background="white" />
                </div>
                <div>
                  <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 800, fontSize: 17, color: dark ? "rgba(255,255,255,0.95)" : "rgba(0,0,20,0.9)", letterSpacing: "-0.3px" }}> <span className="text-green-500 text-3xl">G</span>-Talk</div>
                  <div style={{ fontSize: 10, color: "rgba(129,140,248,0.8)", fontWeight: 500 }}>Encrypted · Realtime</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setNotifications(!notifications)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, width: 34, height: 34, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.5)" }}>
                  {notifications ? <Bell size={15} /> : <BellOff size={15} />}
                </button>
                <button onClick={() => setDark(!dark)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, width: 34, height: 34, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.5)" }}>
                  {dark ? <Sun size={15} /> : <Moon size={15} />}
                </button>
              </div>
            </div>

            {/* My mini profile */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "rgba(129,140,248,0.08)", border: "1px solid rgba(129,140,248,0.15)", borderRadius: 14, marginBottom: 16, backdropFilter: "blur(8px)" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, rgba(99,102,241,0.5),rgba(139,92,246,0.3))", border: "2px solid rgba(129,140,248,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, color: "#a5b4fc", fontFamily: "'Sora',sans-serif" }}>YO</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: dark ? "rgba(255,255,255,0.9)" : "rgba(0,0,20,0.85)", fontFamily: "'Sora',sans-serif" }}>You</div>
                <div style={{ fontSize: 11, color: "#4ade80", display: "flex", alignItems: "center", gap: 4 }}><StatusDot status="online" size={7} /> Active now</div>
              </div>
              <button style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", display: "flex" }}><Edit3 size={14} /></button>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 14, background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 4 }}>
              {["chats", "groups"].map(tab => (
                <button key={tab} onClick={() => setSidebarTab(tab)} style={{
                  flex: 1, padding: "7px 0", borderRadius: 9, border: "none", cursor: "pointer",
                  background: sidebarTab === tab ? "rgba(129,140,248,0.2)" : "transparent",
                  color: sidebarTab === tab ? "#a5b4fc" : "rgba(255,255,255,0.35)",
                  fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 500,
                  transition: "all 0.2s",
                }}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
              ))}
            </div>

            <SearchBar value={search} onChange={setSearch} placeholder="Search people, messages…" />

            {/* Filter chips */}
            <div style={{ display: "flex", gap: 6, marginTop: 12, marginBottom: 4, overflowX: "auto", paddingBottom: 4 }}>
              {["all", "online", "unread"].map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  padding: "5px 12px", borderRadius: 20, border: "none", cursor: "pointer", flexShrink: 0,
                  background: filter === f ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "rgba(255,255,255,0.05)",
                  color: filter === f ? "#fff" : "rgba(255,255,255,0.4)",
                  fontSize: 11, fontWeight: 500, fontFamily: "'DM Sans',sans-serif",
                  boxShadow: filter === f ? "0 2px 10px rgba(99,102,241,0.35)" : "none",
                  transition: "all 0.2s",
                }}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>
              ))}
            </div>
          </div>

          {/* User List */}
          <div style={{ flex: 1, overflowY: "auto", padding: "6px 10px 20px" }}>
            {sidebarTab === "chats" ? (
              filteredUsers.length === 0 ? (
                <div style={{ textAlign: "center", color: "rgba(255,255,255,0.25)", marginTop: 40, fontSize: 13 }}>No users found</div>
              ) : (
                filteredUsers.map(u => (
                  <UserCard key={u.id} user={u} active={activeUser?.id === u.id} lastMsg={lastMsgFor(u.id)}
                    onClick={() => { setActiveUser(u); setShowProfile(false); setMobileView("chat"); }} />
                ))
              )
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", marginTop: 60, gap: 12 }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(129,140,248,0.1)", border: "1px solid rgba(129,140,248,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Hash size={22} color="rgba(129,140,248,0.6)" />
                </div>
                <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, textAlign: "center" }}>Groups coming soon</div>
                <button style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", borderRadius: 12, padding: "8px 18px", color: "#fff", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", display: "flex", alignItems: "center", gap: 6 }}><Plus size={14} /> Create Group</button>
              </div>
            )}
          </div>

          {/* Bottom Nav */}
          <div style={{ padding: "12px 18px 16px", borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-around" }}>
            {[{ icon: MessageCircle, label: "Chats" }, { icon: Users, label: "Contacts" }, { icon: Settings, label: "Settings" }].map(({ icon: Icon, label }) => (
              <button key={label} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: "rgba(255,255,255,0.35)", fontSize: 10, fontFamily: "'DM Sans',sans-serif", padding: "6px 12px", borderRadius: 10, transition: "all 0.2s" }}
                onMouseEnter={ev => { ev.currentTarget.style.color = "#a5b4fc"; ev.currentTarget.style.background = "rgba(129,140,248,0.08)"; }}
                onMouseLeave={ev => { ev.currentTarget.style.color = "rgba(255,255,255,0.35)"; ev.currentTarget.style.background = "none"; }}
              >
                <Icon size={18} />{label}
              </button>
            ))}
          </div>
        </div>

        {/* ── CHAT PANEL ── */}
        <div className="chatpanel" style={{
          flex: 1, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden",
          background: dark ? "rgba(10,10,28,0.4)" : "rgba(245,247,255,0.4)", backdropFilter: "blur(10px)",
        }}>
          {!activeUser ? (
            /* Empty state */
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: 40 }}>
              <div style={{ width: 100, height: 100, borderRadius: "50%", background: "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.1))", border: "1px solid rgba(129,140,248,0.2)", display: "flex", alignItems: "center", justifyContent: "center", animation: "glow 3s ease infinite" }}>
                <MessageCircle size={40} color="rgba(129,140,248,0.6)" />
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 22, color: dark ? "rgba(255,255,255,0.85)" : "rgba(0,0,20,0.8)", marginBottom: 8 }}>Select a conversation</div>
                <div style={{ fontSize: 14, color: "rgba(255,255,255,0.35)", maxWidth: 280 }}>Choose someone from the left to start chatting with end-to-end encryption</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 20, background: "rgba(129,140,248,0.08)", border: "1px solid rgba(129,140,248,0.15)" }}>
                <Shield size={13} color="rgba(129,140,248,0.7)" />
                <span style={{ fontSize: 12, color: "rgba(129,140,248,0.7)" }}>All messages encrypted end-to-end</span>
              </div>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div style={{
                display: "flex", alignItems: "center", gap: 12, padding: "14px 20px",
                background: dark ? "rgba(8,8,26,0.6)" : "rgba(240,242,255,0.6)",
                backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)",
                flexShrink: 0, position: "relative", zIndex: 5
              }}>
                {/* Mobile back */}
                <button onClick={() => setMobileView("list")} className="mobile-back" style={{
                  display: "none", background: "none", border: "none", cursor: "pointer",
                  color: "rgba(255,255,255,0.5)", marginRight: 4, "@media(max-width:768px)": { display: "flex" }
                }}>
                  <ChevronLeft size={20} />
                </button>

                <div onClick={() => setShowProfile(!showProfile)} style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", flex: 1 }}>
                  <Avatar user={activeUser} size={44} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: dark ? "rgba(255,255,255,0.95)" : "rgba(0,0,20,0.9)", fontFamily: "'Sora',sans-serif" }}>{activeUser.name}</div>
                    <div style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
                      {isTyping ? (
                        <span style={{ color: "#818cf8", animation: "pulse 1s ease infinite" }}>typing…</span>
                      ) : (
                        <>
                          <StatusDot status={activeUser.status} size={7} />
                          <span style={{ color: activeUser.status === "online" ? "#4ade80" : "rgba(255,255,255,0.35)" }}>{activeUser.status}</span>
                          <span style={{ color: "rgba(255,255,255,0.25)" }}>· {activeUser.role}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => setShowMsgSearch(!showMsgSearch)} style={{ background: showMsgSearch ? "rgba(129,140,248,0.2)" : "rgba(255,255,255,0.05)", border: `1px solid ${showMsgSearch ? "rgba(129,140,248,0.3)" : "rgba(255,255,255,0.08)"}`, borderRadius: 12, width: 38, height: 38, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: showMsgSearch ? "#a5b4fc" : "rgba(255,255,255,0.45)", transition: "all 0.2s" }}>
                    <Search size={16} />
                  </button>
                  {[Phone, Video].map((Icon, i) => (
                    <button key={i} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, width: 38, height: 38, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.45)", transition: "all 0.2s" }}
                      onMouseEnter={ev => ev.currentTarget.style.background = "rgba(99,102,241,0.2)"}
                      onMouseLeave={ev => ev.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                    ><Icon size={16} /></button>
                  ))}
                  <button onClick={() => setShowProfile(!showProfile)} style={{ background: showProfile ? "rgba(129,140,248,0.2)" : "rgba(255,255,255,0.05)", border: `1px solid ${showProfile ? "rgba(129,140,248,0.3)" : "rgba(255,255,255,0.08)"}`, borderRadius: 12, width: 38, height: 38, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: showProfile ? "#a5b4fc" : "rgba(255,255,255,0.45)" }}>
                    <MoreVertical size={16} />
                  </button>
                </div>
              </div>

              {/* Message search bar */}
              {showMsgSearch && (
                <div style={{ padding: "8px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(8,8,26,0.4)", backdropFilter: "blur(10px)", flexShrink: 0 }}>
                  <SearchBar value={msgSearch} onChange={setMsgSearch} placeholder="Search in conversation…" />
                </div>
              )}

              {/* Encryption badge */}
              <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 14px", borderRadius: 20, background: "rgba(129,140,248,0.06)", border: "1px solid rgba(129,140,248,0.12)", backdropFilter: "blur(8px)" }}>
                  <Shield size={11} color="rgba(129,140,248,0.7)" />
                  <span style={{ fontSize: 11, color: "rgba(129,140,248,0.6)" }}>Messages are encrypted end-to-end</span>
                </div>
              </div>

              {/* Messages */}
              <div ref={chatBodyRef} onScroll={handleScroll} style={{ flex: 1, overflowY: "auto", padding: "10px 20px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
                {filteredMsgs.length === 0 && msgSearch ? (
                  <div style={{ textAlign: "center", color: "rgba(255,255,255,0.25)", marginTop: 60, fontSize: 13 }}>No messages found for "{msgSearch}"</div>
                ) : (
                  filteredMsgs.map(msg => (
                    <MessageBubble key={msg.id} msg={msg} user={getUserById(msg.sender)} isMe={msg.sender === "me"} onReact={handleReact} />
                  ))
                )}
                {isTyping && activeUser && <TypingIndicator user={activeUser} />}
                <div ref={messagesEndRef} />
              </div>

              {showScrollBtn && <ScrollToBottomBtn onClick={scrollToBottom} />}

              {/* Input Area */}
              <div style={{
                padding: "12px 20px 16px", flexShrink: 0,
                background: dark ? "rgba(8,8,26,0.6)" : "rgba(240,242,255,0.6)",
                backdropFilter: "blur(20px)", borderTop: "1px solid rgba(255,255,255,0.05)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, width: 40, height: 40, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.4)", flexShrink: 0 }}>
                    <Paperclip size={17} />
                  </button>

                  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "10px 16px", backdropFilter: "blur(10px)", transition: "border-color 0.2s" }}>
                    <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
                      placeholder={`Message ${activeUser.name}…`}
                      style={{ flex: 1, background: "none", border: "none", outline: "none", color: dark ? "rgba(255,255,255,0.85)" : "rgba(0,0,20,0.8)", fontSize: 14, fontFamily: "'DM Sans',sans-serif" }}
                    />
                    <div style={{ position: "relative" }}>
                      <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", display: "flex", alignItems: "center", fontSize: 18, padding: 0 }}>😊</button>
                      {showEmojiPicker && (
                        <div style={{ position: "absolute", bottom: "100%", right: 0, marginBottom: 8, background: "rgba(15,15,35,0.97)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: "12px 14px", display: "flex", gap: 8, zIndex: 100, boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
                          {EMOJI_LIST.map(e => (
                            <button key={e} onClick={() => { setInput(prev => prev + e); setShowEmojiPicker(false); inputRef.current?.focus(); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, borderRadius: 8, padding: "4px 6px", transition: "transform 0.15s" }}
                              onMouseEnter={ev => ev.target.style.transform = "scale(1.3)"}
                              onMouseLeave={ev => ev.target.style.transform = "scale(1)"}
                            >{e}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Voice / Send */}
                  {input.trim() ? (
                    <button onClick={sendMessage} style={{
                      width: 44, height: 44, borderRadius: "50%", border: "none", cursor: "pointer",
                      background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: "0 4px 20px rgba(99,102,241,0.5)", transition: "transform 0.15s", flexShrink: 0,
                    }}
                      onMouseEnter={ev => ev.currentTarget.style.transform = "scale(1.08)"}
                      onMouseLeave={ev => ev.currentTarget.style.transform = "scale(1)"}
                    ><Send size={17} color="#fff" /></button>
                  ) : (
                    <button
                      onMouseDown={() => setIsRecording(true)}
                      onMouseUp={() => isRecording && sendVoiceNote()}
                      onMouseLeave={() => setIsRecording(false)}
                      style={{
                        width: 44, height: 44, borderRadius: "50%", border: "none", cursor: "pointer",
                        background: isRecording ? "linear-gradient(135deg,#ef4444,#f97316)" : "rgba(255,255,255,0.07)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: isRecording ? "0 4px 20px rgba(239,68,68,0.5)" : "none",
                        transition: "all 0.2s", flexShrink: 0,
                        animation: isRecording ? "pulse 1s ease infinite" : "none",
                      }}
                    ><Mic size={17} color={isRecording ? "#fff" : "rgba(255,255,255,0.5)"} /></button>
                  )}
                </div>
                <div style={{ textAlign: "center", marginTop: 8, fontSize: 10, color: "rgba(255,255,255,0.15)", display: "flex", justifyContent: "center", alignItems: "center", gap: 4 }}>
                  <Shield size={9} /><span>End-to-end encrypted · G-Talk</span>
                </div>
              </div>
            </>
          )}

          {/* Profile panel overlay */}
          {showProfile && activeUser && <ProfilePanel user={activeUser} onClose={() => setShowProfile(false)} />}
        </div>
      </div>
    </>
  );
}