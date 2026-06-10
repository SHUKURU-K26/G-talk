from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import json
import uuid
import os
import hashlib
import shutil
from datetime import datetime
from cryptography.fernet import Fernet
from typing import Dict, List

app = FastAPI(title="NovaTalk API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Uploads folder setup ──────────────────────────────────────────────────────
UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

# ── Encryption Setup ──────────────────────────────────────────────────────────
FERNET_KEY = os.getenv("FERNET_KEY", "eZVcCVZ6G_1vLw8Bi_zZUP4rPXGPbHnT9XMmH8FrLzE=").encode()
fernet = Fernet(FERNET_KEY)

def encrypt_message(text: str) -> str:
    return fernet.encrypt(text.encode()).decode()

def decrypt_message(token: str) -> str:
    return fernet.decrypt(token.encode()).decode()

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


# ── data.json helpers ─────────────────────────────────────────────────────────
DATA_FILE = os.path.join(os.path.dirname(__file__), "data.json")

def load_data() -> dict:
    with open(DATA_FILE, "r") as f:
        return json.load(f)

def save_data(data: dict):
    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=2)


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
@app.post("/api/register")
async def register(payload: dict):
    data = load_data()
    phone = payload.get("phone", "").strip()
    email = payload.get("email", "").strip().lower()
    username = payload.get("username", "").strip()

    # Check duplicates
    for u in data["users"].values():
        if u["phone"] == phone:
            raise HTTPException(status_code=400, detail="Phone number already registered")
        if u["email"] == email:
            raise HTTPException(status_code=400, detail="Email already registered")
        if u["username"].lower() == username.lower():
            raise HTTPException(status_code=400, detail="Username already taken")

    user_id = str(uuid.uuid4())
    colors = ["#6EE7B7","#93C5FD","#FCA5A5","#C4B5FD","#FDE68A","#6EE7F7","#F9A8D4","#86EFAC","#A5F3FC","#DDD6FE"]
    import random
    user = {
        "id": user_id,
        "fullName": payload.get("fullName", "").strip(),
        "username": username,
        "email": email,
        "phone": phone,
        "password": hash_password(payload.get("password", "")),
        "avatar": username[:2].upper(),
        "color": random.choice(colors),
        "status": "online",
        "bio": payload.get("bio", "Hey, I'm on G-Talk!"),
        "role": "G-Talk User",
        "lastSeen": "now",
        "createdAt": datetime.now().isoformat()
    }
    data["users"][user_id] = user
    data["contacts"][user_id] = []
    save_data(data)

    # Return user without password
    safe = {k: v for k, v in user.items() if k != "password"}
    return {"user": safe}


@app.post("/api/login")
async def login(payload: dict):
    data = load_data()
    identifier = payload.get("identifier", "").strip()  # phone or username
    password_hash = hash_password(payload.get("password", ""))

    for u in data["users"].values():
        if (u["phone"] == identifier or u["username"].lower() == identifier.lower()) and u["password"] == password_hash:
            u["status"] = "online"
            save_data(data)
            safe = {k: v for k, v in u.items() if k != "password"}
            return {"user": safe}

    raise HTTPException(status_code=401, detail="Invalid credentials")


@app.post("/api/logout/{user_id}")
async def logout(user_id: str):
    data = load_data()
    if user_id in data["users"]:
        data["users"][user_id]["status"] = "offline"
        data["users"][user_id]["lastSeen"] = datetime.now().strftime("%H:%M")
        save_data(data)
    return {"ok": True}


@app.get("/api/contacts/{user_id}")
async def get_contacts(user_id: str):
    data = load_data()
    contact_ids = data["contacts"].get(user_id, [])
    contacts = []
    for cid in contact_ids:
        u = data["users"].get(cid)
        if u:
            safe = {k: v for k, v in u.items() if k != "password"}
            contacts.append(safe)
    return {"contacts": contacts}


@app.post("/api/contacts/add")
async def add_contact(payload: dict):
    user_id = payload.get("user_id")
    phone = payload.get("phone", "").strip()
    data = load_data()

    # Find the target user by phone
    target = None
    for u in data["users"].values():
        if u["phone"] == phone:
            target = u
            break

    if not target:
        raise HTTPException(status_code=404, detail="No G-Talk user found with that phone number")

    if target["id"] == user_id:
        raise HTTPException(status_code=400, detail="You can't add yourself")

    contacts = data["contacts"].setdefault(user_id, [])
    if target["id"] in contacts:
        raise HTTPException(status_code=400, detail="Contact already added")

    contacts.append(target["id"])
    save_data(data)

    safe = {k: v for k, v in target.items() if k != "password"}
    safe["name"] = safe.get("fullName", safe.get("username", ""))
    return {"contact": safe}


@app.get("/api/messages/{user_id}/{other_id}")
async def get_messages(user_id: str, other_id: str):
    data = load_data()
    key = "_".join(sorted([user_id, other_id]))
    msgs = data["messages"].get(key, [])
    # Decrypt text before sending to frontend
    decrypted = []
    for m in msgs:
        dm = dict(m)
        if dm.get("type") == "text" and dm.get("text"):
            try:
                dm["text"] = decrypt_message(dm["text"])
            except:
                pass
        decrypted.append(dm)
    return {"messages": decrypted}


@app.post("/api/send/{other_id}")
async def send_message(other_id: str, payload: dict):
    data = load_data()
    sender_id = payload.get("sender_id", "")
    text = payload.get("text", "")
    encrypted_text = encrypt_message(text) if text else ""

    msg = {
        "id": str(uuid.uuid4()),
        "sender": sender_id,
        "text": encrypted_text,
        "time": datetime.now().strftime("%H:%M"),
        "reactions": {},
        "status": "sent",
        "type": payload.get("type", "text"),
    }
    key = "_".join(sorted([sender_id, other_id]))
    data["messages"].setdefault(key, []).append(msg)
    save_data(data)

    # Return decrypted version to sender
    msg_out = dict(msg)
    msg_out["text"] = text
    await manager.send_to(other_id, {"event": "new_message", "from": sender_id, "message": msg_out})
    return {"message": msg_out}


@app.post("/api/react/{msg_id}")
async def react_to_message(msg_id: str, payload: dict):
    emoji = payload.get("emoji")
    user_id = payload.get("user_id")
    other_id = payload.get("other_id")
    data = load_data()
    key = "_".join(sorted([user_id, other_id]))
    for msg in data["messages"].get(key, []):
        if msg["id"] == msg_id:
            reactions = msg.setdefault("reactions", {})
            if emoji in reactions:
                del reactions[emoji]
            else:
                reactions[emoji] = True
            save_data(data)
            return {"reactions": reactions}
    raise HTTPException(status_code=404, detail="Message not found")


@app.post("/api/users/{user_id}/status")
async def update_status(user_id: str, payload: dict):
    data = load_data()
    if user_id in data["users"]:
        data["users"][user_id]["status"] = payload.get("status", "online")
        save_data(data)
    return {"ok": True}

#seen status endpoint
@app.post("/api/messages/{user_id}/{other_id}/seen")
async def mark_messages_seen(user_id: str, other_id: str):
    data = load_data()
    key = "_".join(sorted([user_id, other_id]))
    updated = False
    for msg in data["messages"].get(key, []):
        if msg["sender"] == other_id and msg["status"] != "seen":
            msg["status"] = "seen"
            updated = True
    if updated:
        save_data(data)
        # Notify the sender that their messages were seen
        await manager.send_to(other_id, {
            "event": "messages_seen",
            "by": user_id
        })
    return {"ok": True}

@app.post("/api/upload/{other_id}")
async def upload_file(
    other_id: str,
    sender_id: str = Form(...),
    file: UploadFile = File(...)
):
    # Validate file size (10MB max)
    MAX_SIZE = 10 * 1024 * 1024
    contents = await file.read()
    if len(contents) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Max size is 10MB")

    # Validate file type
    allowed_types = [
        "image/jpeg", "image/png", "image/gif", "image/webp",
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "video/mp4", "video/webm", "video/quicktime",
        "audio/webm", "audio/ogg", "audio/mp4", "audio/wav",
        "audio/mpeg", "audio/webm;codecs=opus", "audio/ogg;codecs=opus"
    ]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="File type not allowed")

    # Save file with unique name
    ext = os.path.splitext(file.filename)[1]
    unique_name = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(UPLOADS_DIR, unique_name)
    with open(file_path, "wb") as f:
        f.write(contents)

    # Determine file category
    if file.content_type.startswith("image/"):
        file_type = "image"
    elif file.content_type.startswith("video/"):
        file_type = "video"
    elif file.content_type.startswith("audio/"):
        file_type = "voice"
    else:
        file_type = "document"

    # Build message
    msg = {
        "id": str(uuid.uuid4()),
        "sender": sender_id,
        "text": "",
        "time": datetime.now().strftime("%H:%M"),
        "reactions": {},
        "status": "sent",
        "type": file_type,
        "fileName": file.filename,
        "fileSize": len(contents),
        "fileUrl": f"/uploads/{unique_name}",
        "mimeType": file.content_type,
    }

    # Save to data.json
    data = load_data()
    key = "_".join(sorted([sender_id, other_id]))
    data["messages"].setdefault(key, []).append(msg)
    save_data(data)

    # Notify recipient via WebSocket
    await manager.send_to(other_id, {
        "event": "new_message",
        "from": sender_id,
        "message": msg
    })

    return {"message": msg}

# ── Status Endpoints ──────────────────────────────────────────────────────────

@app.post("/api/status")
async def post_status(
    user_id: str = Form(...),
    status_type: str = Form(...),  # "text" or "image"
    text: str = Form(""),
    bg_color: str = Form("#059669"),
    file: UploadFile = File(None)
):
    data = load_data()
    status_id = str(uuid.uuid4())
    file_url = None

    if status_type == "image" and file:
        contents = await file.read()
        if len(contents) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File too large")
        ext = os.path.splitext(file.filename)[1]
        unique_name = f"status_{uuid.uuid4()}{ext}"
        file_path = os.path.join(UPLOADS_DIR, unique_name)
        with open(file_path, "wb") as f:
            f.write(contents)
        file_url = f"/uploads/{unique_name}"

    status = {
        "id": status_id,
        "user_id": user_id,
        "type": status_type,
        "text": text,
        "bg_color": bg_color,
        "file_url": file_url,
        "created_at": datetime.now().isoformat(),
        "expires_at": (datetime.now().replace(hour=23, minute=59, second=59)).isoformat(),
        "views": []
    }

    data["statuses"].setdefault(user_id, []).append(status)
    save_data(data)
    return {"status": status}


@app.get("/api/statuses/{user_id}")
async def get_statuses(user_id: str):
    data = load_data()
    contact_ids = data["contacts"].get(user_id, [])
    # Include own statuses too
    all_ids = [user_id] + contact_ids
    now = datetime.now()
    result = []

    for uid in all_ids:
        user = data["users"].get(uid)
        if not user:
            continue
        statuses = data["statuses"].get(uid, [])
        # Filter out expired statuses (older than 24 hours)
        active = [
            s for s in statuses
            if (now - datetime.fromisoformat(s["created_at"])).total_seconds() < 86400
        ]
        if active:
            safe_user = {k: v for k, v in user.items() if k != "password"}
            safe_user["name"] = safe_user.get("fullName", safe_user.get("username", ""))
            result.append({
                "user": safe_user,
                "statuses": active,
                "all_seen": all(user_id in s["views"] for s in active)
            })

    return {"statuses": result}


@app.post("/api/status/{status_id}/view")
async def view_status(status_id: str, payload: dict):
    viewer_id = payload.get("viewer_id")
    data = load_data()
    for uid, statuses in data["statuses"].items():
        for s in statuses:
            if s["id"] == status_id:
                if viewer_id not in s["views"]:
                    s["views"].append(viewer_id)
                    save_data(data)
                return {"views": s["views"]}
    raise HTTPException(status_code=404, detail="Status not found")

@app.get("/api/status/{status_id}/viewers")
async def get_status_viewers(status_id: str):
    data = load_data()
    for uid, statuses in data["statuses"].items():
        for s in statuses:
            if s["id"] == status_id:
                viewers = []
                for viewer_id in s.get("views", []):
                    u = data["users"].get(viewer_id)
                    if u:
                        safe = {k: v for k, v in u.items() if k != "password"}
                        safe["name"] = safe.get("fullName", safe.get("username", ""))
                        viewers.append(safe)
                return {"viewers": viewers}
    raise HTTPException(status_code=404, detail="Status not found")

@app.delete("/api/status/{status_id}")
async def delete_status(status_id: str, payload: dict):
    user_id = payload.get("user_id")
    data = load_data()
    statuses = data["statuses"].get(user_id, [])
    data["statuses"][user_id] = [s for s in statuses if s["id"] != status_id]
    save_data(data)
    return {"ok": True}



# ── WebSocket ──────────────────────────────────────────────────────────────────
@app.websocket("/ws/{user_id}")
async def websocket_endpoint(ws: WebSocket, user_id: str):
    await manager.connect(ws, user_id)
    print(f"[WS] {user_id} connected. Active connections: {list(manager.active.keys())}")
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
                db = load_data()
                key = "_".join(sorted([user_id, other_id]))
                updated = False
                for msg in db["messages"].get(key, []):
                    if msg["sender"] == other_id and msg["status"] != "seen":
                        msg["status"] = "seen"
                        updated = True
                if updated:
                    save_data(db)
                await manager.send_to(other_id, {"event": "messages_seen", "by": user_id})

    except WebSocketDisconnect:
        manager.disconnect(user_id)
        # Mark offline in data.json
        data = load_data()
        if user_id in data["users"]:
            data["users"][user_id]["status"] = "offline"
            data["users"][user_id]["lastSeen"] = datetime.now().strftime("%H:%M")
            save_data(data)
        await manager.broadcast({"event": "user_offline", "user_id": user_id})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)