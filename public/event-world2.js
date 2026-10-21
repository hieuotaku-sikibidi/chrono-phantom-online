/* Chrono Phantom — Banner gacha, event milestones, and World II campaign */
(function () {
  'use strict';
  if (window.__cpEventsWorldTwoLoaded) return;
  window.__cpEventsWorldTwoLoaded = true;

  var SAVE_KEY = 'chronoPhantomWorldIIProgressV1';
  var world2Stages = [
    { stage:11, name:'THIÊN MÔN VỠ NÁT', bossStage:false, gold:180000, shards:32000, desc:'Bầy Hộ Vệ Thiên Môn tràn xuống.', enemyHp:28000 },
    { stage:12, name:'VƯỜN THẦN TÀN LỤI', bossStage:false, gold:205000, shards:35000, desc:'Quái thú thần giới ẩn trong khu vườn.', enemyHp:34000 },
    { stage:13, name:'AURELION • KẺ CANH CỔNG', bossStage:true, bossHp:2400000, gold:260000, shards:42000, desc:'Boss: Aurelion, kẻ giữ cánh cổng đầu tiên.' },
    { stage:14, name:'ĐƯỜNG CHÂN TRỜI ĐỎ', bossStage:false, gold:285000, shards:45000, desc:'Đội quân thần binh truy sát kẻ xâm nhập.', enemyHp:47000 },
    { stage:15, name:'ILYRA • NỮ THẦN MẶT NẠ', bossStage:true, bossHp:3200000, gold:330000, shards:52000, desc:'Boss: Nữ thần đánh cắp danh tính.' },
    { stage:16, name:'THÀNH PHỐ KHÔNG BÌNH MINH', bossStage:false, gold:355000, shards:58000, desc:'Thần dân hóa quái vật tuần tra thành phố.', enemyHp:62000 },
    { stage:17, name:'HÀNH LANG VẠN TƯỢNG', bossStage:false, gold:380000, shards:61000, desc:'Các tượng thần sống dậy theo từng đợt.', enemyHp:70000 },
    { stage:18, name:'VARKOS • THẦN RÈN DIỆT GIỚI', bossStage:true, bossHp:4300000, gold:420000, shards:68000, desc:'Boss: Thần rèn với búa phá vỡ thiên thể.' },
    { stage:19, name:'BIỂN SAO ĐỔ NÁT', bossStage:false, gold:450000, shards:72000, desc:'Quái tinh tú và kỵ binh hư không.', enemyHp:86000 },
    { stage:20, name:'MORVETH • THẦN TƯ TƯỞNG', bossStage:true, bossHp:5100000, gold:490000, shards:79000, desc:'Boss: Kẻ biến nỗi sợ thành hiện thực.' },
    { stage:21, name:'VỰC THỀ NGUYỆN', bossStage:false, gold:520000, shards:83000, desc:'Lính canh lời thề và bóng ma sa ngã.', enemyHp:105000 },
    { stage:22, name:'ASTRAEA • NỮ THẦN PHÁN QUYẾT', bossStage:true, bossHp:6200000, gold:560000, shards:90000, desc:'Boss: Án quyết thần thánh trút xuống chiến trường.' },
    { stage:23, name:'ĐỒNG BẰNG THẦN TÍCH', bossStage:false, gold:590000, shards:95000, desc:'Binh đoàn thiên giới tấn công theo từng đợt.', enemyHp:125000 },
    { stage:24, name:'SONG THẦN NHẬT NGUYỆT', bossStage:true, bossHp:6900000, gold:630000, shards:102000, desc:'Boss: Hai vị thần kết hợp đòn đánh ánh sáng và bóng tối.' },
    { stage:25, name:'ĐẠI GIÁO ĐƯỜNG TRO TÀN', bossStage:false, gold:670000, shards:108000, desc:'Giáo đồ hóa quái và thiên sứ sa ngã.', enemyHp:150000 },
    { stage:26, name:'KARVHAN • THẦN CHIẾN TRANH', bossStage:true, bossHp:7800000, gold:710000, shards:115000, desc:'Boss: Thần chiến tranh cuồng nộ qua hai giai đoạn.' },
    { stage:27, name:'THANG TRỜI GÃY ĐỔ', bossStage:false, gold:750000, shards:122000, desc:'Vượt qua các đợt hộ vệ trên bậc thang thiên giới.', enemyHp:180000 },
    { stage:28, name:'HỒ SƠ CỦA CÁC VỊ THẦN', bossStage:false, gold:790000, shards:128000, desc:'Các bản sao thần linh bảo vệ bí mật cuối cùng.', enemyHp:205000 },
    { stage:29, name:'PRIMORDIA • THẦN NGUYÊN THỦY', bossStage:true, bossHp:9200000, gold:850000, shards:140000, desc:'Boss: Thần nguyên thủy tái tạo chiến trường.' },
    { stage:30, name:'ĐẤNG XƯNG THẦN VÔ DANH', bossStage:true, bossHp:12000000, gold:1000000, shards:180000, desc:'Đại boss cuối Thế giới II — kẻ tự viết lại quy luật.' }
  ];

  var state = { claimed:{}, cleared:{}, world2Unlocked:false, bestMainStage:0, bestWorld2Stage:10 };
  var loaded;
  try { loaded = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (_) { loaded = null; }
  if (loaded && typeof loaded === 'object') {
    state = Object.assign(state, loaded.state || {});
    state.claimed = state.claimed || {};
    state.cleared = state.cleared || {};
  }

  try {
    if (typeof STAGE_CONFIGS !== 'undefined') {
      world2Stages.forEach(function (cfg) {
        if (!STAGE_CONFIGS.some(function (v) { return v.stage === cfg.stage; })) STAGE_CONFIGS.push(cfg);
      });
    }
  } catch (err) { console.error('World II stage config failed', err); }

  if (loaded && loaded.playerData && typeof playerData !== 'undefined') {
    try {
      Object.keys(loaded.playerData).forEach(function (key) { playerData[key] = loaded.playerData[key]; });
    } catch (_) {}
  }

  function saveProgress() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        state: state,
        playerData: typeof playerData !== 'undefined' ? playerData : null
      }));
    } catch (err) { console.warn('Không lưu được tiến trình sự kiện', err); }
  }

  function claimMilestone(stage, reward) {
    var key = String(stage);
    if (state.claimed[key]) return 0;
    state.claimed[key] = true;
    playerData.shards = Math.max(0, Number(playerData.shards) || 0) + reward;
    return reward;
  }

  function renderEvents() {
    var five = document.getElementById('eventStatus5');
    var ten = document.getElementById('eventStatus10');
    var card5 = document.getElementById('eventRewardStage5');
    var card10 = document.getElementById('eventRewardStage10');
    if (five) five.textContent = state.claimed['5'] ? '✓ ĐÃ NHẬN' : (state.cleared['5'] ? 'SẴN SÀNG NHẬN' : 'CHƯA HOÀN THÀNH');
    if (ten) ten.textContent = state.claimed['10'] ? '✓ ĐÃ NHẬN' : (state.cleared['10'] ? 'SẴN SÀNG NHẬN' : 'CHƯA HOÀN THÀNH');
    if (card5) card5.classList.toggle('is-complete', !!state.claimed['5']);
    if (card10) card10.classList.toggle('is-complete', !!state.claimed['10']);
    var unlockText = document.getElementById('worldTwoUnlockText');
    var portalButton = document.getElementById('worldTwoPortalButton');
    if (unlockText) {
      unlockText.classList.toggle('unlocked', !!state.world2Unlocked);
      unlockText.textContent = state.world2Unlocked ? '✦ CỔNG ĐÃ MỞ — Thế giới của những kẻ xưng thần đang chờ bạn.' : '🔒 Cổng không gian đang bị phong ấn — hãy hoàn thành màn 10.';
    }
    if (portalButton) {
      portalButton.disabled = !state.world2Unlocked;
      portalButton.textContent = state.world2Unlocked ? '🌀 BƯỚC QUA CỔNG KHÔNG GIAN' : '🌀 CỔNG ĐANG PHONG ẤN';
    }
    var prog = document.getElementById('worldTwoProgressText');
    var clearedWorld = Object.keys(state.cleared).filter(function(k){return Number(k)>=11&&Number(k)<=30;}).length;
    if (prog) prog.textContent = state.world2Unlocked ? (clearedWorld + '/20 màn đã chinh phục • Màn tiếp theo: ' + Math.min(30, Math.max(11, Number(state.bestWorld2Stage || 10) + 1))) : 'Mở khóa sau khi chiến thắng màn 10.';
    var grid = document.getElementById('worldTwoStageGrid');
    if (grid) {
      grid.replaceChildren();
      world2Stages.forEach(function (cfg) {
        var card = document.createElement('article');
        card.className = 'world-stage-card' + (cfg.bossStage ? ' boss' : '') + (state.cleared[String(cfg.stage)] ? ' clear' : '');
        var unlocked = !!state.world2Unlocked && (cfg.stage <= Number(state.bestWorld2Stage || 10) + 1);
        if (!unlocked) card.classList.add('locked');
        var badge = document.createElement('span');
        badge.className = 'world-stage-number';
        badge.textContent = 'THẾ GIỚI II • MÀN ' + (cfg.stage - 10) + (cfg.bossStage ? ' • BOSS' : ' • QUÁI');
        var title = document.createElement('strong'); title.textContent = cfg.name;
        var desc = document.createElement('p'); desc.textContent = cfg.desc;
        var reward = document.createElement('p'); reward.textContent = '+' + cfg.shards.toLocaleString('vi-VN') + ' 💎 thưởng màn';
        var btn = document.createElement('button');
        btn.textContent = state.cleared[String(cfg.stage)] ? 'CHƠI LẠI' : (unlocked ? 'XUẤT KÍCH' : '🔒 CHƯA MỞ');
        btn.disabled = !unlocked;
        btn.addEventListener('click', function(){ startGame(cfg.stage); });
        card.append(badge,title,desc,reward,btn);
        grid.appendChild(card);
      });
    }
  }

  window.renderChronoEvents = renderEvents;
  window.enterWorldTwoFromEvents = function () {
    if (!state.world2Unlocked) { if (typeof showToast === 'function') showToast('Hãy đánh bại màn 10 để mở cổng!', '🔒'); return; }
    if (typeof switchHubTab === 'function') switchHubTab('events');
    var portal = document.getElementById('worldTwoPortalIntro');
    if (portal) portal.remove();
    if (typeof startGame === 'function') startGame(Math.min(30, Math.max(11, Number(state.bestWorld2Stage || 10) + 1)));
  };

  var oldSwitch = window.switchHubTab;
  if (typeof oldSwitch === 'function') {
    window.switchHubTab = function (tabName) {
      var result = oldSwitch.apply(this, arguments);
      var tab = document.getElementById('tabContentEvents');
      var btn = document.getElementById('tabBtnEvents');
      if (tab) tab.classList.toggle('hidden', tabName !== 'events');
      if (btn) btn.className = 'flex-1 py-2.5 px-2 text-center transition flex items-center justify-center space-x-1 whitespace-nowrap ' + (tabName === 'events' ? 'text-amber-200 border-b-2 border-amber-400 bg-amber-950/30' : 'text-slate-400 hover:text-amber-300');
      if (tabName === 'events') renderEvents();
      return result;
    };
  }

  var oldUpdateHub = window.updateHubUI;
  if (typeof oldUpdateHub === 'function') {
    window.updateHubUI = function () {
      var result = oldUpdateHub.apply(this, arguments);
      saveProgress();
      return result;
    };
  }

  var oldStartGame = window.startGame;
  if (typeof oldStartGame === 'function') {
    window.startGame = function (stageNum) {
      stageNum = Number(stageNum || 1);
      if (stageNum > 10 && !state.world2Unlocked) {
        if (typeof showToast === 'function') showToast('Thế giới II chỉ mở sau khi thắng màn 10.', '🔒');
        return;
      }
      if (stageNum > 11 && stageNum <= 30 && stageNum > Number(state.bestWorld2Stage || 10) + 1) {
        if (typeof showToast === 'function') showToast('Hãy chinh phục màn trước để mở màn này.', '🔒');
        return;
      }
      var result = oldStartGame.apply(this, [stageNum]);
      renderEvents();
      saveProgress();
      return result;
    };
  }

  var oldNextStage = window.nextStage;
  window.nextStage = function () {
    if (typeof currentStage === 'undefined') return;
    if (currentStage < 30) {
      if (currentStage === 10 && !state.world2Unlocked) {
        if (typeof showToast === 'function') showToast('Cổng không gian đã mở! Hãy bước vào Thế giới II.', '🌀');
        if (typeof enterWorldTwoFromEvents === 'function') enterWorldTwoFromEvents();
      } else if (currentStage >= 10) {
        if (typeof startGame === 'function') startGame(currentStage + 1);
      } else if (typeof startGame === 'function') {
        startGame(currentStage + 1);
      }
    } else {
      if (typeof goToHubFromGame === 'function') goToHubFromGame();
      if (typeof switchHubTab === 'function') switchHubTab('events');
      if (typeof showToast === 'function') showToast('Đã hoàn tất 20 màn Thế giới II!', '👑');
    }
  };

  var oldClear = window.onStageClear;
  if (typeof oldClear === 'function') {
    window.onStageClear = function () {
      if (typeof gameState !== 'undefined' && gameState !== 'PLAYING') return;
      var stage = Number(currentStage || 1);
      var wasUnlocked = !!state.world2Unlocked;
      var result = oldClear.apply(this, arguments);
      state.cleared[String(stage)] = true;
      if (stage <= 10) state.bestMainStage = Math.max(Number(state.bestMainStage || 0), stage);
      if (stage >= 11 && stage <= 30) state.bestWorld2Stage = Math.max(Number(state.bestWorld2Stage || 10), stage);
      var extra = 0;
      if (stage === 5) extra += claimMilestone(5, 3000);
      if (stage === 10) extra += claimMilestone(10, 6000);
      if (stage === 10) state.world2Unlocked = true;
      if (extra > 0) {
        if (typeof showToast === 'function') showToast('Thưởng sự kiện: +' + extra.toLocaleString('vi-VN') + ' kim cương!', '💎');
        var txt = document.getElementById('victoryRewardText');
        if (txt && stage >= 3) txt.innerHTML += ' <span class="event-bonus-reward">+' + extra.toLocaleString('vi-VN') + ' 💎 SỰ KIỆN</span>';
        if (typeof updateHubUI === 'function') updateHubUI();
      }
      saveProgress();
      renderEvents();
      if (stage === 10 && !wasUnlocked) showPortalIntro();
      if (stage === 30) setTimeout(function(){ showFinalWorldTwo(); }, 250);
      return result;
    };
  }

  function showPortalIntro() {
    if (document.getElementById('worldTwoPortalIntro')) return;
    var overlay = document.createElement('div');
    overlay.id = 'worldTwoPortalIntro';
    overlay.className = 'world-portal-overlay';
    overlay.innerHTML = '<div class="world-portal-scene"><div class="world-portal-ring"><span>神</span></div><span class="event-card-kicker">MAIN STORY CLEAR • SECRET MISSION UNLOCKED</span><h2>CỔNG KHÔNG GIAN ĐÃ THỨC TỈNH</h2><p>Chiến thắng Điện Thờ Tối Thượng đã phá vỡ phong ấn. Phía bên kia là Thế giới II — lãnh địa của Những Kẻ Xưng Thần.</p><div class="portal-reward">NHIỆM VỤ ĐẶC BIỆT ĐÃ MỞ • 20 MÀN MỚI</div><button id="worldTwoPortalEnter" class="event-portal-button">BƯỚC QUA CỔNG ✦</button><button id="worldTwoPortalLater" class="portal-later">Để sau • xem trong Sự kiện</button></div>';
    document.body.appendChild(overlay);
    var enter = document.getElementById('worldTwoPortalEnter');
    if (enter) enter.addEventListener('click', function(){ overlay.remove(); window.enterWorldTwoFromEvents(); });
    var later = document.getElementById('worldTwoPortalLater');
    if (later) later.addEventListener('click', function(){ overlay.remove(); if (typeof goToHubFromGame==='function') goToHubFromGame(); if(typeof switchHubTab==='function')switchHubTab('events'); });
  }

  function showFinalWorldTwo() {
    var overlay = document.createElement('div');
    overlay.className = 'world-portal-overlay';
    overlay.innerHTML = '<div class="world-portal-scene"><div class="world-portal-ring"><span>♛</span></div><span class="event-card-kicker">WORLD II • FINAL CONQUEST</span><h2>THẦN GIỚI ĐÃ SỤP ĐỔ</h2><p>Bạn đã đánh bại Đấng Xưng Thần Vô Danh và hoàn tất toàn bộ 20 màn của Thế giới II.</p><div class="portal-reward">DANH HIỆU MỚI: KẺ VƯỢT QUA THẦN GIỚI</div><button class="event-portal-button">ĐÓNG</button></div>';
    document.body.appendChild(overlay);
    overlay.querySelector('button').addEventListener('click', function(){overlay.remove();if(typeof goToHubFromGame==='function')goToHubFromGame();if(typeof switchHubTab==='function')switchHubTab('events');});
  }

  function addGachaSpotlight() {
    var banner = document.querySelector('#tabContentGacha .gacha-feature-banner');
    if (!banner || document.getElementById('cpGachaSpotlight')) return;
    var spotlight = document.createElement('div');
    spotlight.id = 'cpGachaSpotlight';
    spotlight.className = 'cp-gacha-spotlight';
    spotlight.innerHTML = '<div class="cp-gacha-art"><svg viewBox="0 0 100 130" role="img" aria-label="Thánh kiếm Genesis"><defs><linearGradient id="cpBlade" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff7ed"/><stop offset=".36" stop-color="#fbbf24"/><stop offset=".7" stop-color="#f472b6"/><stop offset="1" stop-color="#a855f7"/></linearGradient></defs><path d="M50 7 62 48 54 75 50 90 46 75 38 48Z" fill="url(#cpBlade)" stroke="#fff7ed" stroke-width="1.5"/><path d="M30 66 70 66 62 75 38 75Z" fill="#fbbf24" stroke="#fff7ed"/><path d="M45 76 55 76 58 105 50 124 42 105Z" fill="#7e22ce" stroke="#f0abfc" stroke-width="2"/><path d="M50 12 50 89" stroke="#fff" stroke-opacity=".85" stroke-width="1.5"/><circle cx="50" cy="70" r="30" fill="none" stroke="#f0abfc" stroke-dasharray="3 5" opacity=".7"/></svg></div><div class="cp-gacha-copy"><span class="event-card-kicker">BANNER ĐỀ CỬ • THÁNH KHÍ THỜI KHÔNG</span><h4>GENESIS VÔ HẠN</h4><p>Triệu hồi thánh khí và trang bị cấp cao. Theo dõi Pity 90 và cơ chế bảo hiểm 50/50 ngay bên dưới.</p><div class="cp-gacha-pills"><span>✦ SSS TỐI THƯỢNG</span><span>◈ PITY 90</span><span>✧ BẢO HIỂM 100%</span></div></div>';
    banner.insertBefore(spotlight, banner.firstChild);
  }

  var gacha = window.doGachaRoll;
  if (typeof gacha === 'function') {
    window.doGachaRoll = function () {
      var result = gacha.apply(this, arguments);
      saveProgress();
      return result;
    };
  }
  var init = function () { addGachaSpotlight(); renderEvents(); saveProgress(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  var oldLoad = window.onload;
  window.addEventListener('load', function(){ addGachaSpotlight(); renderEvents(); saveProgress(); });
})();