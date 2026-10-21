const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.ALLOWED_ORIGIN || "*", methods: ["GET", "POST"] },
  pingInterval: 25000,
  pingTimeout: 20000,
  maxHttpBufferSize: 1e6
});
app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));

// Runtime storage: use a database before treating this as production persistence.
const profiles = new Map();
const socketsByUid = new Map();
const friendSets = new Map();
const requests = new Map();
const rooms = new Map();
const rateLimits = new Map();

const uidPattern = /^CP-[A-Z0-9]{8}$/;
const cleanName = v => String(v || "Người chơi").replace(/[<>\u0000-\u001f]/g, "").trim().slice(0, 24) || "Người chơi";
const cleanText = (v, max = 500) => String(v ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, max);
const uidOf = s => s?.data?.uid;
const friendsOf = uid => [...(friendSets.get(uid) || new Set())].map(id => ({
  uid: id, name: profiles.get(id)?.name || "Người chơi", online: (socketsByUid.get(id)?.size || 0) > 0
}));
const requestsOf = uid => [...(requests.get(uid) || new Map()).values()];
const emitUid = (uid, event, data) => {
  for (const sid of socketsByUid.get(uid) || []) io.to(sid).emit(event, data);
};
function throttle(socket, key, max = 12, windowMs = 10000) {
  const now = Date.now();
  const k = socket.id + ":" + key;
  const item = rateLimits.get(k) || { start: now, count: 0 };
  if (now - item.start > windowMs) { item.start = now; item.count = 0; }
  item.count++;
  rateLimits.set(k, item);
  return item.count <= max;
}
function snapshot(uid) {
  return { uid, profile: profiles.get(uid), requests: requestsOf(uid), friends: friendsOf(uid), onlinePlayers: [...profiles.values()].filter(p => (socketsByUid.get(p.uid)?.size || 0) > 0).map(p => ({ uid: p.uid, name: p.name })) };
}
function refreshPresence(uid) {
  const payload = { uid, online: (socketsByUid.get(uid)?.size || 0) > 0, name: profiles.get(uid)?.name || "Người chơi" };
  for (const p of profiles.values()) if (p.uid !== uid && (friendSets.get(p.uid) || new Set()).has(uid)) emitUid(p.uid, "presence:update", payload);
}
function addFriend(a, b) {
  if (!friendSets.has(a)) friendSets.set(a, new Set());
  if (!friendSets.has(b)) friendSets.set(b, new Set());
  friendSets.get(a).add(b); friendSets.get(b).add(a);
}
function roomSummary(room) {
  return { id: room.id, hostUid: room.hostUid, members: [...room.members].map(uid => ({ uid, name: profiles.get(uid)?.name || "Người chơi" })), createdAt: room.createdAt };
}

app.get("/", (_req, res) => res.type("html").send(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chrono Phantom Online</title><style>
:root{color-scheme:dark}body{font:16px system-ui;max-width:850px;margin:32px auto;padding:0 16px;background:#0b1020;color:#eef2ff}h1{color:#c4b5fd}section{background:#151c31;border:1px solid #303957;border-radius:14px;padding:18px;margin:14px 0}input,button{font:inherit;border-radius:8px;padding:10px;border:1px solid #475569;box-sizing:border-box}input{background:#0f172a;color:white;width:100%;margin:5px 0}button{background:#7c3aed;color:white;cursor:pointer;margin:4px 3px 4px 0}li{margin:10px 0;overflow-wrap:anywhere}.muted{color:#a5b4fc}.pill{color:#86efac}
</style></head><body><h1>Chrono Phantom Online</h1><p class="muted">Dịch vụ kết bạn và phòng chơi trực tuyến</p><section><h3>Hồ sơ người chơi</h3><p>UID: <b id="uid">Đang tạo…</b></p><input id="name" maxlength="24" placeholder="Tên chiến hữu"><button id="connect">Kết nối / Lưu tên</button><p id="status">Đang kết nối…</p></section><section><h3>Thêm chiến hữu</h3><input id="target" placeholder="UID, ví dụ CP-AB12CD34"><button id="send">Gửi lời mời</button><p id="message"></p><h4>Lời mời đến</h4><ul id="incoming"></ul><h4>Chiến hữu</h4><ul id="friends"></ul></section><section><h3>Phòng chơi</h3><button id="create">Tạo phòng</button><input id="roomId" placeholder="Mã phòng"><button id="join">Vào phòng</button><p id="roomStatus">Chưa ở trong phòng</p><ul id="members"></ul></section><section><h3>Chat phòng</h3><div id="chat" style="height:150px;overflow:auto"></div><input id="chatText" maxlength="500" placeholder="Tin nhắn"><button id="chatSend">Gửi tin</button></section><script src="/socket.io/socket.io.js"></script><script>
const s=io(),$=id=>document.getElementById(id);let uid=localStorage.getItem("cp_uid");if(!uid){uid="CP-"+Array.from(crypto.getRandomValues(new Uint8Array(4))).map(x=>x.toString(16).padStart(2,"0")).join("").toUpperCase();localStorage.setItem("cp_uid",uid)}$("uid").textContent=uid;$("name").value=localStorage.getItem("cp_name")||"";let myRoom=null;
function el(tag,text){const n=document.createElement(tag);n.textContent=text;return n}
function renderRequests(items){$("incoming").replaceChildren();if(!items.length)$("incoming").append(el("li","Chưa có lời mời"));items.forEach(r=>{const li=el("li",r.fromName+" ("+r.fromUid+") ");const a=el("button","Chấp nhận"),d=el("button","Từ chối");a.onclick=()=>s.emit("request:accept",r.fromUid);d.onclick=()=>s.emit("request:decline",r.fromUid);li.append(a,d);$("incoming").append(li)})}
function renderFriends(items){$("friends").replaceChildren();if(!items.length)$("friends").append(el("li","Chưa có chiến hữu"));items.forEach(f=>$("friends").append(el("li",f.name+" — "+f.uid+" — "+(f.online?"Đang online":"Offline"))))}
function register(){const name=$("name").value.trim()||"Người chơi";localStorage.setItem("cp_name",name);s.emit("register",{uid,name})}
$("connect").onclick=register;s.on("connect",()=>{ $("status").textContent="Đã kết nối server";register() });s.on("disconnect",()=>{$("status").textContent="Mất kết nối, đang tự kết nối lại…"});
s.on("registered",d=>{renderRequests(d.requests||[]);renderFriends(d.friends||[]);$("status").textContent="Đã đăng nhập: "+uid});
s.on("requests:update",renderRequests);s.on("friends:update",renderFriends);s.on("presence:update",p=>{s.emit("profile:refresh")});
$("send").onclick=()=>s.emit("request:send",$("target").value.trim().toUpperCase());s.on("request:status",d=>$("message").textContent=d.message);s.on("server:error",m=>$("message").textContent=m);
$("create").onclick=()=>s.emit("room:create");$("join").onclick=()=>s.emit("room:join",$("roomId").value.trim().toUpperCase());
s.on("room:created",r=>{myRoom=r.id;$("roomId").value=r.id;$("roomStatus").textContent="Đã tạo phòng "+r.id;renderRoom(r)});
s.on("room:update",r=>{myRoom=r.id;$("roomStatus").textContent="Đang ở phòng "+r.id;renderRoom(r)});
s.on("room:left",()=>{myRoom=null;$("roomStatus").textContent="Đã rời phòng";$("members").replaceChildren()});
function renderRoom(r){$("members").replaceChildren();r.members.forEach(m=>$("members").append(el("li",m.name+" ("+m.uid+")")))}
$("chatSend").onclick=()=>{const text=$("chatText").value.trim();if(text&&myRoom){s.emit("room:chat",{roomId:myRoom,text});$("chatText").value=""}};
s.on("room:chat",m=>{const line=el("p","["+m.name+"] "+m.text);$("chat").append(line);$("chat").scrollTop=$("chat").scrollHeight});
</script></body></html>`));

app.get("/health", (_req, res) => res.json({ ok: true, service: "Chrono Phantom Online", uptime: Math.floor(process.uptime()), onlinePlayers: [...socketsByUid.values()].reduce((n, s) => n + (s.size ? 1 : 0), 0), rooms: rooms.size }));
app.get("/api/status", (_req, res) => res.json({ ok: true, onlinePlayers: [...profiles.keys()].filter(uid => (socketsByUid.get(uid)?.size || 0) > 0).length, rooms: [...rooms.values()].map(roomSummary) }));

io.on("connection", socket => {
  socket.on("register", data => {
    const uid = String(data?.uid || "").toUpperCase();
    if (!uidPattern.test(uid)) return socket.emit("server:error", "UID không hợp lệ.");
    const name = cleanName(data?.name);
    const oldName = profiles.get(uid)?.name;
    profiles.set(uid, { uid, name, updatedAt: Date.now() });
    socket.data.uid = uid;
    if (!socketsByUid.has(uid)) socketsByUid.set(uid, new Set());
    socketsByUid.get(uid).add(socket.id);
    socket.join("user:" + uid);
    socket.emit("registered", snapshot(uid));
    if (oldName !== name) for (const friendUid of friendSets.get(uid) || []) emitUid(friendUid, "friends:update", friendsOf(friendUid));
    refreshPresence(uid);
  });

  socket.on("profile:refresh", () => { const uid = uidOf(socket); if (uid) socket.emit("registered", snapshot(uid)); });

  socket.on("request:send", targetValue => {
    const fromUid = uidOf(socket), targetUid = String(targetValue || "").toUpperCase();
    if (!fromUid) return socket.emit("server:error", "Hãy kết nối trước.");
    if (!throttle(socket, "friend-request", 8)) return socket.emit("server:error", "Bạn gửi lời mời quá nhanh. Hãy thử lại sau.");
    if (!uidPattern.test(targetUid)) return socket.emit("request:status", { message: "UID sai định dạng." });
    if (targetUid === fromUid) return socket.emit("request:status", { message: "Bạn không thể tự kết bạn." });
    if ((friendSets.get(fromUid) || new Set()).has(targetUid)) return socket.emit("request:status", { message: "Hai người đã là chiến hữu." });
    const targetRequests = requests.get(targetUid) || new Map();
    if (targetRequests.has(fromUid)) return socket.emit("request:status", { message: "Bạn đã gửi lời mời này rồi." });
    if ((requests.get(fromUid) || new Map()).has(targetUid)) return socket.emit("request:status", { message: "Người này đã gửi lời mời cho bạn. Hãy chấp nhận lời mời đến." });
    const request = { fromUid, fromName: profiles.get(fromUid)?.name || "Người chơi", createdAt: Date.now() };
    targetRequests.set(fromUid, request); requests.set(targetUid, targetRequests);
    emitUid(targetUid, "requests:update", requestsOf(targetUid));
    socket.emit("request:status", { message: (socketsByUid.get(targetUid)?.size || 0) ? "Đã gửi lời mời; người nhận sẽ thấy ngay." : "Đã lưu lời mời trong phiên server; người nhận sẽ thấy khi kết nối." });
  });

  socket.on("request:accept", fromValue => {
    const uid = uidOf(socket), fromUid = String(fromValue || "").toUpperCase();
    if (!uid || !uidPattern.test(fromUid)) return;
    const list = requests.get(uid);
    if (!list?.has(fromUid)) return socket.emit("server:error", "Lời mời không còn tồn tại.");
    list.delete(fromUid); addFriend(uid, fromUid);
    emitUid(uid, "requests:update", requestsOf(uid)); emitUid(uid, "friends:update", friendsOf(uid));
    emitUid(fromUid, "friends:update", friendsOf(fromUid));
    emitUid(fromUid, "request:status", { message: "Lời mời kết bạn đã được chấp nhận." });
  });

  socket.on("request:decline", fromValue => {
    const uid = uidOf(socket), fromUid = String(fromValue || "").toUpperCase();
    if (!uid) return;
    requests.get(uid)?.delete(fromUid);
    emitUid(uid, "requests:update", requestsOf(uid));
    emitUid(fromUid, "request:status", { message: "Lời mời kết bạn đã bị từ chối." });
  });

  socket.on("room:create", () => {
    const uid = uidOf(socket); if (!uid) return socket.emit("server:error", "Hãy kết nối trước.");
    if (!throttle(socket, "room-create", 5)) return socket.emit("server:error", "Bạn tạo phòng quá nhanh.");
    const id = crypto.randomBytes(4).toString("hex").toUpperCase();
    const room = { id, hostUid: uid, members: new Set([uid]), createdAt: Date.now(), state: null };
    rooms.set(id, room); socket.join("room:" + id); socket.data.roomId = id;
    socket.emit("room:created", roomSummary(room));
  });

  socket.on("room:join", roomValue => {
    const uid = uidOf(socket), id = String(roomValue || "").toUpperCase(), room = rooms.get(id);
    if (!uid) return socket.emit("server:error", "Hãy kết nối trước.");
    if (!room) return socket.emit("server:error", "Không tìm thấy phòng.");
    if (room.members.size >= 4 && !room.members.has(uid)) return socket.emit("server:error", "Phòng đã đủ 4 người.");
    if (socket.data.roomId && socket.data.roomId !== id) leaveRoom(socket);
    room.members.add(uid); socket.join("room:" + id); socket.data.roomId = id;
    io.to("room:" + id).emit("room:update", roomSummary(room));
  });

  function leaveRoom(s) {
    const uid = uidOf(s), id = s.data.roomId, room = rooms.get(id);
    if (!room || !uid) return;
    s.leave("room:" + id); s.data.roomId = null;
    const stillInRoom = [...(socketsByUid.get(uid) || [])].some(sid => sid !== s.id && io.sockets.sockets.get(sid)?.data.roomId === id);
    if (!stillInRoom) room.members.delete(uid);
    if (!room.members.size) rooms.delete(id);
    else {
      if (room.hostUid === uid) room.hostUid = room.members.values().next().value;
      io.to("room:" + id).emit("room:update", roomSummary(room));
    }
    s.emit("room:left");
  }
  socket.on("room:leave", () => leaveRoom(socket));

  socket.on("room:chat", data => {
    const uid = uidOf(socket), id = socket.data.roomId, room = rooms.get(id);
    if (!uid || !room || data?.roomId !== id) return;
    if (!throttle(socket, "chat", 8)) return socket.emit("server:error", "Bạn chat quá nhanh.");
    const text = cleanText(data.text, 500); if (!text) return;
    io.to("room:" + id).emit("room:chat", { uid, name: profiles.get(uid)?.name || "Người chơi", text, at: Date.now() });
  });

  // Authoritative relay for game clients. Do not trust clients to decide rewards or permanent stats.
  socket.on("game:state", data => {
    const uid = uidOf(socket), id = socket.data.roomId, room = rooms.get(id);
    if (!uid || !room || room.hostUid !== uid || !data || typeof data !== "object") return;
    if (!throttle(socket, "game-state", 20)) return;
    const state = JSON.stringify(data);
    if (state.length > 50000) return socket.emit("server:error", "Dữ liệu trạng thái quá lớn.");
    room.state = JSON.parse(state);
    socket.to("room:" + id).emit("game:state", { fromUid: uid, state: room.state, at: Date.now() });
  });

  socket.on("game:action", data => {
    const uid = uidOf(socket), id = socket.data.roomId, room = rooms.get(id);
    if (!uid || !room || !room.members.has(uid) || !data || typeof data !== "object") return;
    if (!throttle(socket, "game-action", 15)) return;
    const payload = JSON.stringify(data);
    if (payload.length > 8000) return;
    socket.to("room:" + id).emit("game:action", { fromUid: uid, action: JSON.parse(payload), at: Date.now() });
  });

  socket.on("disconnect", () => {
    const uid = uidOf(socket);
    if (uid) {
      const set = socketsByUid.get(uid); set?.delete(socket.id);
      if (set && !set.size) socketsByUid.delete(uid);
      refreshPresence(uid);
    }
    leaveRoom(socket);
    for (const key of rateLimits.keys()) if (key.startsWith(socket.id + ":")) rateLimits.delete(key);
  });
});

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, "0.0.0.0", () => console.log("Chrono Phantom Online listening on " + PORT));
