
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const profiles = new Map();
const online = new Map();
const friends = new Map();
const requests = new Map();

function getFriends(uid) {
  return Array.from(friends.get(uid) || []).map(id => ({
    uid: id,
    name: profiles.get(id)?.name || id
  }));
}

function getRequests(uid) {
  return requests.get(uid) || [];
}

function addFriend(a, b) {
  if (!friends.has(a)) friends.set(a, new Set());
  if (!friends.has(b)) friends.set(b, new Set());
  friends.get(a).add(b);
  friends.get(b).add(a);
}

function cleanName(value) {
  return String(value || "Người chơi")
    .trim()
    .slice(0, 24) || "Người chơi";
}

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "Chrono Phantom Online" });
});

app.get("/", (req, res) => {
  res.send(`<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Chrono Phantom Online</title>
<style>
body{font-family:Arial,sans-serif;max-width:680px;margin:30px auto;padding:0 16px;background:#111827;color:#f3f4f6}
section{background:#1f2937;padding:18px;border-radius:12px;margin:16px 0}
input,button{padding:11px;margin:5px 0;border-radius:7px;border:0;max-width:100%;box-sizing:border-box}
input{width:100%;background:#374151;color:white}
button{background:#7c3aed;color:white;cursor:pointer}
li{margin:10px 0;overflow-wrap:anywhere}
small{color:#a7f3d0}
</style>
</head>
<body>
<h1>Chrono Phantom Online</h1>
<p>Thử nghiệm kết bạn trực tuyến</p>

<section>
<h3>Hồ sơ của bạn</h3>
<p>UID: <strong id="uid"></strong></p>
<input id="name" maxlength="24" placeholder="Tên người chơi">
<button id="connect">Kết nối / Lưu tên</button>
<p id="status">Đang kết nối...</p>
</section>

<section>
<h3>Gửi lời mời kết bạn</h3>
<input id="target" placeholder="Nhập UID CP-XXXXXXXX của chiến hữu">
<button id="send">Gửi lời mời</button>
<p id="message"></p>
</section>

<section>
<h3>Lời mời kết bạn đến</h3>
<ul id="incoming"><li>Chưa có lời mời</li></ul>
</section>

<section>
<h3>Chiến hữu</h3>
<ul id="friendlist"><li>Chưa có chiến hữu</li></ul>
</section>

<script src="/socket.io/socket.io.js"></script>
<script>
const socket = io();
const $ = id => document.getElementById(id);

let uid = localStorage.getItem("cp_uid");
if (!uid) {
  uid = "CP-" + Math.random().toString(36).slice(2, 10).toUpperCase();
  localStorage.setItem("cp_uid", uid);
}
$("uid").textContent = uid;
$("name").value = localStorage.getItem("cp_name") || "";

let incoming = [];
let friendData = [];

function renderRequests() {
  const list = $("incoming");
  list.replaceChildren();

  if (!incoming.length) {
    list.textContent = "Chưa có lời mời";
    return;
  }

  incoming.forEach(request => {
    const li = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = request.fromName + " (" + request.fromUid + ") ";
    li.appendChild(label);

    const accept = document.createElement("button");
    accept.textContent = "Chấp nhận";
    accept.onclick = () =>
      socket.emit("request:accept", request.fromUid);
    li.appendChild(accept);

    const decline = document.createElement("button");
    decline.textContent = "Từ chối";
    decline.onclick = () =>
      socket.emit("request:decline", request.fromUid);
    li.appendChild(decline);

    list.appendChild(li);
  });
}

function renderFriends() {
  const list = $("friendlist");
  list.replaceChildren();

  if (!friendData.length) {
    list.textContent = "Chưa có chiến hữu";
    return;
  }

  friendData.forEach(friend => {
    const li = document.createElement("li");
    li.textContent = friend.name + " — " + friend.uid;
    list.appendChild(li);
  });
}

function register() {
  const name = $("name").value.trim() || "Người chơi";
  localStorage.setItem("cp_name", name);
  socket.emit("register", { uid, name });
}

socket.on("connect", () => {
  $("status").textContent = "Đã kết nối tới server";
  register();
});

socket.on("disconnect", () => {
  $("status").textContent = "Mất kết nối, đang thử kết nối lại...";
});

$("connect").onclick = register;

$("send").onclick = () => {
  const targetUid = $("target").value.trim().toUpperCase();
  if (!targetUid) {
    $("message").textContent = "Hãy nhập UID của chiến hữu.";
    return;
  }
  socket.emit("request:send", targetUid);
};

socket.on("registered", data => {
  incoming = data.requests || [];
  friendData = data.friends || [];
  renderRequests();
  renderFriends();
  $("status").textContent = "Online với UID " + uid;
});

socket.on("requests:update", data => {
  incoming = data || [];
  renderRequests();
});

socket.on("friends:update", data => {
  friendData = data || [];
  renderFriends();
});

socket.on("request:status", data => {
  $("message").textContent = data.message;
});

socket.on("server:error", message => {
  $("message").textContent = message;
});
</script>
</body>
</html>`);
});

io.on("connection", socket => {
  socket.on("register", data => {
    const uid = String(data?.uid || "").toUpperCase();
    if (!/^CP-[A-Z0-9]{8}$/.test(uid)) {
      socket.emit("server:error", "UID không hợp lệ.");
      return;
    }

    const name = cleanName(data.name);
    socket.data.uid = uid;
    profiles.set(uid, { uid, name });
    online.set(uid, socket.id);
    socket.join(uid);

    socket.emit("registered", {
      uid,
      requests: getRequests(uid),
      friends: getFriends(uid)
    });
  });

  socket.on("request:send", targetValue => {
    const fromUid = socket.data.uid;
    const targetUid = String(targetValue || "").toUpperCase();

    if (!fromUid) {
      socket.emit("request:status", {
        message: "Hãy kết nối trước."
      });
      return;
    }

    if (!/^CP-[A-Z0-9]{8}$/.test(targetUid)) {
      socket.emit("request:status", {
        message: "UID không đúng định dạng."
      });
      return;
    }

    if (targetUid === fromUid) {
      socket.emit("request:status", {
        message: "Bạn không thể tự kết bạn với mình."
      });
      return;
    }

    if ((friends.get(fromUid) || new Set()).has(targetUid)) {
      socket.emit("request:status", {
        message: "Hai người đã là chiến hữu."
      });
      return;
    }

    const list = getRequests(targetUid);
    if (list.some(r => r.fromUid === fromUid)) {
      socket.emit("request:status", {
        message: "Bạn đã gửi lời mời trước đó."
      });
      return;
    }

    const request = {
      fromUid,
      fromName: profiles.get(fromUid)?.name || "Người chơi"
    };

    list.push(request);
    requests.set(targetUid, list);

    if (online.has(targetUid)) {
      io.to(targetUid).emit("requests:update", list);
    }

    socket.emit("request:status", {
      message: online.has(targetUid)
        ? "Đã gửi lời mời tới người đang online."
        : "Đã lưu lời mời. Người nhận sẽ thấy khi kết nối server."
    });
  });

  socket.on("request:accept", fromValue => {
    const uid = socket.data.uid;
    const fromUid = String(fromValue || "").toUpperCase();
    if (!uid || !fromUid) return;

    const list = getRequests(uid);
    if (!list.some(r => r.fromUid === fromUid)) return;

    requests.set(uid, list.filter(r => r.fromUid !== fromUid));
    addFriend(uid, fromUid);

    io.to(uid).emit("requests:update", getRequests(uid));
    io.to(uid).emit("friends:update", getFriends(uid));

    if (online.has(fromUid)) {
      io.to(fromUid).emit("friends:update", getFriends(fromUid));
      io.to(fromUid).emit("request:status", {
        message: "Lời mời kết bạn đã được chấp nhận."
      });
    }
  });

  socket.on("request:decline", fromValue => {
    const uid = socket.data.uid;
    const fromUid = String(fromValue || "").toUpperCase();
    if (!uid) return;

    requests.set(
      uid,
      getRequests(uid).filter(r => r.fromUid !== fromUid)
    );
    socket.emit("requests:update", getRequests(uid));
  });

  socket.on("disconnect", () => {
    const uid = socket.data.uid;
    if (uid && online.get(uid) === socket.id) {
      online.delete(uid);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log("Chrono Phantom Online đang chạy trên cổng " + PORT);
});
