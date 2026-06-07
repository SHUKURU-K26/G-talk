from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import json
import uuid
import base64
import os
from datetime import datetime
from cryptography.fernet import Fernet
from typing import Dict, List, Optional
import asyncio

app = FastAPI(title="G-Talk API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Encryption Setup ──────────────────────────────────────────────────────────
FERNET_KEY = os.getenv("FERNET_KEY", Fernet.generate_key())
fernet = Fernet(FERNET_KEY if isinstance(FERNET_KEY, bytes) else FERNET_KEY.encode())

def encrypt_payload(data: dict) -> dict:
    """Encrypt all sensitive fields; expose only 'id' in plaintext."""
    sensitive = {k: v for k, v in data.items() if k != "id"}
    encrypted_blob = fernet.encrypt(json.dumps(sensitive).encode()).decode()
    return {"id": data["id"], "enc": encrypted_blob}

def decrypt_payload(enc_data: dict) -> dict:
    """Decrypt the blob and merge with id."""
    raw = fernet.decrypt(enc_data["enc"].encode())
    result = json.loads(raw)
    result["id"] = enc_data["id"]
    return result

# ── Mock Users Dictionary ─────────────────────────────────────────────────────
USERS: Dict[str, dict] = {
    "u1":  {"id": "u1",  "name": "Aiko Tanaka",      "avatar": "AT", "status": "online",  "role": "Designer",        "color": "#6EE7B7", "bio": "Crafting pixels & dreams", "lastSeen": "now"},
    "u2":  {"id": "u2",  "name": "Marcus Rivera",    "avatar": "MR", "status": "online",  "role": "Engineer",        "color": "#93C5FD", "bio": "Code is my poetry",        "lastSeen": "now"},
    "u3":  {"id": "u3",  "name": "Zara Okonkwo",     "avatar": "ZO", "status": "away",    "role": "Product Manager", "color": "#FCA5A5", "bio": "Building the future",      "lastSeen": "5m ago"},
    "u4":  {"id": "u4",  "name": "Liam Chen",         "avatar": "LC", "status": "online",  "role": "Data Scientist",  "color": "#C4B5FD", "bio": "Turning data into stories","lastSeen": "now"},
    "u5":  {"id": "u5",  "name": "Sofia Petrov",      "avatar": "SP", "status": "offline", "role": "Marketing",       "color": "#FDE68A", "bio": "Words that move people",   "lastSeen": "2h ago"},
    "u6":  {"id": "u6",  "name": "Darius Webb",       "avatar": "DW", "status": "online",  "role": "DevOps",          "color": "#6EE7F7", "bio": "Deploying dreams daily",   "lastSeen": "now"},
    "u7":  {"id": "u7",  "name": "Nia Adeyemi",       "avatar": "NA", "status": "away",    "role": "QA Engineer",     "color": "#F9A8D4", "bio": "Breaking things perfectly","lastSeen": "12m ago"},
    "u8":  {"id": "u8",  "name": "Ethan Kowalski",    "avatar": "EK", "status": "online",  "role": "Backend Dev",     "color": "#86EFAC", "bio": "APIs are my canvas",       "lastSeen": "now"},
    "u9":  {"id": "u9",  "name": "Priya Sharma",      "avatar": "PS", "status": "offline", "role": "UX Researcher",   "color": "#FBB6CE", "bio": "Understanding humans",     "lastSeen": "1d ago"},
    "u10": {"id": "u10", "name": "Kai Nakamura",      "avatar": "KN", "status": "online",  "role": "Frontend Dev",    "color": "#A5F3FC", "bio": "CSS sorcerer",             "lastSeen": "now"},
    "u11": {"id": "u11", "name": "Amara Diallo",      "avatar": "AD", "status": "away",    "role": "Security",        "color": "#DDD6FE", "bio": "Keeping secrets safe",     "lastSeen": "30m ago"},
    "u12": {"id": "u12", "name": "Noah Fitzgerald",   "avatar": "NF", "status": "online",  "role": "Architect",       "color": "#FED7AA", "bio": "Designing at scale",       "lastSeen": "now"},
    "u13": {"id": "u13", "name": "Yuki Shimizu",      "avatar": "YS", "status": "offline", "role": "ML Engineer",     "color": "#BAE6FD", "bio": "Teaching machines to think","lastSeen": "3h ago"},
}

# Current logged-in user (me)
ME = {"id": "me", "name": "You", "avatar": "YO", "status": "online", "color": "#818CF8"}

# ── In-memory messages store ──────────────────────────────────────────────────
# Key: frozenset of two user ids → list of messages
MESSAGES: Dict[str, List[dict]] = {}

def conv_key(a: str, b: str) -> str:
    return "_".join(sorted([a, b]))

def seed_messages():
    convos = [
        ("u1",  [("u1", "Hey! Just finished the new mockups 🎨", "10:02"), ("me", "They look incredible, Aiko!", "10:05"), ("u1", "Thanks! Ready for review when you are", "10:06")]),
        ("u2",  [("me", "Did the CI pass?", "09:45"), ("u2", "Yes! All 247 tests green 🟢", "09:47"), ("u2", "Deploying to staging now", "09:48")]),
        ("u4",  [("u4", "Check out this anomaly in the dataset", "Yesterday"), ("me", "Interesting spike around 3PM", "Yesterday"), ("u4", "Exactly — looks like a timezone bug", "Yesterday")]),
        ("u6",  [("u6", "Infra is fully replicated across 3 zones", "08:30"), ("me", "Perfect. Zero downtime confirmed?", "08:32"), ("u6", "Zero. 99.99% uptime this quarter 🚀", "08:33")]),
        ("u8",  [("me", "The new endpoint is live", "11:00"), ("u8", "Awesome, rate limiting in place?", "11:02"), ("me", "Yes — 1000 req/min per user", "11:03")]),
        ("u10", [("u10", "Finally cracked the CSS grid issue!", "Yesterday"), ("me", "The responsive layout looks flawless now", "Yesterday")]),
        ("u12", [("u12", "System design doc is ready for review", "Mon"), ("me", "Reading it now — brilliant architecture", "Mon"), ("u12", "Appreciate it! Open to feedback", "Mon")]),
    ]
    for uid, msgs in convos:
        key = conv_key("me", uid)
        MESSAGES[key] = []
        for sender, text, time in msgs:
            MESSAGES[key].append({
                "id": str(uuid.uuid4()),
                "sender": sender,
                "text": text,
                "time": time,
                "reactions": {},
                "status": "seen",
                "type": "text"
            })

seed_messages()

# ── WebSocket Connection Manager ──────────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.active: Dict[str, WebSocket] = {}

    async def connect(self, ws: WebSocket, user_id: str):
        await ws.accept()
        self.active[user_id] = ws

    def disconnect(self, user_id: str):
        self.active.pop(user_id, None)

    async def send_to(self, user_id: str, data: dict):
        ws = self.active.get(user_id)
        if ws:
            try:
                await ws.send_json(data)
            except:
                self.disconnect(user_id)

    async def broadcast(self, data: dict, exclude: str = None):
        for uid, ws in list(self.active.items()):
            if uid != exclude:
                try:
                    await ws.send_json(data)
                except:
                    self.disconnect(uid)

manager = ConnectionManager()

# ── REST Endpoints ─────────────────────────────────────────────────────────────
@app.get("/api/users")
async def get_users():
    """Return encrypted user blobs — only 'id' is plaintext."""
    encrypted_users = [encrypt_payload(u) for u in USERS.values()]
    return {"users": encrypted_users}

@app.get("/api/decrypt/{user_id}")
async def decrypt_user(user_id: str):
    """Decrypt a single user by id."""
    user = USERS.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@app.get("/api/messages/{other_id}")
async def get_messages(other_id: str):
    key = conv_key("me", other_id)
    msgs = MESSAGES.get(key, [])
    encrypted = []
    for m in msgs:
        enc = fernet.encrypt(json.dumps(m).encode()).decode()
        encrypted.append({"id": m["id"], "enc": enc})
    return {"messages": encrypted}

@app.post("/api/messages/{other_id}/decrypt")
async def decrypt_messages(other_id: str, payload: dict):
    """Frontend sends list of enc blobs, we decrypt and return."""
    decrypted = []
    for item in payload.get("messages", []):
        raw = fernet.decrypt(item["enc"].encode())
        decrypted.append(json.loads(raw))
    return {"messages": decrypted}

@app.post("/api/send/{other_id}")
async def send_message(other_id: str, payload: dict):
    msg = {
        "id": str(uuid.uuid4()),
        "sender": "me",
        "text": payload.get("text", ""),
        "time": datetime.now().strftime("%H:%M"),
        "reactions": {},
        "status": "sent",
        "type": payload.get("type", "text"),
    }
    key = conv_key("me", other_id)
    MESSAGES.setdefault(key, []).append(msg)
    # Notify via WebSocket
    await manager.send_to(other_id, {"event": "new_message", "from": "me", "message": msg})
    return {"message": msg}

@app.post("/api/react/{msg_id}")
async def react_to_message(msg_id: str, payload: dict):
    emoji = payload.get("emoji")
    other_id = payload.get("other_id")
    key = conv_key("me", other_id)
    for msg in MESSAGES.get(key, []):
        if msg["id"] == msg_id:
            reactions = msg.setdefault("reactions", {})
            if emoji in reactions:
                del reactions[emoji]
            else:
                reactions[emoji] = True
            return {"reactions": reactions}
    raise HTTPException(status_code=404, detail="Message not found")

@app.post("/api/users/{user_id}/status")
async def update_status(user_id: str, payload: dict):
    if user_id in USERS:
        USERS[user_id]["status"] = payload.get("status", "online")
    return {"ok": True}

# ── WebSocket ──────────────────────────────────────────────────────────────────
@app.websocket("/ws/{user_id}")
async def websocket_endpoint(ws: WebSocket, user_id: str):
    await manager.connect(ws, user_id)
    try:
        while True:
            data = await ws.receive_json()
            event = data.get("event")

            if event == "typing":
                await manager.send_to(data.get("to"), {
                    "event": "typing",
                    "from": user_id,
                    "isTyping": data.get("isTyping", False)
                })

            elif event == "message_seen":
                other_id = data.get("from_user")
                key = conv_key(user_id, other_id)
                for msg in MESSAGES.get(key, []):
                    if msg["sender"] == other_id:
                        msg["status"] = "seen"
                await manager.send_to(other_id, {"event": "messages_seen", "by": user_id})

    except WebSocketDisconnect:
        manager.disconnect(user_id)
        await manager.broadcast({"event": "user_offline", "user_id": user_id})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)