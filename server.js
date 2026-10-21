const express = require("express");
const http = require("http");
const path = require("path");
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
  return {
    id: room.id, hostUid: room.hostUid, name: room.name || "Phòng đột kích",
    privacy: room.privacy || "public", stage: room.stage || 10, difficulty: room.difficulty || "hard",
    members: [...room.members].map(uid => {
      const p = profiles.get(uid) || {};
      return { uid, name: p.name || "Người chơi", avatar: p.avatar || "⚔️", title: p.title || "" };
    }), createdAt: room.createdAt
  };
}

app.get("/download-html", (req, res) => {
  res.download(
    path.join(__dirname, "public", "Chrono-Phantom-Online.html"),
    "Chrono-Phantom-Online.html",
    err => {
      if (err && !res.headersSent) res.status(500).send("Không thể tải tệp HTML lúc này.");
    }
  );
});

app.use(express.static(path.join(__dirname, "public")));
app.get("/health", (_req, res) => res.json({ ok: true, service: "Chrono Phantom Online", uptime: Math.floor(process.uptime()), onlinePlayers: [...socketsByUid.values()].reduce((n, s) => n + (s.size ? 1 : 0), 0), rooms: rooms.size }));
app.get("/api/status", (_req, res) => res.json({ ok: true, onlinePlayers: [...profiles.keys()].filter(uid => (socketsByUid.get(uid)?.size || 0) > 0).length, rooms: [...rooms.values()].map(roomSummary) }));

io.on("connection", socket => {
  socket.on("register", data => {
    const uid = String(data?.uid || "").toUpperCase();
    if (!uidPattern.test(uid)) return socket.emit("server:error", "UID không hợp lệ.");
    const name = cleanName(data?.name);
    const title = cleanText(data?.title, 40) || "Tân Binh Thời Không";
    const avatar = cleanText(data?.avatar, 8) || "⚔️";
    const oldName = profiles.get(uid)?.name;
    profiles.set(uid, { uid, name, title, avatar, updatedAt: Date.now() });
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

  socket.on("room:create", settings => {
    const uid = uidOf(socket); if (!uid) return socket.emit("server:error", "Hãy kết nối trước.");
    if (!throttle(socket, "room-create", 5)) return socket.emit("server:error", "Bạn tạo phòng quá nhanh.");
    if (socket.data.roomId) leaveRoom(socket);
    const id = crypto.randomBytes(4).toString("hex").toUpperCase();
    const stageValue = Number(settings?.stage);
    const room = {
      id, hostUid: uid, members: new Set([uid]), invited: new Set(), playerStates: new Map(),
      name: cleanText(settings?.name, 32) || "Phòng đột kích",
      privacy: settings?.privacy === "private" ? "private" : "public",
      stage: Number.isInteger(stageValue) && stageValue >= 1 && stageValue <= 10 ? stageValue : 10,
      difficulty: ["normal","hard","abyss"].includes(settings?.difficulty) ? settings.difficulty : "hard",
      createdAt: Date.now(), state: null, boss: null, started: false
    };
    rooms.set(id, room); socket.join("room:" + id); socket.data.roomId = id;
    socket.emit("room:created", roomSummary(room));
  });

  socket.on("room:invite", targetValue => {
    const uid = uidOf(socket), room = rooms.get(socket.data.roomId);
    const targetUid = String(targetValue || "").toUpperCase();
    if (!uid || !room) return socket.emit("server:error", "Hãy tạo hoặc vào phòng trước.");
    if (!uidPattern.test(targetUid) || targetUid === uid) return socket.emit("server:error", "UID chiến hữu không hợp lệ.");
    if (!(friendSets.get(uid) || new Set()).has(targetUid)) return socket.emit("server:error", "Bạn chỉ có thể mời người trong danh sách chiến hữu.");
    if (room.members.size >= 4) return socket.emit("server:error", "Phòng đã đủ 4 người.");
    room.invited.add(targetUid);
    emitUid(targetUid, "room:invite", { room: roomSummary(room), fromUid: uid, fromName: profiles.get(uid)?.name || "Chiến hữu" });
    socket.emit("room:invite:status", { message: (socketsByUid.get(targetUid)?.size || 0) ? "Đã gửi lời mời vào phòng." : "Chiến hữu đang offline; hãy mời khi họ online." });
  });

  socket.on("room:join", roomValue => {
    const uid = uidOf(socket), id = String(roomValue || "").toUpperCase(), room = rooms.get(id);
    if (!uid) return socket.emit("server:error", "Hãy kết nối trước.");
    if (!room) return socket.emit("server:error", "Không tìm thấy phòng.");
    if (room.privacy === "private" && !room.members.has(uid) && !room.invited.has(uid)) return socket.emit("server:error", "Phòng riêng tư cần lời mời từ chủ phòng.");
    if (room.members.size >= 4 && !room.members.has(uid)) return socket.emit("server:error", "Phòng đã đủ 4 người.");
    if (socket.data.roomId && socket.data.roomId !== id) leaveRoom(socket);
    room.members.add(uid); room.invited.delete(uid); socket.join("room:" + id); socket.data.roomId = id;
    socket.emit("room:update", roomSummary(room));
    io.to("room:" + id).emit("room:update", roomSummary(room));
    if (room.started && room.boss) {
      socket.emit("room:game:start", { roomId: room.id, stage: room.stage, difficulty: room.difficulty, startedAt: room.startedAt || Date.now() });
      socket.emit("boss:state", { roomId: room.id, ...room.boss });
    }
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

  socket.on("room:start", () => {
    const uid = uidOf(socket), room = rooms.get(socket.data.roomId);
    if (!uid || !room) return socket.emit("server:error", "Hãy vào phòng trước.");
    if (room.hostUid !== uid) return socket.emit("server:error", "Chỉ chủ phòng mới có thể bắt đầu.");
    room.boss = null;
    room.state = null;
    room.started = true;
    room.playerStates.clear();
    io.to("room:" + room.id).emit("room:game:start", { roomId: room.id, stage: room.stage, difficulty: room.difficulty, startedAt: Date.now() });
  });

  socket.on("friend:remove", targetValue => {
    const uid = uidOf(socket), targetUid = String(targetValue || "").toUpperCase();
    if (!uid || !uidPattern.test(targetUid)) return;
    friendSets.get(uid)?.delete(targetUid);
    friendSets.get(targetUid)?.delete(uid);
    emitUid(uid, "friends:update", friendsOf(uid));
    emitUid(targetUid, "friends:update", friendsOf(targetUid));
  });

  socket.on("room:chat", data => {
    const uid = uidOf(socket), id = socket.data.roomId, room = rooms.get(id);
    if (!uid || !room || data?.roomId !== id) return;
    if (!throttle(socket, "chat", 8)) return socket.emit("server:error", "Bạn chat quá nhanh.");
    const text = cleanText(data.text, 500); if (!text) return;
    io.to("room:" + id).emit("room:chat", { uid, name: profiles.get(uid)?.name || "Người chơi", text, at: Date.now() });
  });

  // Shared boss state is stored on the server. The host owns AI/position; server owns shared HP.
  socket.on("boss:init", data => {
    const uid = uidOf(socket), room = rooms.get(socket.data.roomId);
    if (!uid || !room || room.hostUid !== uid || !room.started || !data || typeof data !== "object") return;
    const maxHp = Number(data.maxHp), hp = Number(data.hp);
    if (!Number.isFinite(maxHp) || maxHp < 1 || maxHp > 100000000 || !Number.isFinite(hp)) return;
    room.boss = {
      stage: room.stage,
      hp: Math.max(0, Math.min(maxHp, hp)),
      maxHp,
      alive: hp > 0,
      x: Number.isFinite(Number(data.x)) ? Math.max(-50, Math.min(2000, Number(data.x))) : 390,
      y: Number.isFinite(Number(data.y)) ? Math.max(-20, Math.min(700, Number(data.y))) : 500,
      facing: Number(data.facing) < 0 ? -1 : 1,
      isEnraged: !!data.isEnraged,
      isShootingLaser: !!data.isShootingLaser,
      isJumping: !!data.isJumping,
      attackWarning: !!data.attackWarning,
      attackPattern: Number(data.attackPattern) || 0,
      animTimer: Number(data.animTimer) || 0,
      attackTimer: Number(data.attackTimer) || 0,
      laserTimer: Number(data.laserTimer) || 0,
      jumpTimer: Number(data.jumpTimer) || 0
    };
    room.state = { kind: "boss", boss: room.boss };
    io.to("room:" + room.id).emit("boss:state", { roomId: room.id, ...room.boss });
  });

  socket.on("boss:damage", data => {
    const uid = uidOf(socket), room = rooms.get(socket.data.roomId);
    if (!uid || !room || !room.started || !room.members.has(uid) || !room.boss || !room.boss.alive) return;
    if (!throttle(socket, "boss-damage", 100, 10000)) return;
    const amount = Number(data?.damage);
    if (!Number.isFinite(amount) || amount <= 0) return;
    room.boss.hp = Math.max(0, room.boss.hp - Math.min(500000, Math.round(amount)));
    room.boss.alive = room.boss.hp > 0;
    room.state = { kind: "boss", boss: room.boss };
    io.to("room:" + room.id).emit("boss:state", { roomId: room.id, ...room.boss, lastDamager: uid, damage: Math.min(500000, Math.round(amount)) });
  });

  // Relay bounded player movement/animation snapshots to other party members.
  socket.on("player:state", data => {
    const uid = uidOf(socket), id = socket.data.roomId, room = rooms.get(id);
    if (!uid || !room || !room.members.has(uid) || !data || typeof data !== "object") return;
    if (!throttle(socket, "player-state", 100, 10000)) return;
    const x = Number(data.x), y = Number(data.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const p = {
      uid, name: profiles.get(uid)?.name || "Người chơi", avatar: profiles.get(uid)?.avatar || "⚔️",
      x: Math.max(-50, Math.min(2000, x)), y: Math.max(-20, Math.min(700, y)),
      vx: Math.max(-400, Math.min(400, Number(data.vx) || 0)),
      facing: Number(data.facing) < 0 ? -1 : 1,
      state: ["IDLE","RUN","ATTACK","PARRY"].includes(data.state) ? data.state : "IDLE",
      animTimer: Math.max(0, Math.min(10000, Number(data.animTimer) || 0)),
      animFrame: Math.max(0, Math.min(100, Number(data.animFrame) || 0)),
      attackStep: Math.max(0, Math.min(20, Number(data.attackStep) || 0)),
      hp: Math.max(0, Math.min(10000000, Number(data.hp) || 0)),
      maxHp: Math.max(1, Math.min(10000000, Number(data.maxHp) || 1)),
      selectedCharacter: cleanText(data.selectedCharacter, 40),
      weapon: data.weapon && typeof data.weapon === "object" ? {
        id: cleanText(data.weapon.id, 40),
        level: Math.max(1, Math.min(100, Number(data.weapon.level) || 1))
      } : null,
      at: Date.now()
    };
    room.playerStates.set(uid, p);
    socket.to("room:" + id).emit("player:state", p);
  });

  // Authoritative relay for game clients. Do not trust clients to decide rewards or permanent stats.
  socket.on("game:state", data => {
    const uid = uidOf(socket), id = socket.data.roomId, room = rooms.get(id);
    if (!uid || !room || room.hostUid !== uid || !data || typeof data !== "object") return;
    if (!throttle(socket, "game-state", 50, 10000)) return;
    const state = JSON.stringify(data);
    if (state.length > 50000) return socket.emit("server:error", "Dữ liệu trạng thái quá lớn.");
    const decoded = JSON.parse(state);
    if (decoded.kind === "boss" && room.boss) {
      const b = decoded.boss || {};
      const hostHp = Number(b.hp);
      // Host synchronizes animation and position only; shared HP remains server-authoritative.
      if (Number.isFinite(Number(b.x))) room.boss.x = Math.max(-50, Math.min(2000, Number(b.x)));
      if (Number.isFinite(Number(b.y))) room.boss.y = Math.max(-20, Math.min(700, Number(b.y)));
      if (Number.isFinite(Number(b.facing))) room.boss.facing = Number(b.facing) < 0 ? -1 : 1;
      for (const key of ["isEnraged","isShootingLaser","isJumping","attackWarning"]) room.boss[key] = !!b[key];
      for (const key of ["attackPattern","animTimer","attackTimer","laserTimer","jumpTimer"]) if (Number.isFinite(Number(b[key]))) room.boss[key] = Number(b[key]);
      // Prevent a stale host snapshot from healing boss HP after server damage was applied.
      room.boss.hp = Math.min(room.boss.hp, room.boss.maxHp);
      room.boss.alive = room.boss.hp > 0;
      room.state = {kind:"boss", boss:room.boss};
      io.to("room:" + id).emit("boss:state", {roomId:room.id, ...room.boss});
    } else {
      room.state = decoded;
      socket.to("room:" + id).emit("game:state", { fromUid: uid, state: room.state, at: Date.now() });
    }
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
