'use strict';
const assert = require('node:assert/strict');
const { io } = require('socket.io-client');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3100';
const suffix = Math.random().toString(36).slice(2, 9);

async function request(path, { token, cookie, method = 'GET', body, origin } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(origin ? { Origin: origin } : {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {})
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  let data = {};
  try { data = await response.json(); } catch {}
  if (!response.ok) throw new Error(method + ' ' + path + ': ' + response.status + ' ' + (data.error || JSON.stringify(data)));
  return data;
}
async function authRequest(path, body) {
  const response = await fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  let data = {};
  try { data = await response.json(); } catch {}
  if (!response.ok) throw new Error('POST ' + path + ': ' + response.status + ' ' + (data.error || JSON.stringify(data)));
  const cookie = (response.headers.get('set-cookie') || '').split(';')[0];
  assert.match(cookie, /^umi_auth=/, 'login/register should issue an authentication cookie');
  return { ...data, cookie };
}
async function waitConnected(socket) {
  await Promise.race([
    new Promise((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Socket connection timed out')), 8000))
  ]);
}
async function main() {
  const health = await request('/api/health');
  assert.equal(health.ok, true);
  const unauthenticated = await fetch(base + '/api/me');
  assert.equal(unauthenticated.status, 401, 'private account endpoint must reject anonymous requests');
  const one = await authRequest('/api/auth/register', {
    displayName: 'Test Umi', username: 'testumi_' + suffix, password: 'Test-password-123'
  });
  const two = await authRequest('/api/auth/register', {
    displayName: 'Test Maki', username: 'testmaki_' + suffix, password: 'Test-password-456'
  });
  assert.match(one.user.publicId, /^UM-[A-F0-9]{8}$/);
  assert.notEqual(one.user.id, two.user.id);
  assert.equal('token' in one, false, 'auth token must not be exposed in JSON');
  const login = await authRequest('/api/auth/login', { identifier: two.user.username, password: 'Test-password-456' });
  assert.equal(login.user.id, two.user.id);
  const meFromCookie = await request('/api/me', { cookie: login.cookie });
  assert.equal(meFromCookie.user.id, two.user.id, 'HttpOnly cookie should authenticate API requests');
  const wrongPassword = await fetch(base + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: two.user.username, password: 'definitely-wrong-password' })
  });
  assert.equal(wrongPassword.status, 401, 'wrong password should be rejected');
  const search = await request('/api/users/search?q=' + encodeURIComponent(two.user.username), { cookie: one.cookie });
  assert.ok(search.users.some(user => user.id === two.user.id), 'user search should find a user');
  await request('/api/friends/request', { cookie: one.cookie, method: 'POST', body: { userId: two.user.id } });
  const incoming = await request('/api/friends/requests', { cookie: two.cookie });
  assert.ok(incoming.incoming.some(user => user.id === one.user.id), 'incoming friend request should appear');
  await request('/api/friends/' + encodeURIComponent(one.user.id) + '/accept', { cookie: two.cookie, method: 'POST' });
  const friends = await request('/api/friends', { cookie: one.cookie });
  assert.ok(friends.friends.some(user => user.id === two.user.id), 'friend list should include accepted friend');

  const socketA = io(base, { extraHeaders: { Cookie: one.cookie }, transports: ['websocket'] });
  const socketB = io(base, { extraHeaders: { Cookie: two.cookie }, transports: ['websocket'] });
  try {
    await Promise.all([waitConnected(socketA), waitConnected(socketB)]);
    const inbound = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out waiting for direct message')), 8000);
      socketB.once('message:new', message => { clearTimeout(timer); resolve(message); });
    });
    const ack = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Message ack timed out')), 8000);
      socketA.emit('message:send', { to: two.user.id, text: 'Hello from smoke test' }, response => {
        clearTimeout(timer);
        if (!response || !response.ok) return reject(new Error((response && response.error) || 'Message send failed'));
        resolve(response);
      });
    });
    const result = await Promise.all([inbound, ack]);
    const message = result[0];
    assert.equal(message.senderId, one.user.id);
    assert.equal(message.recipientId, two.user.id);
    assert.equal(message.text, 'Hello from smoke test');
    const history = await request('/api/messages/' + encodeURIComponent(two.user.id), { cookie: one.cookie });
    assert.ok(history.messages.some(item => item.text === 'Hello from smoke test'), 'message history should persist');
    const origin = new URL(base).origin;
    const rejectedOrigin = await fetch(base + '/api/auth/logout', {
      method: 'POST', headers: { Origin: 'https://attacker.example' }
    });
    assert.equal(rejectedOrigin.status, 403, 'cross-origin state-changing request should be blocked');
    const logout = await fetch(base + '/api/auth/logout', {
      method: 'POST', headers: { Cookie: two.cookie, Origin: origin }
    });
    assert.equal(logout.status, 200);
    assert.match(logout.headers.get('set-cookie') || '', /Max-Age=0/, 'logout should instruct the browser to clear its cookie');
  } finally {
    socketA.disconnect();
    socketB.disconnect();
  }
  console.log('PASS: health, cookie auth, invalid credentials, search, friend requests, realtime chat, history, origin checks, and logout.');
}
main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
