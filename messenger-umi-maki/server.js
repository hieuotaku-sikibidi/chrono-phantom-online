'use strict';
const crypto = require('crypto');
const http = require('http');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const { newDb, DataType } = require('pg-mem');
const { Server } = require('socket.io');

const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET;
const DATABASE_URL = process.env.DATABASE_URL;
const AUTH_COOKIE = 'umi_auth';
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 12);
if (!JWT_SECRET || JWT_SECRET.length < 32) { console.error('JWT_SECRET must be at least 32 characters'); process.exit(1); }

let pool;
if (DATABASE_URL) {
  pool = new Pool({ connectionString: DATABASE_URL, ssl: process.env.PGSSLMODE === 'disable' || process.env.NODE_ENV !== 'production' ? false : { rejectUnauthorized: false }, max: 10, idleTimeoutMillis: 30000, connectionTimeoutMillis: 10000 });
} else if (process.env.ALLOW_EPHEMERAL_DB === 'true') {
  const memoryDb = newDb({ autoCreateForeignKeyIndices: true });
  memoryDb.public.registerFunction({ name: 'gen_random_uuid', returns: DataType.uuid, implementation: () => crypto.randomUUID() });
  const memoryAdapter = memoryDb.adapters.createPg();
  pool = new memoryAdapter.Pool();
  console.warn('WARNING: using ephemeral in-memory database; all accounts and messages reset on service restart or redeploy.');
} else {
  console.error('Missing DATABASE_URL. Configure PostgreSQL or explicitly enable ALLOW_EPHEMERAL_DB=true for a temporary demo.');
  process.exit(1);
}
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 64 * 1024,
  allowRequest: (req, callback) => {
    const origin = req.headers.origin;
    if (!origin) return callback(null, true);
    try {
      const parsed = new URL(origin);
      if (parsed.host === req.headers.host && (parsed.protocol === 'https:' || parsed.protocol === 'http:')) return callback(null, true);
    } catch {}
    return callback('Origin not allowed', false);
  }
});
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", 'data:'], connectSrc: ["'self'", 'ws:', 'wss:'], fontSrc: ["'self'", 'data:'], objectSrc: ["'none'"], baseUri: ["'self'"], frameAncestors: ["'none'"] } }, crossOriginEmbedderPolicy: false }));
app.use(express.json({ limit: '750kb' }));
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false });
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-7', legacyHeaders: false });
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.get('origin')) {
    try {
      const origin = new URL(req.get('origin'));
      if (origin.host !== req.get('host') || !['https:', 'http:'].includes(origin.protocol)) {
        return res.status(403).json({ error: 'Nguồn yêu cầu không hợp lệ.' });
      }
    } catch {
      return res.status(403).json({ error: 'Nguồn yêu cầu không hợp lệ.' });
    }
  }
  next();
});
const activeSockets = new Map();
const activeCalls = new Map();
const callTimers = new Map();
const roomFor = id => 'user:' + id;
function validUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function callFor(userId, callId) {
  const call = activeCalls.get(userId);
  return call && call.callId === callId ? call : null;
}
function closeCall(userId, callId, eventName, extra = {}) {
  const call = callFor(userId, callId);
  if (!call) return false;
  const timer = callTimers.get(callId);
  if (timer) clearTimeout(timer);
  callTimers.delete(callId);
  const peerId = call.peerId;
  activeCalls.delete(userId);
  const peerCall = callFor(peerId, callId);
  if (peerCall) activeCalls.delete(peerId);
  io.to(roomFor(peerId)).emit(eventName, { callId, from: userId, ...extra });
  return true;
}
const sql = (text, values = []) => pool.query(text, values);
const normalizedPair = (a,b) => a.localeCompare(b) < 0 ? [a,b] : [b,a];

async function initDb() {
  await sql("CREATE TABLE IF NOT EXISTS users (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), public_id VARCHAR(16) UNIQUE NOT NULL, username VARCHAR(24) UNIQUE NOT NULL, display_name VARCHAR(32) NOT NULL, bio VARCHAR(180) NOT NULL DEFAULT '', avatar TEXT, password_hash TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()); CREATE TABLE IF NOT EXISTS friendships (user_a UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, user_b UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, status VARCHAR(12) NOT NULL CHECK (status IN ('pending','accepted')), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(user_a,user_b), CHECK(user_a < user_b), CHECK(requested_by=user_a OR requested_by=user_b)); CREATE TABLE IF NOT EXISTS messages (id BIGSERIAL PRIMARY KEY, sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, text VARCHAR(2000) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), CHECK(sender_id<>recipient_id)); CREATE INDEX IF NOT EXISTS idx_friendships_a_status ON friendships(user_a,status); CREATE INDEX IF NOT EXISTS idx_friendships_b_status ON friendships(user_b,status); CREATE INDEX IF NOT EXISTS idx_messages_sender_recipient_time ON messages(sender_id,recipient_id,created_at DESC); CREATE INDEX IF NOT EXISTS idx_messages_recipient_sender_time ON messages(recipient_id,sender_id,created_at DESC)");
}
function safeUser(row) { return row ? { id: row.id, publicId: row.public_id, username: row.username, displayName: row.display_name, bio: row.bio || '', avatar: row.avatar || null, createdAt: row.created_at } : null; }
function readCookie(header, name) {
  for (const item of String(header || '').split(';')) {
    const index = item.indexOf('=');
    if (index < 0 || item.slice(0, index).trim() !== name) continue;
    try { return decodeURIComponent(item.slice(index + 1).trim()); } catch { return ''; }
  }
  return '';
}
function authCookie(token, maxAge = 604800) {
  const parts = [AUTH_COOKIE + '=' + encodeURIComponent(token), 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=' + maxAge];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
}
function tokenFor(user) {
  return jwt.sign({ sub: user.id }, JWT_SECRET, {
    algorithm: 'HS256', expiresIn: '7d', issuer: 'umi-maki-messenger', audience: 'umi-maki-web'
  });
}
function verifiedPayload(token) {
  return jwt.verify(token, JWT_SECRET, {
    algorithms: ['HS256'], issuer: 'umi-maki-messenger', audience: 'umi-maki-web'
  });
}
function auth(req,res,next) {
  const header = req.headers.authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
  const token = bearer || readCookie(req.headers.cookie, AUTH_COOKIE);
  if (!token) return res.status(401).json({ error: 'Bạn cần đăng nhập để tiếp tục.' });
  try {
    const payload = verifiedPayload(token);
    if (typeof payload.sub !== 'string') throw new Error('Invalid subject');
    req.userId = payload.sub;
    return next();
  } catch {
    return res.status(401).json({ error: 'Phiên đăng nhập hết hạn. Hãy đăng nhập lại.' });
  }
}
const route = fn => (req,res,next) => Promise.resolve(fn(req,res,next)).catch(next);
async function getUser(id) { const r = await sql('SELECT id,public_id,username,display_name,bio,avatar,created_at FROM users WHERE id=$1',[id]); return safeUser(r.rows[0]); }
async function areFriends(a,b) {
  if (!a || !b || a === b) return false;
  const [low,high] = normalizedPair(a,b);
  const r = await sql("SELECT 1 FROM friendships WHERE user_a=$1 AND user_b=$2 AND status='accepted'",[low,high]);
  return r.rowCount > 0;
}
async function refreshFriends(ids) { for (const id of new Set(ids.filter(Boolean))) io.to(roomFor(id)).emit('friends:refresh'); }
async function sendPresence(userId,online) {
  const r = await sql("SELECT user_a,user_b FROM friendships WHERE (user_a=$1 OR user_b=$1) AND status='accepted'", [userId]);
  for (const row of r.rows) {
    const otherId = row.user_a === userId ? row.user_b : row.user_a;
    io.to(roomFor(otherId)).emit('presence:update', { userId, online });
  }
}


app.get('/api/health',(_req,res) => res.json({ok:true,service:'Messenger Umi and Maki'}));
app.post('/api/auth/register',registerLimiter,route(async(req,res) => {
  const displayName = typeof req.body.displayName === 'string' ? req.body.displayName.trim() : '';
  const username = typeof req.body.username === 'string' ? req.body.username.trim().replace(/^@/,'').toLowerCase() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (displayName.length < 1 || displayName.length > 32) return res.status(400).json({error:'Tên hiển thị phải từ 1 đến 32 ký tự.'});
  if (!/^[a-z0-9._]{3,24}$/.test(username)) return res.status(400).json({error:'Username cần 3–24 ký tự: chữ thường, số, dấu chấm hoặc gạch dưới.'});
  if (password.length < 8 || password.length > 128) return res.status(400).json({error:'Mật khẩu cần từ 8 đến 128 ký tự.'});
  const passwordHash = await bcrypt.hash(password,12);
  let row = null;
  for (let i=0;i<5;i++) {
    const publicId = 'UM-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    try {
      const r = await sql('INSERT INTO users(id,public_id,username,display_name,password_hash) VALUES($1,$2,$3,$4,$5) RETURNING id,public_id,username,display_name,bio,avatar,created_at',[crypto.randomUUID(),publicId,username,displayName,passwordHash]);
      row = r.rows[0]; break;
    } catch(e) {
      if (e.code === '23505' && String(e.constraint || '').includes('username')) return res.status(409).json({error:'Username đã được sử dụng. Hãy chọn tên khác.'});
      if (e.code === '23505' && i < 4) continue;
      throw e;
    }
  }
  if (!row) return res.status(500).json({error:'Chưa tạo được tài khoản. Thử lại nhé.'});
  const user = safeUser(row);
  res.setHeader('Set-Cookie', authCookie(tokenFor(user)));
  return res.status(201).json({user});
}));
app.post('/api/auth/login',authLimiter,route(async(req,res) => {
  const identifier = typeof req.body.identifier === 'string' ? req.body.identifier.trim().replace(/^@/,'').toLowerCase() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!identifier || !password) return res.status(400).json({error:'Nhập username hoặc ID cùng mật khẩu.'});
  const r = await sql('SELECT id,public_id,username,display_name,bio,avatar,password_hash,created_at FROM users WHERE LOWER(username)=$1 OR LOWER(public_id)=$1 LIMIT 1',[identifier]);
  const candidateHash = r.rowCount ? r.rows[0].password_hash : DUMMY_PASSWORD_HASH;
  const passwordMatches = await bcrypt.compare(password, candidateHash);
  if (!r.rowCount || !passwordMatches) return res.status(401).json({error:'Tên đăng nhập/ID hoặc mật khẩu chưa đúng.'});
  const user = safeUser(r.rows[0]);
  res.setHeader('Set-Cookie', authCookie(tokenFor(user)));
  return res.json({user});
}));
app.post('/api/auth/logout', (_req,res) => {
  res.setHeader('Set-Cookie', authCookie('', 0));
  return res.json({ok:true});
});
app.get('/api/me',auth,route(async(req,res) => { const user = await getUser(req.userId); return user ? res.json({user}) : res.status(404).json({error:'Không tìm thấy tài khoản.'}); }));
app.patch('/api/me',auth,route(async(req,res) => {
  const old = await getUser(req.userId);
  if (!old) return res.status(404).json({error:'Không tìm thấy tài khoản.'});
  const displayName = req.body.displayName === undefined ? old.displayName : (typeof req.body.displayName === 'string' ? req.body.displayName.trim() : '');
  const bio = req.body.bio === undefined ? old.bio : (typeof req.body.bio === 'string' ? req.body.bio.trim() : '');
  const avatar = req.body.avatar === undefined ? old.avatar : req.body.avatar;
  if (!displayName || displayName.length > 32) return res.status(400).json({error:'Tên hiển thị phải từ 1 đến 32 ký tự.'});
  if (bio.length > 180) return res.status(400).json({error:'Giới thiệu tối đa 180 ký tự.'});
  if (avatar !== null && avatar !== '' && (typeof avatar !== 'string' || avatar.length > 600000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(avatar))) return res.status(400).json({error:'Ảnh không hợp lệ hoặc quá lớn. Chọn ảnh dưới khoảng 400 KB.'});
  const r = await sql('UPDATE users SET display_name=$1,bio=$2,avatar=$3,updated_at=NOW() WHERE id=$4 RETURNING id,public_id,username,display_name,bio,avatar,created_at',[displayName,bio,avatar || null,req.userId]);
  const user = safeUser(r.rows[0]);
  io.to(roomFor(req.userId)).emit('profile:refresh',{user});
  const links = await sql("SELECT user_a,user_b FROM friendships WHERE (user_a=$1 OR user_b=$1) AND status='accepted'", [req.userId]);
  const affected = [req.userId, ...links.rows.map(row => row.user_a === req.userId ? row.user_b : row.user_a)];
  await refreshFriends(affected);
  return res.json({user});
}));
app.get('/api/users/search',auth,route(async(req,res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim().replace(/^@/,'') : '';
  if (q.length < 2) return res.json({users:[]});
  if (q.length > 64) return res.status(400).json({error:'Từ khóa tìm kiếm quá dài.'});
  const r = await sql("SELECT id,public_id,username,display_name,bio,avatar,created_at FROM users WHERE id<>$1 AND (LOWER(public_id)=LOWER($2) OR username ILIKE $3 OR display_name ILIKE $3) ORDER BY display_name LIMIT 25", [req.userId,q,'%'+q+'%']);
  const users = await Promise.all(r.rows.map(async row => {
    const [low,high] = normalizedPair(req.userId,row.id);
    const fr = await sql('SELECT status,requested_by FROM friendships WHERE user_a=$1 AND user_b=$2 LIMIT 1', [low,high]);
    let relationship = 'none';
    if (fr.rowCount && fr.rows[0].status === 'accepted') relationship = 'friend';
    else if (fr.rowCount && fr.rows[0].requested_by === req.userId) relationship = 'outgoing';
    else if (fr.rowCount) relationship = 'incoming';
    return { ...safeUser(row), relationship };
  }));
  users.sort((a,b) => {
    const rank = user => user.publicId.toLowerCase() === q.toLowerCase() ? 0 : user.username.toLowerCase() === q.toLowerCase() ? 1 : 2;
    return rank(a)-rank(b) || a.displayName.localeCompare(b.displayName);
  });
  return res.json({users});
}));


app.get('/api/friends',auth,route(async(req,res) => {
  const r = await sql("SELECT user_a,user_b,updated_at FROM friendships WHERE (user_a=$1 OR user_b=$1) AND status='accepted'", [req.userId]);
  const friends = await Promise.all(r.rows.map(async row => {
    const id = row.user_a === req.userId ? row.user_b : row.user_a;
    const user = await getUser(id);
    if (!user) return null;
    const message = await sql("SELECT text,created_at FROM messages WHERE (sender_id=$1 AND recipient_id=$2) OR (sender_id=$2 AND recipient_id=$1) ORDER BY created_at DESC LIMIT 1", [req.userId,id]);
    return { ...user, online:(activeSockets.get(id)||0)>0, lastMessage:message.rowCount?message.rows[0].text:'', lastMessageAt:message.rowCount?message.rows[0].created_at:row.updated_at };
  }));
  friends.sort((a,b)=>new Date(b.lastMessageAt)-new Date(a.lastMessageAt));
  return res.json({friends:friends.filter(Boolean)});
}));


app.get('/api/friends/requests',auth,route(async(req,res) => {
  const r = await sql("SELECT user_a,user_b,requested_by,created_at AS requested_at FROM friendships WHERE (user_a=$1 OR user_b=$1) AND status='pending' ORDER BY created_at DESC", [req.userId]);
  const incoming=[],outgoing=[];
  for (const row of r.rows) {
    const otherId = row.user_a === req.userId ? row.user_b : row.user_a;
    const user = await getUser(otherId);
    if (!user) continue;
    const item = { ...user, requestedAt:row.requested_at };
    (row.requested_by === req.userId ? outgoing : incoming).push(item);
  }
  return res.json({incoming,outgoing});
}));


app.post('/api/friends/request',auth,route(async(req,res) => {
  const targetId = typeof req.body.userId === 'string' ? req.body.userId : '';
  if (!targetId || targetId===req.userId) return res.status(400).json({error:'ID người dùng không hợp lệ.'});
  if (!(await getUser(targetId))) return res.status(404).json({error:'Không tìm thấy người dùng.'});
  const [a,b]=normalizedPair(req.userId,targetId);
  const client=await pool.connect();
  let status='pending';
  try {
    await client.query('BEGIN');
    const old=await client.query('SELECT status,requested_by FROM friendships WHERE user_a=$1 AND user_b=$2',[a,b]);
    if (old.rowCount && old.rows[0].status==='accepted') { await client.query('ROLLBACK'); return res.status(409).json({error:'Hai bạn đã là bạn bè.'}); }
    if (old.rowCount && old.rows[0].status==='pending' && old.rows[0].requested_by!==req.userId) {
      await client.query("UPDATE friendships SET status='accepted',updated_at=NOW() WHERE user_a=$1 AND user_b=$2",[a,b]); status='accepted';
    } else if (old.rowCount) { await client.query('ROLLBACK'); return res.status(409).json({error:'Bạn đã gửi lời mời cho người này rồi.'}); }
    else await client.query("INSERT INTO friendships(user_a,user_b,requested_by,status) VALUES($1,$2,$3,'pending')",[a,b,req.userId]);
    await client.query('COMMIT');
  } catch(e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  await refreshFriends([req.userId,targetId]);
  if(status==='accepted') await sendPresence(targetId,(activeSockets.get(targetId)||0)>0);
  return res.status(201).json({ok:true,status,message:status==='accepted'?'Hai bạn đã trở thành bạn bè!':'Đã gửi lời mời kết bạn.'});
}));
app.post('/api/friends/:otherId/accept',auth,route(async(req,res) => {
  const otherId=req.params.otherId; const [a,b]=normalizedPair(req.userId,otherId);
  const r=await sql("UPDATE friendships SET status='accepted',updated_at=NOW() WHERE user_a=$1 AND user_b=$2 AND status='pending' AND requested_by=$3 RETURNING user_a",[a,b,otherId]);
  if(!r.rowCount) return res.status(404).json({error:'Không tìm thấy lời mời từ người này.'});
  await refreshFriends([req.userId,otherId]); await sendPresence(otherId,(activeSockets.get(otherId)||0)>0);
  return res.json({ok:true});
}));
app.delete('/api/friends/:otherId',auth,route(async(req,res) => {
  const otherId=req.params.otherId; if(!otherId||otherId===req.userId) return res.status(400).json({error:'ID không hợp lệ.'});
  const [a,b]=normalizedPair(req.userId,otherId);
  const r=await sql('DELETE FROM friendships WHERE user_a=$1 AND user_b=$2 RETURNING user_a',[a,b]);
  if(!r.rowCount) return res.status(404).json({error:'Không tìm thấy lời mời hoặc bạn bè này.'});
  await refreshFriends([req.userId,otherId]); return res.json({ok:true});
}));
app.get('/api/messages/:otherId',auth,route(async(req,res) => {
  const otherId=req.params.otherId;
  if(!(await areFriends(req.userId,otherId))) return res.status(403).json({error:'Chỉ bạn bè đã chấp nhận mới có thể nhắn tin.'});
  const r=await sql('SELECT id,sender_id,recipient_id,text,created_at FROM messages WHERE (sender_id=$1 AND recipient_id=$2) OR (sender_id=$2 AND recipient_id=$1) ORDER BY created_at DESC LIMIT 100',[req.userId,otherId]);
  return res.json({messages:r.rows.reverse().map(row=>({id:String(row.id),senderId:row.sender_id,recipientId:row.recipient_id,text:row.text,createdAt:row.created_at}))});
}));
app.use(express.static(path.join(__dirname,'public'),{extensions:['html']}));
app.get('*',(_req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));

io.use(async(socket,next)=>{
  try {
    const authToken=socket.handshake.auth&&socket.handshake.auth.token;
    const token=authToken || readCookie(socket.handshake.headers.cookie, AUTH_COOKIE);
    if(!token) return next(new Error('UNAUTHORIZED'));
    const payload=verifiedPayload(token);
    if(!(await getUser(payload.sub))) return next(new Error('UNAUTHORIZED'));
    socket.userId=payload.sub; return next();
  } catch { return next(new Error('UNAUTHORIZED')); }
});
io.on('connection',async socket=>{
  const userId=socket.userId; socket.join(roomFor(userId)); activeSockets.set(userId,(activeSockets.get(userId)||0)+1);
  if(activeSockets.get(userId)===1) await sendPresence(userId,true).catch(()=>{});
  socket.emit('presence:initial',[...activeSockets.keys()].filter(id=>id!==userId));
  socket.on('presence:list',()=>socket.emit('presence:initial',[...activeSockets.keys()].filter(id=>id!==userId)));
  socket.on('call:invite', async (payload, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    try {
      const to = payload && payload.to;
      const callId = payload && payload.callId;
      const mode = payload && payload.mode;
      if (!validUuid(to) || to === userId || !validUuid(callId) || !['audio','video'].includes(mode)) {
        return reply({ok:false,error:'Thông tin cuộc gọi không hợp lệ.'});
      }
      if (!await areFriends(userId, to)) return reply({ok:false,error:'Chỉ có thể gọi người đã kết bạn.'});
      if (!(activeSockets.get(to) > 0)) return reply({ok:false,error:'Người này hiện không trực tuyến.'});
      if (activeCalls.has(userId) || activeCalls.has(to)) return reply({ok:false,error:'Một trong hai người đang có cuộc gọi khác.'});
      const caller = await getUser(userId);
      if (!caller) return reply({ok:false,error:'Không tìm thấy tài khoản gọi.'});
      activeCalls.set(userId, {callId, peerId:to, mode, status:'ringing', isCaller:true});
      activeCalls.set(to, {callId, peerId:userId, mode, status:'ringing', isCaller:false});
      const timer = setTimeout(() => {
        const current = callFor(userId, callId);
        if (!current || current.status !== 'ringing') return;
        const targetId = current.peerId;
        activeCalls.delete(userId);
        if (callFor(targetId, callId)) activeCalls.delete(targetId);
        callTimers.delete(callId);
        io.to(roomFor(userId)).to(roomFor(targetId)).emit('call:ended', {callId, from:null, reason:'no-answer'});
      }, 45000);
      if (typeof timer.unref === 'function') timer.unref();
      callTimers.set(callId, timer);
      io.to(roomFor(to)).emit('call:incoming', {callId, mode, caller});
      return reply({ok:true});
    } catch (error) {
      console.error('call:invite failed:', error && error.code ? error.code : 'UnknownError');
      return reply({ok:false,error:'Chưa gửi được lời mời gọi.'});
    }
  });
  socket.on('call:accept', async (payload, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    const callId = payload && payload.callId;
    const own = callFor(userId, callId);
    if (!own || own.status !== 'ringing' || own.isCaller) return reply({ok:false,error:'Chỉ người nhận mới có thể chấp nhận cuộc gọi.'});
    const timer = callTimers.get(callId);
    if (timer) clearTimeout(timer);
    callTimers.delete(callId);
    own.status = 'connecting';
    const peer = callFor(own.peerId, callId);
    if (!peer) { closeCall(userId, callId, 'call:ended', {reason:'missing'}); return reply({ok:false,error:'Người gọi đã rời cuộc gọi.'}); }
    peer.status = 'connecting';
    io.to(roomFor(own.peerId)).emit('call:accepted', {callId, peer: await getUser(userId).catch(() => null)});
    return reply({ok:true});
  });
  socket.on('call:signal', (payload, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    const callId = payload && payload.callId;
    const to = payload && payload.to;
    const kind = payload && payload.kind;
    const own = callFor(userId, callId);
    const other = callFor(to, callId);
    if (!own || own.peerId !== to || !other || own.status !== 'connecting' || other.status !== 'connecting') return reply({ok:false,error:'Không tìm thấy cuộc gọi đã được chấp nhận.'});
    if (kind === 'offer' || kind === 'answer') {
      const description = payload && payload.description;
      if (!description || !['offer','answer'].includes(description.type) || typeof description.sdp !== 'string' || description.sdp.length > 50000) {
        return reply({ok:false,error:'Thông tin kết nối không hợp lệ.'});
      }
      io.to(roomFor(to)).emit('call:signal', {callId, from:userId, kind, description});
      return reply({ok:true});
    }
    if (kind === 'ice') {
      const candidate = payload && payload.candidate;
      if (!candidate || typeof candidate.candidate !== 'string' || candidate.candidate.length > 2048) return reply({ok:false,error:'Thông tin mạng không hợp lệ.'});
      io.to(roomFor(to)).emit('call:signal', {callId, from:userId, kind, candidate});
      return reply({ok:true});
    }
    return reply({ok:false,error:'Loại tín hiệu cuộc gọi không hợp lệ.'});
  });
  socket.on('call:decline', (payload) => {
    const callId = payload && payload.callId;
    const reason = payload && typeof payload.reason === 'string' ? payload.reason.slice(0,40) : 'declined';
    closeCall(userId, callId, 'call:declined', {reason});
  });
  socket.on('call:end', (payload) => {
    const callId = payload && payload.callId;
    closeCall(userId, callId, 'call:ended', {reason:'hangup'});
  });
  const messageTimestamps = [];
  socket.on('message:send',async(payload,ack)=>{
    const reply=typeof ack==='function'?ack:()=>{};
    const now = Date.now();
    while (messageTimestamps.length && now - messageTimestamps[0] > 10000) messageTimestamps.shift();
    if (messageTimestamps.length >= 20) return reply({ok:false,error:'Bạn đang gửi quá nhanh. Hãy chờ một chút nhé.'});
    messageTimestamps.push(now);
    try {
      const to=payload&&typeof payload.to==='string'?payload.to:'';
      const text=payload&&typeof payload.text==='string'?payload.text.trim():'';
      if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(to)||text.length<1||text.length>2000) return reply({ok:false,error:'Tin nhắn cần có nội dung hợp lệ và tối đa 2000 ký tự.'});
      if(!(await areFriends(userId,to))) return reply({ok:false,error:'Hai bạn cần kết bạn trước khi nhắn tin.'});
      const r=await sql('INSERT INTO messages(sender_id,recipient_id,text) VALUES($1,$2,$3) RETURNING id,sender_id,recipient_id,text,created_at',[userId,to,text]);
      const row=r.rows[0]; const message={id:String(row.id),senderId:row.sender_id,recipientId:row.recipient_id,text:row.text,createdAt:row.created_at};
      io.to(roomFor(userId)).to(roomFor(to)).emit('message:new',message); reply({ok:true});
    } catch(e) { console.error('message:send failed:',e.message); reply({ok:false,error:'Chưa gửi được tin nhắn. Thử lại nhé.'}); }
  });
  socket.on('disconnect',async()=>{
    const activeCall = activeCalls.get(userId);
    if (activeCall) closeCall(userId, activeCall.callId, 'call:ended', {reason:'disconnected'});
    const count=Math.max(0,(activeSockets.get(userId)||1)-1);
    if(!count) { activeSockets.delete(userId); await sendPresence(userId,false).catch(()=>{}); } else activeSockets.set(userId,count);
  });
});
app.use((err,_req,res,_next)=>{
  if(err&&err.type==='entity.too.large') return res.status(413).json({error:'Dữ liệu gửi lên quá lớn.'});
  console.error('Request error:', err && err.code ? err.code : (err && err.name ? err.name : 'UnknownError'));
  return res.status(500).json({error:'Máy chủ gặp lỗi. Hãy thử lại sau.'});
});
initDb().then(()=>server.listen(PORT,'0.0.0.0',()=>console.log('Messenger Umi and Maki listening on port '+PORT))).catch(err=>{console.error('Database initialization failed:',err.message);process.exit(1);});
async function shutdown(){try{await pool.end();}catch{} server.close(()=>process.exit(0)); setTimeout(()=>process.exit(1),10000).unref();}
process.on('SIGTERM',shutdown); process.on('SIGINT',shutdown);
