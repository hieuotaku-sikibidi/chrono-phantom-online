'use strict';
const assert = require('node:assert/strict');
const { io } = require('socket.io-client');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3100';
const suffix = Math.random().toString(36).slice(2, 9);

async function request(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: {
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
  const one = await request('/api/auth/register', {
    method: 'POST', body: { displayName: 'Test Umi', username: 'testumi_' + suffix, password: 'Test-password-123' }
  });
  const two = await request('/api/auth/register', {
    method: 'POST', body: { displayName: 'Test Maki', username: 'testmaki_' + suffix, password: 'Test-password-456' }
  });
  assert.match(one.user.publicId, /^UM-[A-F0-9]{8}$/);
  assert.notEqual(one.user.id, two.user.id);
  const login = await request('/api/auth/login', {
    method: 'POST', body: { identifier: two.user.username, password: 'Test-password-456' }
  });
  assert.equal(login.user.id, two.user.id);
  const search = await request('/api/users/search?q=' + encodeURIComponent(two.user.username), { token: one.token });
  assert.ok(search.users.some(user => user.id === two.user.id), 'user search should find a user');
  await request('/api/friends/request', { token: one.token, method: 'POST', body: { userId: two.user.id } });
  const incoming = await request('/api/friends/requests', { token: two.token });
  assert.ok(incoming.incoming.some(user => user.id === one.user.id), 'incoming friend request should appear');
  await request('/api/friends/' + encodeURIComponent(one.user.id) + '/accept', { token: two.token, method: 'POST' });
  const friends = await request('/api/friends', { token: one.token });
  assert.ok(friends.friends.some(user => user.id === two.user.id), 'friend list should include accepted friend');

  const socketA = io(base, { auth: { token: one.token }, transports: ['websocket'] });
  const socketB = io(base, { auth: { token: two.token }, transports: ['websocket'] });
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
    const history = await request('/api/messages/' + encodeURIComponent(two.user.id), { token: one.token });
    assert.ok(history.messages.some(item => item.text === 'Hello from smoke test'), 'message history should persist');
  } finally {
    socketA.disconnect();
    socketB.disconnect();
  }
  console.log('PASS: health, registration, login, search, friend request, acceptance, realtime messaging, and history.');
}
main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
