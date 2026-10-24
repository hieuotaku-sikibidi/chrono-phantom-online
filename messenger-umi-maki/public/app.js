'use strict';
(() => {
  const $ = selector => document.querySelector(selector);
  const state = { me: null, socket: null, friends: [], incoming: [], outgoing: [], selected: null, messages: [], view: 'chats', query: '', searchResults: [], online: new Set(), pendingAvatar: undefined, theme: localStorage.getItem('umi_theme') === 'dark' ? 'dark' : 'light', call: null };
  let toastTimer = null, searchTimer = null;
  function applyTheme(theme, save = true) {
    state.theme = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = state.theme;
    if (save) {
      try { localStorage.setItem('umi_theme', state.theme); } catch {}
    }
    document.querySelectorAll('[data-theme-choice]').forEach(button => {
      button.classList.toggle('selected', button.dataset.themeChoice === state.theme);
      button.setAttribute('aria-pressed', String(button.dataset.themeChoice === state.theme));
    });
  }
  applyTheme(state.theme, false);


  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }
  function initials(user) {
    const name = (user && (user.displayName || user.username)) || '?';
    return name.trim().split(/\s+/).slice(0,2).map(part => part[0] || '').join('').toUpperCase();
  }
  function avatar(user, className = 'avatar') {
    const image = user && user.avatar ? '<img alt="" src="' + esc(user.avatar) + '">' : esc(initials(user));
    return '<span class="' + className + '">'+image+'</span>';
  }
  function toast(message, isError = false) {
    const el = $('#toast'); el.textContent = message; el.className = 'toast show' + (isError ? ' error' : '');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.className = 'toast'; }, 3000);
  }
  async function api(url, options = {}) {
    const headers = Object.assign({}, options.headers || {});
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch(url, Object.assign({ credentials: 'same-origin' }, options, { headers }));
    let data = {};
    try { data = await response.json(); } catch {}
    if (!response.ok) {
      if (response.status === 401 && state.me) signOut(false);
      throw new Error(data.error || 'Đã có lỗi xảy ra. Hãy thử lại nhé.');
    }
    return data;
  }
  function setNote(id, message, success = false) {
    const el = $(id); if (!el) return;
    el.textContent = message || ''; el.classList.toggle('success', !!success);
  }
  function showAuth(mode = 'login') {
    $('#authScreen').classList.remove('hidden'); $('#appScreen').classList.add('hidden');
    $('#loginForm').classList.toggle('hidden', mode !== 'login');
    $('#registerForm').classList.toggle('hidden', mode !== 'register');
    $('#authTitle').textContent = mode === 'login' ? 'Đăng nhập nhé.' : 'Bắt đầu thôi.';
    $('#authSubtitle').textContent = mode === 'login' ? 'Tiếp tục câu chuyện của bạn.' : 'Tạo không gian riêng của bạn.';
    setNote('#loginNote',''); setNote('#registerNote','');
  }
  function signOut(showLogin = true) {
    if (state.call) endCall();
    fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
    if (state.socket) { state.socket.disconnect(); state.socket = null; }
    state.me = null; state.friends = []; state.incoming = []; state.outgoing = [];
    state.selected = null; state.messages = []; state.online.clear();
    if (showLogin) toast('Bạn đã đăng xuất.');
    showAuth('login');
  }
  async function startSession(user) {
    state.me = user;
    $('#authScreen').classList.add('hidden'); $('#appScreen').classList.remove('hidden');
    connectSocket();
    await refreshAll();
    switchView('chats');
    renderMe();
  }
  function connectSocket() {
    if (state.socket) state.socket.disconnect();
    if (typeof window.io !== 'function') { toast('Không tải được kết nối thời gian thực. Hãy tải lại trang.', true); return; }
    state.socket = window.io({ withCredentials: true, reconnection: true });
    state.socket.on('connect_error', () => { toast('Không kết nối được máy chủ realtime.', true); });
    installCallSocketHandlers(state.socket);
    state.socket.on('presence:initial', ids => { state.online = new Set(ids || []); renderSidebar(); if (state.selected) renderChatHeader(); });
    state.socket.on('presence:update', data => {
      if (data.online) state.online.add(data.userId); else state.online.delete(data.userId);
      renderSidebar(); if (state.selected) renderChatHeader();
      if (state.view === 'friends') renderDirectory();
    });
    state.socket.on('friends:refresh', async () => {
      await refreshAll();
      if (state.selected) {
        const latest = state.friends.find(friend => friend.id === state.selected.id);
        if (latest) { state.selected = { ...state.selected, ...latest }; renderChatHeader(); renderMessages(false); }
      }
    });
    state.socket.on('profile:refresh', data => {
      if (data && data.user && state.me && data.user.id === state.me.id) { state.me = data.user; renderMe(); }
    });
    state.socket.on('message:new', message => {
      if (state.selected && (message.senderId === state.selected.id || message.recipientId === state.selected.id)) {
        if (!state.messages.some(m => m.id === message.id)) state.messages.push(message);
        renderMessages(true);
      }
      refreshFriends().then(renderSidebar).catch(() => {});
    });
  }
  async function refreshFriends() {
    const data = await api('/api/friends'); state.friends = data.friends || [];
    if (state.selected) {
      const latest = state.friends.find(friend => friend.id === state.selected.id);
      if (latest) state.selected = { ...state.selected, ...latest };
    }
  }
  async function refreshRequests() {
    const data = await api('/api/friends/requests');
    state.incoming = data.incoming || []; state.outgoing = data.outgoing || [];
  }
  async function refreshAll() {
    await Promise.all([refreshFriends(), refreshRequests()]);
    renderSidebar(); updateRequestBadge();
  }
  function renderSettings() { applyTheme(state.theme, false); }
  function renderMe() {
    if (!state.me) return;
    $('#myName').textContent = state.me.displayName;
    $('#myHandle').textContent = '@' + state.me.username + ' · ' + state.me.publicId;
    $('#myAvatar').innerHTML = state.me.avatar ? '<img alt="" src="' + esc(state.me.avatar) + '">' : esc(initials(state.me));
    $('#profilePreview').innerHTML = state.me.avatar ? '<img alt="" src="' + esc(state.me.avatar) + '">' : esc(initials(state.me));
    $('#profilePublicId').textContent = state.me.publicId;
    $('#profileDisplay').value = state.me.displayName || '';
    $('#profileUsername').value = '@' + state.me.username;
    $('#profileBio').value = state.me.bio || '';
    $('#topProfileButton').title = 'Hồ sơ của ' + state.me.displayName;
  }
  function updateRequestBadge() {
    const count = state.incoming.length;
    $('#requestCount').textContent = count > 9 ? '9+' : String(count);
    $('#requestCount').classList.toggle('hidden', count === 0);
  }
  function switchView(view) {
    state.view = view; state.query = ''; state.searchResults = [];
    $('#userSearch').value = ''; $('#clearSearch').classList.add('hidden');
    document.querySelectorAll('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.view === view));
    $('#emptyState').classList.toggle('hidden', view !== 'chats' || !!state.selected);
    $('#chatView').classList.toggle('hidden', view !== 'chats' || !state.selected);
    $('#directoryView').classList.toggle('hidden', !['friends','requests'].includes(view));
    $('#profileView').classList.toggle('hidden', view !== 'profile');
    $('#settingsView').classList.toggle('hidden', view !== 'settings');
    if (view === 'chats') {
      $('#topTitle').textContent = state.selected ? state.selected.displayName : 'Tin nhắn';
      $('#topSubtitle').textContent = state.selected ? 'Một góc nhỏ dành cho hai bạn.' : 'Một lời chào có thể bắt đầu điều tuyệt vời.';
    } else if (view === 'friends') {
      $('#topTitle').textContent = 'Bạn bè'; $('#topSubtitle').textContent = 'Những người bạn đã kết nối.';
    } else if (view === 'requests') {
      $('#topTitle').textContent = 'Lời mời kết bạn'; $('#topSubtitle').textContent = 'Mỗi kết nối mới là một câu chuyện.';
    } else if (view === 'profile') {
      $('#topTitle').textContent = 'Hồ sơ của bạn'; $('#topSubtitle').textContent = 'Một chút về chính bạn.';
      renderMe();
    } else {
      $('#topTitle').textContent = 'Cài đặt'; $('#topSubtitle').textContent = 'Tùy chỉnh không gian của bạn.';
      renderSettings();
    }
    renderSidebar();
    if (['friends','requests'].includes(view)) renderDirectory();
  }
  function renderSidebar() {
    const list = $('#sidebarList');
    if (!state.me) return;
    if (state.query.trim().length >= 2) {
      $('#sidebarHeading').textContent = 'KẾT QUẢ TÌM KIẾM';
      if (!state.searchResults.length) { list.innerHTML = '<div class="list-empty">Không tìm thấy người phù hợp.<br>Thử username hoặc ID nhé.</div>'; return; }
      list.innerHTML = state.searchResults.map(user => {
        const relation = user.relationship;
        let action = '';
        if (relation === 'none') action = '<button class="mini-btn" type="button" data-action="add" data-id="'+esc(user.id)+'">Kết bạn ＋</button>';
        if (relation === 'incoming') action = '<button class="mini-btn" type="button" data-action="accept" data-id="'+esc(user.id)+'">Đồng ý</button>';
        if (relation === 'outgoing') action = '<button class="mini-btn muted" type="button" disabled>Đã gửi</button>';
        if (relation === 'friend') action = '<button class="mini-btn" type="button" data-action="chat" data-id="'+esc(user.id)+'">Nhắn tin</button>';
        return '<div class="person-row"><span class="row-avatar avatar">'+(user.avatar?'<img alt="" src="'+esc(user.avatar)+'">':esc(initials(user)))+'</span><span class="row-info"><span class="row-name">'+esc(user.displayName)+'</span><span class="row-detail">@'+esc(user.username)+' · '+esc(user.publicId)+'</span></span>'+action+'</div>';
      }).join('');
      return;
    }
    $('#sidebarHeading').textContent = state.view === 'friends' ? 'BẠN BÈ' : state.view === 'requests' ? 'LỜI MỜI MỚI' : 'GẦN ĐÂY';
    if (state.view === 'requests') {
      const incoming = state.incoming;
      list.innerHTML = incoming.length ? incoming.slice(0,12).map(user => '<button class="person-row" data-action="accept" data-id="'+esc(user.id)+'" type="button">'+avatar(user,'row-avatar avatar')+'<span class="row-info"><span class="row-name">'+esc(user.displayName)+'</span><span class="row-detail">Chạm để chấp nhận</span></span><span class="online-dot"></span></button>').join('') : '<div class="list-empty">Chưa có lời mời mới.<br>Hãy tìm người bạn nhé ♡</div>';
      return;
    }
    if (!state.friends.length) {
      list.innerHTML = '<div class="list-empty">Chưa có bạn bè.<br>Tìm người bằng ID hoặc tên để bắt đầu nhé ♡</div>';
      return;
    }
    list.innerHTML = state.friends.map(user => {
      const online = state.online.has(user.id) || user.online;
      const selected = state.selected && state.selected.id === user.id && state.view === 'chats' ? ' selected' : '';
      return '<button class="person-row'+selected+'" type="button" data-action="chat" data-id="'+esc(user.id)+'">'+
        '<span class="row-avatar avatar">'+(user.avatar?'<img alt="" src="'+esc(user.avatar)+'">':esc(initials(user)))+'</span>'+
        '<span class="row-info"><span class="row-name">'+esc(user.displayName)+'</span><span class="row-detail">'+(online?'<span class="online-dot"></span> Đang hoạt động':esc(user.lastMessage || '@'+user.username))+'</span></span></button>';
    }).join('');
  }
  function personCard(user, actions) {
    return '<article class="person-card">'+avatar(user,'avatar')+'<div class="person-card-info"><strong>'+esc(user.displayName)+'</strong><small>@'+esc(user.username)+' · '+esc(user.publicId)+'</small></div><div class="person-card-actions">'+actions+'</div></article>';
  }
  function renderDirectory() {
    if (!['friends','requests'].includes(state.view)) return;
    const title = state.view === 'friends' ? 'Bạn bè' : 'Lời mời kết bạn';
    $('#directoryKicker').textContent = state.view === 'friends' ? 'YOUR CIRCLE' : 'NEW CONNECTIONS';
    $('#directoryTitle').textContent = title;
    $('#directoryDescription').textContent = state.view === 'friends' ? 'Những người bạn đã kết nối cùng nhau.' : 'Chấp nhận lời mời để bắt đầu trò chuyện.';
    $('#directoryDecoration').textContent = '♡';
    const content = $('#directoryContent');
    if (state.view === 'friends') {
      if (!state.friends.length) { content.innerHTML = '<div class="directory-empty">Chưa có bạn bè nào ở đây.<br>Dùng ô tìm kiếm bên trái để tìm theo ID hoặc username.</div>'; return; }
      content.innerHTML = state.friends.map(user => personCard(user, '<button class="mini-btn" type="button" data-action="chat" data-id="'+esc(user.id)+'">Nhắn tin</button>')).join('');
      return;
    }
    let html = '';
    if (state.incoming.length) {
      html += '<div class="section-label">LỜI MỜI ĐẾN <span>'+state.incoming.length+'</span></div><div class="request-grid">'+state.incoming.map(user => personCard(user,'<button class="mini-btn" type="button" data-action="accept" data-id="'+esc(user.id)+'">Chấp nhận</button><button class="mini-btn muted" type="button" data-action="decline" data-id="'+esc(user.id)+'">Bỏ qua</button>')).join('')+'</div>';
    } else {
      html += '<div class="directory-empty">Chưa có lời mời mới. Khi có người muốn kết bạn, lời mời sẽ hiện ở đây ♡</div>';
    }
    if (state.outgoing.length) {
      html += '<div class="section-label outgoing-label">ĐÃ GỬI <span>'+state.outgoing.length+'</span></div><div class="request-grid">'+state.outgoing.map(user => personCard(user,'<button class="mini-btn muted" type="button" data-action="decline" data-id="'+esc(user.id)+'">Thu hồi</button>')).join('')+'</div>';
    }
    content.innerHTML = html;
  }
  async function openChat(id) {
    let friend = state.friends.find(user => user.id === id);
    if (!friend) {
      const result = state.searchResults.find(user => user.id === id);
      if (result && result.relationship === 'friend') friend = result;
    }
    if (!friend) { toast('Bạn cần kết bạn trước khi trò chuyện.', true); return; }
    state.selected = friend; state.view = 'chats'; state.messages = [];
    document.querySelectorAll('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.view === 'chats'));
    $('#emptyState').classList.add('hidden'); $('#chatView').classList.remove('hidden'); $('#directoryView').classList.add('hidden'); $('#profileView').classList.add('hidden');
    $('#topTitle').textContent = friend.displayName; $('#topSubtitle').textContent = 'Một góc nhỏ dành cho hai bạn.';
    renderSidebar(); renderChatHeader();
    $('#messagesArea').innerHTML = '<div class="chat-start-note">Đây là nơi câu chuyện của hai bạn bắt đầu ♡</div>';
    try {
      const data = await api('/api/messages/'+encodeURIComponent(id)); state.messages = data.messages || []; renderMessages(false);
    } catch (error) { toast(error.message, true); }
    $('#messageInput').focus();
  }
  function renderChatHeader() {
    if (!state.selected) return;
    const online = state.online.has(state.selected.id) || state.friends.some(f => f.id === state.selected.id && f.online);
    $('#chatHeader').innerHTML = avatar(state.selected,'avatar')+'<div class="chat-person"><strong>'+esc(state.selected.displayName)+'</strong><small>'+(online?'<span class="online-dot"></span> Đang hoạt động':'@'+esc(state.selected.username)+' · '+esc(state.selected.publicId))+'</small></div><div class="chat-actions"><button type="button" title="Gọi thoại" aria-label="Gọi thoại" data-action="call-voice" data-id="'+esc(state.selected.id)+'">☎</button><button type="button" title="Gọi video" aria-label="Gọi video" data-action="call-video" data-id="'+esc(state.selected.id)+'">▣</button><button type="button" title="Hồ sơ" data-action="view-profile" data-id="'+esc(state.selected.id)+'">☻</button><button type="button" title="Xóa bạn" data-action="unfriend" data-id="'+esc(state.selected.id)+'">♡</button></div>';
  }
  function formatTime(dateValue) {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'});
  }
  function renderMessages(scrollBottom = true) {
    if (!state.selected) return;
    const area = $('#messagesArea');
    if (!state.messages.length) {
      area.innerHTML = '<div class="chat-start-note">Đây là nơi câu chuyện của hai bạn bắt đầu ♡</div>';
    } else {
      area.innerHTML = state.messages.map(message => {
        const mine = message.senderId === state.me.id;
        const sender = mine ? state.me : state.selected;
        const senderAvatar = avatar(sender, 'message-avatar avatar');
        const content = '<div class="message-content"><div class="message-bubble">'+esc(message.text)+'</div><span class="message-time">'+formatTime(message.createdAt)+'</span></div>';
        return '<div class="message-row '+(mine?'mine':'theirs')+'">'+(mine ? content + senderAvatar : senderAvatar + content)+'</div>';
      }).join('');
    }
    if (scrollBottom) area.scrollTop = area.scrollHeight;
  }
  function callErrorMessage(error) {
    if (error && (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError')) return 'Bạn chưa cấp quyền sử dụng mic/camera. Hãy cho phép quyền trong trình duyệt rồi thử lại.';
    if (error && (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError')) return 'Không tìm thấy mic hoặc camera phù hợp trên thiết bị này.';
    if (error && (error.name === 'NotReadableError' || error.name === 'TrackStartError')) return 'Mic/camera có thể đang được ứng dụng khác sử dụng.';
    return 'Không thể bắt đầu cuộc gọi. Hãy kiểm tra quyền mic/camera và thử lại.';
  }
  function showCallUi() {
    const call = state.call;
    if (!call) return;
    $('#callOverlay').classList.remove('hidden');
    $('#callWindowTitle').textContent = call.mode === 'video' ? 'Cuộc gọi video' : 'Cuộc gọi thoại';
    $('#callPeerAvatar').innerHTML = call.peer ? (call.peer.avatar ? '<img alt="" src="'+esc(call.peer.avatar)+'">' : esc(initials(call.peer))) : '♡';
    $('#voiceCallAvatar').innerHTML = call.peer ? (call.peer.avatar ? '<img alt="" src="'+esc(call.peer.avatar)+'">' : esc(initials(call.peer))) : '♡';
    $('#callPeerName').textContent = call.peer ? call.peer.displayName : 'Bạn bè';
    $('#incomingCallPanel').classList.toggle('hidden', call.status !== 'incoming');
    $('#activeCallPanel').classList.toggle('hidden', call.status === 'incoming');
    $('#callControls').classList.toggle('hidden', call.status === 'incoming');
    $('#incomingCallTitle').textContent = call.mode === 'video' ? 'Cuộc gọi video đến' : 'Cuộc gọi thoại đến';
    $('#incomingCallDescription').textContent = (call.peer ? call.peer.displayName : 'Bạn bè') + (call.mode === 'video' ? ' đang muốn gọi video với bạn.' : ' đang muốn gọi thoại với bạn.');
    $('#callStatus').textContent = callStatusText(call);
    $('#voiceCallArtwork').classList.toggle('hidden', call.mode === 'video');
    $('#remoteVideo').classList.toggle('hidden', call.mode !== 'video');
    $('#localVideo').classList.toggle('hidden', call.mode !== 'video');
    $('#callCameraButton').classList.toggle('hidden', call.mode !== 'video');
    updateCallControls();
  }
  function callStatusText(call) {
    if (call.status === 'incoming') return 'Cuộc gọi đến';
    if (call.status === 'outgoing') return 'Đang đổ chuông…';
    if (call.pc && call.pc.connectionState === 'connected') return call.mode === 'video' ? 'Đã kết nối video' : 'Đã kết nối thoại';
    if (call.status === 'connecting') return 'Đang kết nối…';
    return 'Đang trong cuộc gọi';
  }
  function updateCallControls() {
    const call = state.call;
    if (!call) return;
    const micOn = !!(call.localStream && call.localStream.getAudioTracks().some(track => track.enabled));
    $('#callMicButton').classList.toggle('control-off', !micOn);
    $('#callMicButton').querySelector('small').textContent = micOn ? 'Tắt mic' : 'Bật mic';
    $('#callMicButton').querySelector('span').textContent = micOn ? '🎙' : '🔇';
    const cameraTrack = call.localStream && call.localStream.getVideoTracks()[0];
    const cameraOn = !!(cameraTrack && cameraTrack.enabled);
    $('#callCameraButton').classList.toggle('control-off', !cameraOn);
    $('#callCameraButton').querySelector('small').textContent = cameraOn ? 'Tắt cam' : 'Bật cam';
    $('#callCameraButton').querySelector('span').textContent = cameraOn ? '▣' : '◻';
    $('#callStatus').textContent = callStatusText(call);
  }
  function setupPeerConnection(call) {
    if (call.pc) return call.pc;
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });
    call.pc = pc;
    for (const track of (call.localStream ? call.localStream.getTracks() : [])) pc.addTrack(track, call.localStream);
    pc.onicecandidate = event => {
      if (event.candidate && state.call && state.call.id === call.id && state.socket) {
        state.socket.emit('call:signal', { to: call.peerId, callId: call.id, kind: 'ice', candidate: event.candidate.toJSON() }, response => {
          if (response && !response.ok) toast(response.error || 'Không gửi được tín hiệu cuộc gọi.', true);
        });
      }
    };
    pc.ontrack = event => {
      if (!state.call || state.call.id !== call.id) return;
      const remoteStream = event.streams && event.streams[0] ? event.streams[0] : new MediaStream([event.track]);
      call.remoteStream = remoteStream;
      if (call.mode === 'video') {
        $('#remoteVideo').srcObject = remoteStream;
        $('#remoteVideo').play().catch(() => {});
      } else {
        $('#remoteAudio').srcObject = remoteStream;
        $('#remoteAudio').play().catch(() => {});
      }
    };
    pc.onconnectionstatechange = () => {
      if (!state.call || state.call.id !== call.id) return;
      if (pc.connectionState === 'connected') call.status = 'connected';
      if (pc.connectionState === 'failed') {
        $('#callStatus').textContent = 'Không kết nối được. Có thể cần mạng khác hoặc máy chủ TURN.';
        toast('Cuộc gọi chưa kết nối được. Hãy thử lại hoặc đổi mạng.', true);
      } else {
        updateCallControls();
      }
    };
    pc.oniceconnectionstatechange = () => {
      if (state.call && state.call.id === call.id && pc.iceConnectionState === 'failed') {
        $('#callStatus').textContent = 'Mạng không thể thiết lập đường truyền P2P.';
      }
    };
    return pc;
  }
  function sendCallSignal(call, kind, payload) {
    if (!state.socket || !call) return;
    state.socket.emit('call:signal', Object.assign({ to: call.peerId, callId: call.id, kind }, payload), response => {
      if (response && !response.ok) {
        toast(response.error || 'Không gửi được tín hiệu cuộc gọi.', true);
        cleanupCall();
      }
    });
  }
  async function createAndSendOffer(call) {
    const pc = setupPeerConnection(call);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sendCallSignal(call, 'offer', { description: pc.localDescription.toJSON ? pc.localDescription.toJSON() : pc.localDescription });
  }
  async function flushIceCandidates(call) {
    if (!call.pc || !call.pc.remoteDescription || !call.pendingIce) return;
    const pending = call.pendingIce.splice(0);
    for (const candidate of pending) {
      try { await call.pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (error) { console.warn('ICE candidate skipped', error && error.name); }
    }
  }
  async function handleCallSignal(data) {
    const call = state.call;
    if (!call || !data || data.callId !== call.id || data.from !== call.peerId) return;
    try {
      const pc = setupPeerConnection(call);
      if (data.kind === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(data.description));
        await flushIceCandidates(call);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        call.status = 'connecting';
        showCallUi();
        sendCallSignal(call, 'answer', { description: pc.localDescription.toJSON ? pc.localDescription.toJSON() : pc.localDescription });
      } else if (data.kind === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(data.description));
        await flushIceCandidates(call);
        call.status = 'connecting';
        showCallUi();
      } else if (data.kind === 'ice' && data.candidate) {
        if (!pc.remoteDescription) (call.pendingIce || (call.pendingIce = [])).push(data.candidate);
        else await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    } catch (error) {
      console.error('Call signaling failed:', error && error.name);
      $('#callStatus').textContent = 'Có lỗi khi thiết lập cuộc gọi.';
      toast('Không thể kết nối cuộc gọi. Hãy thử lại nhé.', true);
    }
  }
  async function startCall(mode, peerId) {
    if (state.call) { toast('Bạn đang có một cuộc gọi khác.', true); return; }
    const peer = state.friends.find(friend => friend.id === peerId) || (state.selected && state.selected.id === peerId ? state.selected : null);
    if (!peer) { toast('Bạn cần kết bạn với người này trước khi gọi.', true); return; }
    if (!state.socket || !state.socket.connected) { toast('Máy chủ realtime chưa kết nối. Hãy thử tải lại trang.', true); return; }
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      toast('Trình duyệt chưa hỗ trợ mic/camera. Hãy mở trang bằng HTTPS và thử lại.', true); return;
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: mode === 'video' });
    } catch (error) {
      toast(callErrorMessage(error), true); return;
    }
    const id = (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : 'call-' + Date.now() + '-' + Math.random().toString(16).slice(2);
    const call = { id, peerId, peer, mode, role: 'caller', status: 'outgoing', localStream: stream, remoteStream: null, pc: null, pendingIce: [] };
    state.call = call;
    if (mode === 'video') $('#localVideo').srcObject = stream;
    showCallUi();
    state.socket.emit('call:invite', { to: peerId, callId: id, mode }, async response => {
      if (!response || !response.ok) {
        cleanupCall();
        toast((response && response.error) || 'Không gửi được lời mời gọi.', true);
      } else {
        $('#callStatus').textContent = 'Đang đổ chuông…';
      }
    });
  }
  async function acceptCall() {
    const call = state.call;
    if (!call || call.status !== 'incoming') return;
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      toast('Hãy mở trang bằng HTTPS để dùng mic/camera.', true); declineCall('unsupported'); return;
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: call.mode === 'video' });
    } catch (error) {
      toast(callErrorMessage(error), true); declineCall('permission-denied'); return;
    }
    if (!state.call || state.call.id !== call.id) { stream.getTracks().forEach(track => track.stop()); return; }
    call.localStream = stream;
    call.status = 'connecting';
    if (call.mode === 'video') $('#localVideo').srcObject = stream;
    setupPeerConnection(call);
    showCallUi();
    state.socket.emit('call:accept', { callId: call.id }, response => {
      if (!response || !response.ok) {
        toast((response && response.error) || 'Cuộc gọi không còn khả dụng.', true);
        cleanupCall();
      }
    });
  }
  function declineCall(reason = 'declined') {
    const call = state.call;
    if (!call) return;
    if (state.socket) state.socket.emit('call:decline', { callId: call.id, reason });
    cleanupCall();
  }
  function endCall() {
    const call = state.call;
    if (!call) return;
    if (state.socket) state.socket.emit('call:end', { callId: call.id });
    cleanupCall();
  }
  function cleanupCall() {
    const call = state.call;
    if (call) {
      if (call.pc) {
        call.pc.ontrack = null;
        call.pc.onicecandidate = null;
        call.pc.onconnectionstatechange = null;
        try { call.pc.close(); } catch {}
      }
      if (call.localStream) call.localStream.getTracks().forEach(track => track.stop());
      if (call.remoteStream) call.remoteStream.getTracks().forEach(track => track.stop());
    }
    state.call = null;
    $('#callOverlay').classList.add('hidden');
    $('#remoteVideo').srcObject = null;
    $('#localVideo').srcObject = null;
    $('#remoteAudio').srcObject = null;
  }
  function toggleCallMic() {
    const call = state.call;
    if (!call || !call.localStream) return;
    const tracks = call.localStream.getAudioTracks();
    if (!tracks.length) { toast('Không tìm thấy micrô trong cuộc gọi.', true); return; }
    const enabled = tracks.some(track => track.enabled);
    tracks.forEach(track => { track.enabled = !enabled; });
    updateCallControls();
  }
  function toggleCallCamera() {
    const call = state.call;
    if (!call || call.mode !== 'video' || !call.localStream) return;
    const tracks = call.localStream.getVideoTracks();
    if (!tracks.length) { toast('Không tìm thấy camera trong cuộc gọi.', true); return; }
    const enabled = tracks.some(track => track.enabled);
    tracks.forEach(track => { track.enabled = !enabled; });
    updateCallControls();
  }
  function installCallSocketHandlers(socket) {
    socket.on('call:incoming', data => {
      if (!data || !data.callId || !data.caller || state.call) {
        if (data && data.callId) socket.emit('call:decline', { callId: data.callId, reason: 'busy' });
        return;
      }
      state.call = { id: data.callId, peerId: data.caller.id, peer: data.caller, mode: data.mode === 'video' ? 'video' : 'audio', role: 'callee', status: 'incoming', localStream: null, remoteStream: null, pc: null, pendingIce: [] };
      showCallUi();
    });
    socket.on('call:accepted', data => {
      const call = state.call;
      if (!call || !data || call.id !== data.callId || call.role !== 'caller') return;
      call.status = 'connecting';
      showCallUi();
      createAndSendOffer(call).catch(error => {
        console.error('Cannot create call offer:', error && error.name);
        toast('Không tạo được kết nối cuộc gọi.', true);
        endCall();
      });
    });
    socket.on('call:signal', data => { handleCallSignal(data); });
    socket.on('call:declined', data => {
      if (state.call && data && state.call.id === data.callId) {
        const name = state.call.peer ? state.call.peer.displayName : 'Người nhận';
        cleanupCall(); toast(name + ' đã từ chối cuộc gọi.');
      }
    });
    socket.on('call:ended', data => {
      if (state.call && data && state.call.id === data.callId) {
        cleanupCall();
        if (data.reason !== 'disconnected') toast('Cuộc gọi đã kết thúc.');
      }
    });
  }

  async function performAction(action, id) {
    try {
      if (action === 'call-voice') {
        await startCall('audio', id);
      } else if (action === 'call-video') {
        await startCall('video', id);
      } else if (action === 'add') {
        const data = await api('/api/friends/request',{method:'POST',body:JSON.stringify({userId:id})});
        toast(data.message || 'Đã gửi lời mời kết bạn.');
        await refreshAll(); if (state.query) await doSearch(state.query);
      } else if (action === 'accept') {
        await api('/api/friends/'+encodeURIComponent(id)+'/accept',{method:'POST'});
        toast('Hai bạn đã trở thành bạn bè! ♡'); await refreshAll(); if (state.query) await doSearch(state.query);
        const user = state.friends.find(f=>f.id===id); if (user) await openChat(id);
      } else if (action === 'decline') {
        await api('/api/friends/'+encodeURIComponent(id),{method:'DELETE'});
        toast('Đã cập nhật lời mời.'); await refreshAll(); if (state.query) await doSearch(state.query); else if (state.view==='requests') renderDirectory();
      } else if (action === 'chat') {
        await openChat(id);
      } else if (action === 'unfriend') {
        if (!window.confirm('Xóa người này khỏi danh sách bạn bè?')) return;
        await api('/api/friends/'+encodeURIComponent(id),{method:'DELETE'});
        state.selected = null; state.messages = []; await refreshAll(); switchView('chats'); toast('Đã xóa khỏi danh sách bạn bè.');
      } else if (action === 'view-profile') {
        const user = state.friends.find(f=>f.id===id);
        if (user) toast(user.displayName+' · @'+user.username+' · '+user.publicId);
      }
    } catch (error) { toast(error.message, true); }
  }
  async function doSearch(query) {
    state.query = query;
    $('#clearSearch').classList.toggle('hidden', !query);
    if (query.trim().length < 2) { state.searchResults=[]; renderSidebar(); return; }
    try {
      const data = await api('/api/users/search?q='+encodeURIComponent(query.trim()));
      if (state.query === query) { state.searchResults = data.users || []; renderSidebar(); }
    } catch (error) { toast(error.message,true); }
  }

  $('#showRegister').addEventListener('click',()=>showAuth('register'));
  $('#showLogin').addEventListener('click',()=>showAuth('login'));
  $('#loginForm').addEventListener('submit',async event=>{
    event.preventDefault(); setNote('#loginNote','Đang đăng nhập…');
    try {
      const data=await api('/api/auth/login',{method:'POST',body:JSON.stringify({identifier:$('#loginIdentifier').value.trim(),password:$('#loginPassword').value})});
      await startSession(data.user);
    } catch(error) { setNote('#loginNote',error.message); }
  });
  $('#registerForm').addEventListener('submit',async event=>{
    event.preventDefault(); setNote('#registerNote','Đang tạo tài khoản…');
    try {
      const data=await api('/api/auth/register',{method:'POST',body:JSON.stringify({displayName:$('#registerDisplay').value.trim(),username:$('#registerUsername').value.trim().toLowerCase(),password:$('#registerPassword').value})});
      await startSession(data.user); toast('Chào mừng bạn đến với Umi and Maki! ID của bạn là '+data.user.publicId);
    } catch(error) { setNote('#registerNote',error.message); }
  });
  document.querySelectorAll('.nav-item').forEach(button=>button.addEventListener('click',()=>switchView(button.dataset.view)));
  $('#myProfileButton').addEventListener('click',()=>switchView('profile'));
  $('#topProfileButton').addEventListener('click',()=>switchView('profile'));
  $('#newChatHint').addEventListener('click',()=>{$('#userSearch').focus();$('#userSearch').placeholder='Nhập tên hoặc ID người bạn…';});
  $('#findFriendButton').addEventListener('click',()=>{$('#userSearch').focus();$('#userSearch').placeholder='Nhập tên hoặc ID người bạn…';});
  $('#clearSearch').addEventListener('click',()=>{$('#userSearch').value='';state.query='';state.searchResults=[];renderSidebar();$('#clearSearch').classList.add('hidden');});
  $('#userSearch').addEventListener('input',event=>{
    const value=event.target.value; clearTimeout(searchTimer);
    searchTimer=setTimeout(()=>doSearch(value),220);
  });
  $('#sidebarList').addEventListener('click',event=>{
    const control=event.target.closest('[data-action]');
    if (control) { if (!control.disabled) performAction(control.dataset.action,control.dataset.id); return; }
    const row=event.target.closest('[data-id]');
    if (row && row.dataset.id) performAction('chat',row.dataset.id);
  });
  $('#directoryContent').addEventListener('click',event=>{
    const control=event.target.closest('[data-action]'); if(control) performAction(control.dataset.action,control.dataset.id);
  });
  $('#chatHeader').addEventListener('click',event=>{
    const control=event.target.closest('[data-action]'); if(control) performAction(control.dataset.action,control.dataset.id);
  });
  $('#settingsView').addEventListener('click', event => {
    const choice = event.target.closest('[data-theme-choice]');
    if (choice) applyTheme(choice.dataset.themeChoice);
  });
  $('#acceptCallButton').addEventListener('click', () => { acceptCall(); });
  $('#declineCallButton').addEventListener('click', () => { declineCall(); });
  $('#endCallButton').addEventListener('click', endCall);
  $('#callCloseButton').addEventListener('click', () => {
    if (state.call && state.call.status === 'incoming') declineCall();
    else endCall();
  });
  $('#callMicButton').addEventListener('click', toggleCallMic);
  $('#callCameraButton').addEventListener('click', toggleCallCamera);

  $('#sendForm').addEventListener('submit',event=>{
    event.preventDefault();
    const text=$('#messageInput').value.trim();
    if(!text||!state.selected||!state.socket) return;
    const to=state.selected.id; $('#messageInput').value='';
    state.socket.emit('message:send',{to,text},response=>{
      if(!response||!response.ok) toast((response&&response.error)||'Chưa gửi được tin nhắn.',true);
    });
  });
  $('#messageInput').addEventListener('keydown',event=>{
    if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();$('#sendForm').requestSubmit();}
  });
  $('#logoutButton').addEventListener('click',()=>signOut(true));
  $('#profileForm').addEventListener('submit',async event=>{
    event.preventDefault(); setNote('#profileNote','Đang lưu…');
    try {
      const payload={displayName:$('#profileDisplay').value.trim(),bio:$('#profileBio').value.trim()};
      if(state.pendingAvatar!==undefined) payload.avatar=state.pendingAvatar;
      const data=await api('/api/me',{method:'PATCH',body:JSON.stringify(payload)});
      state.me=data.user; state.pendingAvatar=undefined; renderMe(); setNote('#profileNote','Đã lưu hồ sơ của bạn.',true); toast('Đã cập nhật hồ sơ.');
    } catch(error) { setNote('#profileNote',error.message); }
  });
  $('#profileAvatarFile').addEventListener('change',event=>{
    const file=event.target.files&&event.target.files[0]; if(!file) return;
    if(!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>400*1024){setNote('#profileNote','Chọn ảnh PNG, JPG hoặc WebP tối đa 400 KB.');event.target.value='';return;}
    const reader=new FileReader();
    reader.onload=()=>{state.pendingAvatar=String(reader.result);$('#profilePreview').innerHTML='<img alt="" src="'+esc(state.pendingAvatar)+'">';setNote('#profileNote','Ảnh đã chọn. Nhấn Lưu hồ sơ để cập nhật.',true);};
    reader.onerror=()=>setNote('#profileNote','Không đọc được ảnh này.');reader.readAsDataURL(file);
  });
  $('#removeAvatarButton').addEventListener('click',()=>{state.pendingAvatar=null;$('#profilePreview').textContent=initials(state.me);$('#profileAvatarFile').value='';setNote('#profileNote','Đã chọn bỏ ảnh. Nhấn Lưu hồ sơ để xác nhận.',true);});
  $('#copyIdButton').addEventListener('click',async()=>{
    try { await navigator.clipboard.writeText(state.me.publicId); toast('Đã sao chép ID: '+state.me.publicId); }
    catch { window.prompt('Sao chép ID của bạn:',state.me.publicId); }
  });

  async function boot() {
    try {
      const data=await api('/api/me'); state.me=data.user;
      $('#authScreen').classList.add('hidden'); $('#appScreen').classList.remove('hidden');
      connectSocket(); await refreshAll(); renderMe(); switchView('chats');
    } catch { showAuth('login'); }
  }
  boot();
})();
