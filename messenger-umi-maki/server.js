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
const io = new Server(server, { maxHttpBufferSize: 1e6 });
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", 'data:'], connectSrc: ["'self'", 'ws:', 'wss:'], fontSrc: ["'self'", 'data:'], objectSrc: ["'none'"], baseUri: ["'self'"], frameAncestors: ["'none'"] } }, crossOriginEmbedderPolicy: false }));
app.use(express.json({ limit: '1mb' }));
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false });
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }));
const activeSockets = new Map();
const roomFor = id => 'user:' + id;
const sql = (text, values = []) => pool.query(text, values);
const normalizedPair = (a,b) => a.localeCompare(b) < 0 ? [a,b] : [b,a];

async function initDb() {
  await sql("CREATE TABLE IF NOT EXISTS users (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), public_id VARCHAR(16) UNIQUE NOT NULL, username VARCHAR(24) UNIQUE NOT NULL, display_name VARCHAR(32) NOT NULL, bio VARCHAR(180) NOT NULL DEFAULT '', avatar TEXT, password_hash TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()); CREATE TABLE IF NOT EXISTS friendships (user_a UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, user_b UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, status VARCHAR(12) NOT NULL CHECK (status IN ('pending','accepted')), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(user_a,user_b), CHECK(user_a < user_b), CHECK(requested_by=user_a OR requested_by=user_b)); CREATE TABLE IF NOT EXISTS messages (id BIGSERIAL PRIMARY KEY, sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, text VARCHAR(2000) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), CHECK(sender_id<>recipient_id)); CREATE INDEX IF NOT EXISTS idx_friendships_a_status ON friendships(user_a,status); CREATE INDEX IF NOT EXISTS idx_friendships_b_status ON friendships(user_b,status); CREATE INDEX IF NOT EXISTS idx_messages_sender_recipient_time ON messages(sender_id,recipient_id,created_at DESC); CREATE INDEX IF NOT EXISTS idx_messages_recipient_sender_time ON messages(recipient_id,sender_id,created_at DESC)");
}
function safeUser(row) { return row ? { id: row.id, publicId: row.public_id, username: row.username, displayName: row.display_name, bio: row.bio || '', avatar: row.avatar || null, createdAt: row.created_at } : null; }
function tokenFor(user) { return jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: '7d', issuer: 'umi-maki-messenger' }); }
function auth(req,res,next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Bạn cần đăng nhập để tiếp tục.' });
  try { req.userId = jwt.verify(token, JWT_SECRET, { issuer: 'umi-maki-messenger' }).sub; return next(); }
  catch { return res.status(401).json({ error: 'Phiên đăng nhập hết hạn. Hãy đăng nhập lại.' }); }
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
  const r = await sql("SELECT CASE WHEN user_a=$1 THEN user_b ELSE user_a END AS other_id FROM friendships WHERE (user_a=$1 OR user_b=$1) AND status='accepted'",[userId]);
  for (const row of r.rows) io.to(roomFor(row.other_id)).emit('presence:update',{userId,online});
}

app.get('/api/health',(_req,res) => res.json({ok:true,service:'Messenger Umi and Maki'}));
app.post('/api/auth/register',authLimiter,route(async(req,res) => {
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
      const r = await sql('INSERT INTO users(public_id,username,display_name,password_hash) VALUES($1,$2,$3,$4) RETURNING id,public_id,username,display_name,bio,avatar,created_at',[publicId,username,displayName,passwordHash]);
      row = r.rows[0]; break;
    } catch(e) {
      if (e.code === '23505' && String(e.constraint || '').includes('username')) return res.status(409).json({error:'Username đã được sử dụng. Hãy chọn tên khác.'});
      if (e.code === '23505' && i < 4) continue;
      throw e;
    }
  }
  if (!row) return res.status(500).json({error:'Chưa tạo được tài khoản. Thử lại nhé.'});
  const user = safeUser(row);
  return res.status(201).json({token:tokenFor(user),user});
}));
app.post('/api/auth/login',authLimiter,route(async(req,res) => {
  const identifier = typeof req.body.identifier === 'string' ? req.body.identifier.trim().replace(/^@/,'').toLowerCase() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!identifier || !password) return res.status(400).json({error:'Nhập username hoặc ID cùng mật khẩu.'});
  const r = await sql('SELECT id,public_id,username,display_name,bio,avatar,password_hash,created_at FROM users WHERE LOWER(username)=$1 OR LOWER(public_id)=$1 LIMIT 1',[identifier]);
  if (!r.rowCount || !(await bcrypt.compare(password,r.rows[0].password_hash))) return res.status(401).json({error:'Tên đăng nhập/ID hoặc mật khẩu chưa đúng.'});
  const user = safeUser(r.rows[0]);
  return res.json({token:tokenFor(user),user});
}));
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
  await refreshFriends([req.userId]);
  return res.json({user});
}));
app.get('/api/users/search',auth,route(async(req,res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim().replace(/^@/,'') : '';
  if (q.length < 2) return res.json({users:[]});
  if (q.length > 64) return res.status(400).json({error:'Từ khóa tìm kiếm quá dài.'});
  const r = await sql("SELECT u.id,u.public_id,u.username,u.display_name,u.bio,u.avatar,u.created_at,CASE WHEN f.status='accepted' THEN 'friend' WHEN f.status='pending' AND f.requested_by=$1 THEN 'outgoing' WHEN f.status='pending' THEN 'incoming' ELSE 'none' END AS relationship FROM users u LEFT JOIN friendships f ON f.user_a=LEAST(u.id,$1::uuid) AND f.user_b=GREATEST(u.id,$1::uuid) WHERE u.id<>$1 AND (LOWER(u.public_id)=LOWER($2) OR u.username ILIKE $3 OR u.display_name ILIKE $3) ORDER BY CASE WHEN LOWER(u.public_id)=LOWER($2) THEN 0 WHEN u.username=LOWER($2) THEN 1 ELSE 2 END,u.display_name LIMIT 25",[req.userId,q,'%'+q+'%']);
  return res.json({users:r.rows.map(row=>({...safeUser(row),relationship:row.relationship}))});
}));
app.get('/api/friends',auth,route(async(req,res) => {
  const r = await sql("SELECT u.id,u.public_id,u.username,u.display_name,u.bio,u.avatar,u.created_at,m.text AS last_message FROM friendships f JOIN users u ON u.id=CASE WHEN f.user_a=$1 THEN f.user_b ELSE f.user_a END LEFT JOIN LATERAL (SELECT text,created_at FROM messages WHERE (sender_id=$1 AND recipient_id=u.id) OR (sender_id=u.id AND recipient_id=$1) ORDER BY created_at DESC LIMIT 1) m ON TRUE WHERE (f.user_a=$1 OR f.user_b=$1) AND f.status='accepted' ORDER BY COALESCE(m.created_at,f.updated_at) DESC,u.display_name ASC",[req.userId]);
  return res.json({friends:r.rows.map(row=>({...safeUser(row),online:(activeSockets.get(row.id)||0)>0,lastMessage:row.last_message||''}))});
}));
app.get('/api/friends/requests',auth,route(async(req,res) => {
  const r = await sql("SELECT f.requested_by,f.created_at AS requested_at,u.id,u.public_id,u.username,u.display_name,u.bio,u.avatar,u.created_at FROM friendships f JOIN users u ON u.id=CASE WHEN f.user_a=$1 THEN f.user_b ELSE f.user_a END WHERE (f.user_a=$1 OR f.user_b=$1) AND f.status='pending' ORDER BY f.created_at DESC",[req.userId]);
  const incoming=[],outgoing=[];
  for (const row of r.rows) { const user={...safeUser(row),requestedAt:row.requested_at}; (row.requested_by===req.userId?outgoing:incoming).push(user); }
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
    const old=await client.query('SELECT status,requested_by FROM friendships WHERE user_a=$1 AND user_b=$2 FOR UPDATE',[a,b]);
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
    const token=socket.handshake.auth&&socket.handshake.auth.token;
    if(!token) return next(new Error('UNAUTHORIZED'));
    const payload=jwt.verify(token,JWT_SECRET,{issuer:'umi-maki-messenger'});
    if(!(await getUser(payload.sub))) return next(new Error('UNAUTHORIZED'));
    socket.userId=payload.sub; return next();
  } catch { return next(new Error('UNAUTHORIZED')); }
});
io.on('connection',async socket=>{
  const userId=socket.userId; socket.join(roomFor(userId)); activeSockets.set(userId,(activeSockets.get(userId)||0)+1);
  if(activeSockets.get(userId)===1) await sendPresence(userId,true).catch(()=>{});
  socket.emit('presence:initial',[...activeSockets.keys()].filter(id=>id!==userId));
  socket.on('presence:list',()=>socket.emit('presence:initial',[...activeSockets.keys()].filter(id=>id!==userId)));
  socket.on('message:send',async(payload,ack)=>{
    const reply=typeof ack==='function'?ack:()=>{};
    try {
      const to=payload&&typeof payload.to==='string'?payload.to:'';
      const text=payload&&typeof payload.text==='string'?payload.text.trim():'';
      if(!to||text.length<1||text.length>2000) return reply({ok:false,error:'Tin nhắn cần có nội dung và tối đa 2000 ký tự.'});
      if(!(await areFriends(userId,to))) return reply({ok:false,error:'Hai bạn cần kết bạn trước khi nhắn tin.'});
      const r=await sql('INSERT INTO messages(sender_id,recipient_id,text) VALUES($1,$2,$3) RETURNING id,sender_id,recipient_id,text,created_at',[userId,to,text]);
      const row=r.rows[0]; const message={id:String(row.id),senderId:row.sender_id,recipientId:row.recipient_id,text:row.text,createdAt:row.created_at};
      io.to(roomFor(userId)).to(roomFor(to)).emit('message:new',message); reply({ok:true});
    } catch(e) { console.error('message:send failed:',e.message); reply({ok:false,error:'Chưa gửi được tin nhắn. Thử lại nhé.'}); }
  });
  socket.on('disconnect',async()=>{
    const count=Math.max(0,(activeSockets.get(userId)||1)-1);
    if(!count) { activeSockets.delete(userId); await sendPresence(userId,false).catch(()=>{}); } else activeSockets.set(userId,count);
  });
});
app.use((err,_req,res,_next)=>{
  if(err&&err.type==='entity.too.large') return res.status(413).json({error:'Dữ liệu gửi lên quá lớn.'});
  console.error('Request error:',err&&err.message?err.message:err);
  return res.status(500).json({error:'Máy chủ gặp lỗi. Hãy thử lại sau.'});
});
initDb().then(()=>server.listen(PORT,'0.0.0.0',()=>console.log('Messenger Umi and Maki listening on port '+PORT))).catch(err=>{console.error('Database initialization failed:',err.message);process.exit(1);});
async function shutdown(){try{await pool.end();}catch{} server.close(()=>process.exit(0)); setTimeout(()=>process.exit(1),10000).unref();}
process.on('SIGTERM',shutdown); process.on('SIGINT',shutdown);
