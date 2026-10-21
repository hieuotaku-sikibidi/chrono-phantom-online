/* Chrono Phantom — Shadow SSS+ Special: character styling, Atomic cinematic and ruined-city domain */
(function () {
  'use strict';
  if (window.__cpShadowSpecialLoaded) return;
  window.__cpShadowSpecialLoaded = true;

  var css = document.createElement('style');
  css.textContent = [
    '.rank-SSS-SPEC.shadow-special-card{border-color:#c084fc!important;color:#f5d0fe!important;background:linear-gradient(135deg,rgba(88,28,135,.48),rgba(5,5,16,.96) 58%,rgba(49,46,129,.42))!important;box-shadow:0 0 20px #7c3aed99,inset 0 0 18px #c084fc25!important;animation:shadowSpecialPulse 1.7s ease-in-out infinite alternate}',
    '.shadow-special-card h5{color:#f5d0fe!important;text-shadow:0 0 12px #a855f799}',
    '.shadow-special-card .shadow-rank-stamp{display:inline-block;white-space:nowrap;padding:2px 5px;border:1px solid #c084fc;border-radius:5px;color:#f5d0fe;background:#2e1065;font:900 7px monospace;letter-spacing:.06em}',
    '#charShowcaseTitle.shadow-special-title{color:#e9d5ff!important;text-shadow:0 0 15px #9333ea}',
    '@keyframes shadowSpecialPulse{from{filter:drop-shadow(0 0 4px #7c3aed)}to{filter:drop-shadow(0 0 14px #c084fc)}}',
    '@media(prefers-reduced-motion:reduce){.shadow-special-card{animation:none!important}}'
  ].join('\n');
  document.head.appendChild(css);

  var DOMAIN = window.__cpShadowDomain = {
    active: false, expiresAt: 0, buffActive: false, buffExpiresAt: 0,
    baseAtk: null, baseSpeed: null, hadSpeed: false, startAt: 0, timerId: 0
  };

  function dependenciesReady() {
    return typeof CHARACTER_DATABASE !== 'undefined' &&
      typeof playerData !== 'undefined' && Array.isArray(CHARACTER_DATABASE);
  }

  function configureCharacter() {
    if (!dependenciesReady()) return;
    var sh = CHARACTER_DATABASE.find(function (c) { return c.id === 'char_shadow'; });
    var yu = CHARACTER_DATABASE.find(function (c) { return c.id === 'char_yuno'; });
    if (yu) {
      yu.codeLocked = true;
      yu.price = 0;
      yu.rankLabel = 'SSS ĐẶC BIỆT';
    }
    if (sh) {
      sh.rank = 'SSS';
      sh.rankLabel = 'SSS+ ĐẶC BIỆT';
      sh.title = 'SSS+ ĐẶC BIỆT • SHADOW EMPEROR';
      sh.isUltimate = true;
      sh.isShadow = true;
      sh.codeLocked = true;
      sh.price = 0;
      sh.unlocked = !!sh.unlocked;
      sh.avatarIcon = '影';
      sh.hpMult = 4.1;
      sh.atkMult = 5.4;
      sh.defMult = 3.1;
      sh.critBonus = 45;
      sh.lifesteal = 0.06;
      sh.cdrBonus = 15;
      sh.skillLabels = { e: 'E: SHADOW STEP', r: 'R: BLACK KNIGHT', q: 'Q: I AM ATOMIC' };
      sh.desc = 'Shadow • pháp sư bóng tối tối thượng. Áo choàng đen rách viền tím, giáp obsidian, mắt lam phát sáng và kiếm ma lực. Q tạo vụ nổ nguyên tử rồi mở lãnh địa thành phố đổ nát trong 10 giây.';
    }
  }

  function paintShadowBack(c, p) {
    var t = typeof gameTime === 'number' ? gameTime : 0;
    var moving = Math.abs(p.vx || 0) > 10;
    var sway = Math.sin(t * 4.8 + (p.animTimer || 0)) * 4.8 + (moving ? -5 : 0);
    c.save(); c.translate(p.x, p.y);
    if (p.facing === -1) c.scale(-1, 1);
    c.save(); c.globalCompositeOperation = 'lighter';
    c.globalAlpha = .22 + .08 * Math.sin(t * 3.5);
    c.strokeStyle = '#9333ea'; c.lineWidth = 1.1; c.shadowColor = '#a855f7'; c.shadowBlur = 15;
    c.beginPath(); c.ellipse(0, -29, 25 + Math.sin(t * 2) * 2, 31, t * .18, 0, Math.PI * 2); c.stroke();
    c.restore();
    var cape = c.createLinearGradient(-24, -40, 17, 3);
    cape.addColorStop(0, '#242038'); cape.addColorStop(.33, '#0d0b19'); cape.addColorStop(.7, '#080711'); cape.addColorStop(1, '#321052');
    c.fillStyle = cape; c.strokeStyle = '#7e22ce'; c.lineWidth = 1.25;
    c.beginPath(); c.moveTo(-7, -31); c.lineTo(6, -31);
    c.quadraticCurveTo(17, -23, 20 + sway, -13); c.lineTo(17 + sway, -4);
    c.lineTo(10 + sway * .7, -9); c.lineTo(5, -1); c.lineTo(0, -8); c.lineTo(-5, 1);
    c.lineTo(-11, -7); c.lineTo(-18 + sway * .65, -2);
    c.quadraticCurveTo(-24 + sway, -20, -7, -31); c.closePath(); c.fill(); c.stroke();
    var tailGrad = c.createLinearGradient(-17, -18, 20, 5);
    tailGrad.addColorStop(0, '#100b1c'); tailGrad.addColorStop(.65, '#201035'); tailGrad.addColorStop(1, '#6d28d9');
    c.fillStyle = tailGrad; c.strokeStyle = '#a855f7'; c.lineWidth = .8;
    c.beginPath(); c.moveTo(-14, -13); c.quadraticCurveTo(-25 + sway, -2, -21 + sway, 8);
    c.lineTo(-14 + sway * .45, 2); c.lineTo(-10, 8); c.lineTo(-9, -7); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(9, -13); c.quadraticCurveTo(22 + sway, -2, 18 + sway, 8);
    c.lineTo(11 + sway, 3); c.lineTo(7, 7); c.lineTo(6, -7); c.closePath(); c.fill(); c.stroke();
    c.save(); c.globalCompositeOperation = 'lighter';
    for (var i = 0; i < 7; i++) {
      var a = t * (i % 2 ? -1 : 1) * (.55 + i * .065) + i * Math.PI * 2 / 7;
      var rx = Math.cos(a) * (19 + (i % 3) * 3), ry = -29 + Math.sin(a) * 17;
      c.globalAlpha = .28 + .38 * (.5 + .5 * Math.sin(t * 5 + i));
      c.fillStyle = i % 3 === 0 ? '#67e8f9' : (i % 2 ? '#e9d5ff' : '#a855f7');
      c.shadowColor = c.fillStyle; c.shadowBlur = 7;
      c.beginPath(); c.moveTo(rx, ry - 3.5); c.lineTo(rx + 2.7, ry);
      c.lineTo(rx, ry + 3.5); c.lineTo(rx - 2.7, ry); c.closePath(); c.fill();
    }
    c.restore(); c.restore();
  }

  function paintShadowFront(c, p) {
    var t = typeof gameTime === 'number' ? gameTime : 0;
    var moving = Math.abs(p.vx || 0) > 10, attacking = p.state === 'ATTACK';
    var bob = Math.sin((p.animTimer || 0) * 5) * 1.1;
    var sway = Math.sin(t * 6.5) * 1.6 + (moving ? -1.8 : 0);
    c.save(); c.translate(p.x, p.y);
    if (p.facing === -1) c.scale(-1, 1);

    /* Polished boots and segmented greaves sit above the original leg animation. */
    c.save();
    var boot = c.createLinearGradient(-10, -10, 10, 0);
    boot.addColorStop(0, '#343044'); boot.addColorStop(.46, '#090812'); boot.addColorStop(1, '#211032');
    c.fillStyle = boot; c.strokeStyle = '#6d28d9'; c.lineWidth = .8;
    c.beginPath(); c.moveTo(-10, -10); c.lineTo(-2, -9); c.lineTo(-1, -2);
    c.lineTo(-5, 0); c.lineTo(-13, 0); c.lineTo(-12, -3); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(2, -9); c.lineTo(10, -10); c.lineTo(12, -3);
    c.lineTo(14, 0); c.lineTo(4, 0); c.lineTo(1, -3); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = '#c4b5fd'; c.lineWidth = .7;
    c.beginPath(); c.moveTo(-10, -6); c.lineTo(-3, -5); c.moveTo(3, -5); c.lineTo(10, -6); c.stroke();
    c.restore();

    /* The signature split coat: dark satin panels, silver seams and torn violet edges. */
    c.save(); c.shadowColor = '#7e22ce'; c.shadowBlur = 7;
    var coat = c.createLinearGradient(-17, -33, 17, -4);
    coat.addColorStop(0, '#29253a'); coat.addColorStop(.28, '#11101b'); coat.addColorStop(.64, '#070710'); coat.addColorStop(1, '#27103d');
    c.fillStyle = coat; c.strokeStyle = '#8b5cf6'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(-8, -30); c.lineTo(-3, -32); c.lineTo(4, -32); c.lineTo(9, -29);
    c.lineTo(12, -21); c.lineTo(17 + sway, -8); c.lineTo(10, -11); c.lineTo(7, -5);
    c.lineTo(2, -10); c.lineTo(0, -5); c.lineTo(-4, -10); c.lineTo(-8, -5);
    c.lineTo(-10, -12); c.lineTo(-17 - sway, -7); c.lineTo(-12, -22); c.closePath(); c.fill(); c.stroke();
    c.shadowBlur = 0;

    /* Raised collar and custom pauldrons. */
    c.fillStyle = '#090811'; c.strokeStyle = '#c4b5fd'; c.lineWidth = .8;
    c.beginPath(); c.moveTo(-8, -30); c.lineTo(-5, -37); c.lineTo(-1, -31);
    c.lineTo(1, -31); c.lineTo(6, -37); c.lineTo(9, -29); c.lineTo(3, -25); c.lineTo(-3, -25); c.closePath(); c.fill(); c.stroke();
    var armor = c.createLinearGradient(-15, -31, 12, -23);
    armor.addColorStop(0, '#38334b'); armor.addColorStop(.5, '#14111f'); armor.addColorStop(1, '#090811');
    c.fillStyle = armor; c.strokeStyle = '#a855f7'; c.lineWidth = .9;
    c.beginPath(); c.moveTo(-8, -28); c.lineTo(-15, -29); c.lineTo(-18, -24); c.lineTo(-12, -21); c.lineTo(-7, -24); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(8, -28); c.lineTo(15, -30); c.lineTo(18, -24); c.lineTo(12, -21); c.lineTo(7, -24); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = '#67e8f9'; c.lineWidth = .8;
    c.beginPath(); c.moveTo(-14, -25); c.lineTo(-9, -24); c.moveTo(9, -24); c.lineTo(14, -25); c.stroke();

    /* Chestplate, crossed seams and astral clasp. */
    c.fillStyle = '#0a0914'; c.strokeStyle = '#5b3a83'; c.lineWidth = .7;
    c.beginPath(); c.moveTo(-7, -28); c.lineTo(7, -28); c.lineTo(6, -17); c.lineTo(0, -13); c.lineTo(-6, -17); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = '#d8b4fe'; c.lineWidth = .8;
    c.beginPath(); c.moveTo(-5, -26); c.lineTo(3, -17); c.moveTo(5, -26); c.lineTo(-1, -19); c.stroke();
    c.fillStyle = '#c084fc'; c.shadowColor = '#a855f7'; c.shadowBlur = 9;
    c.beginPath(); c.moveTo(0, -25); c.lineTo(3.4, -21); c.lineTo(0, -17); c.lineTo(-3.4, -21); c.closePath(); c.fill(); c.shadowBlur = 0;

    /* Waist sash and metal buckle. */
    c.fillStyle = '#05050c'; c.strokeStyle = '#7e22ce'; c.lineWidth = .8;
    c.beginPath(); c.moveTo(-8, -15); c.lineTo(8, -15); c.lineTo(10, -11); c.lineTo(0, -9); c.lineTo(-10, -11); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = '#d8b4fe'; c.lineWidth = .65;
    c.beginPath(); c.moveTo(-7, -13); c.lineTo(7, -13); c.moveTo(-6, -10); c.lineTo(5, -10); c.stroke();
    c.fillStyle = '#67e8f9'; c.shadowColor = '#67e8f9'; c.shadowBlur = 7;
    c.beginPath(); c.moveTo(0, -14); c.lineTo(2.5, -12); c.lineTo(0, -10); c.lineTo(-2.5, -12); c.closePath(); c.fill(); c.shadowBlur = 0;

    /* Layered black hair with silver strands. */
    var hair = c.createLinearGradient(-10, -48, 10, -31);
    hair.addColorStop(0, '#282438'); hair.addColorStop(.4, '#080811'); hair.addColorStop(1, '#171027');
    c.fillStyle = hair; c.strokeStyle = '#4c3a68'; c.lineWidth = .7;
    c.beginPath(); c.moveTo(-9, -38); c.lineTo(-12, -45); c.lineTo(-6, -43); c.lineTo(-3, -50);
    c.lineTo(0, -45); c.lineTo(5, -49); c.lineTo(7, -43); c.lineTo(12, -45);
    c.lineTo(9, -37); c.lineTo(7, -31); c.lineTo(-7, -31); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = '#7c6c99'; c.lineWidth = .65;
    c.beginPath(); c.moveTo(-7, -43); c.lineTo(-3, -39); c.moveTo(5, -43); c.lineTo(2, -39); c.stroke();

    /* Sculpted face and half-mask with animated cyan eyes. */
    var face = c.createLinearGradient(-7, -40, 8, -30);
    face.addColorStop(0, '#f1d9ce'); face.addColorStop(.55, '#c6a6a6'); face.addColorStop(1, '#6f526e');
    c.fillStyle = face; c.strokeStyle = '#392641'; c.lineWidth = .65;
    c.beginPath(); c.moveTo(-7, -38); c.lineTo(7, -38); c.lineTo(6, -32); c.lineTo(2, -29); c.lineTo(-3, -29); c.lineTo(-7, -33); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#080711'; c.strokeStyle = '#7e22ce'; c.lineWidth = .55;
    c.beginPath(); c.moveTo(-7, -36); c.lineTo(7, -36); c.lineTo(6, -32); c.lineTo(1, -31); c.lineTo(-6, -32); c.closePath(); c.fill(); c.stroke();
    c.globalCompositeOperation = 'lighter';
    c.shadowColor = '#67e8f9'; c.shadowBlur = 10; c.fillStyle = '#e0fbff';
    c.beginPath(); c.moveTo(-5.5, -34.5); c.lineTo(-1.7, -33.7); c.lineTo(-4.2, -32.8); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(1.7, -33.7); c.lineTo(5.5, -34.5); c.lineTo(4.2, -32.8); c.closePath(); c.fill();
    c.shadowBlur = 0; c.strokeStyle = '#67e8f9'; c.lineWidth = .7;
    c.beginPath(); c.moveTo(-8, -36.7); c.lineTo(-1, -36.2); c.moveTo(1, -36.2); c.lineTo(8, -36.7); c.stroke();

    /* Long cheek locks, crest and animated hair glints. */
    c.strokeStyle = '#a78bfa'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(-8, -39); c.quadraticCurveTo(-12 - sway, -33, -8 - sway, -27);
    c.moveTo(8, -39); c.quadraticCurveTo(12 + sway, -33, 9 + sway, -28); c.stroke();
    c.strokeStyle = '#67e8f9'; c.lineWidth = .75;
    c.beginPath(); c.moveTo(-3, -47); c.lineTo(-1, -43); c.moveTo(5, -46); c.lineTo(4, -43); c.stroke();
    c.fillStyle = '#c084fc'; c.shadowColor = '#c084fc'; c.shadowBlur = 8;
    c.beginPath(); c.moveTo(0, -48); c.lineTo(2.3, -44); c.lineTo(0, -41); c.lineTo(-2.3, -44); c.closePath(); c.fill(); c.shadowBlur = 0;

    /* Distinct obsidian katana with a violet-cyan energy core. */
    c.save(); c.translate(9, -18 + bob); c.rotate(attacking ? -.94 + Math.sin(t * 35) * .18 : -.28);
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = '#05050c'; c.lineWidth = 4.6; c.beginPath(); c.moveTo(-2, 6); c.lineTo(3, 0); c.stroke();
    c.strokeStyle = '#c4b5fd'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, 2); c.lineTo(5, -2); c.stroke();
    c.strokeStyle = '#7e22ce'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(3, 0); c.lineTo(25, -22); c.stroke();
    var blade = c.createLinearGradient(3, 0, 26, -23);
    blade.addColorStop(0, '#2e1065'); blade.addColorStop(.42, '#c084fc'); blade.addColorStop(.73, '#f5f3ff'); blade.addColorStop(1, '#67e8f9');
    c.fillStyle = blade; c.shadowColor = '#a855f7'; c.shadowBlur = 11;
    c.beginPath(); c.moveTo(3, -1); c.lineTo(21, -21); c.lineTo(28, -25); c.lineTo(24, -16); c.lineTo(5, 2); c.closePath(); c.fill();
    c.shadowBlur = 0; c.strokeStyle = '#ffffff'; c.lineWidth = .7;
    c.beginPath(); c.moveTo(6, -3); c.lineTo(23, -21); c.stroke();
    c.strokeStyle = '#67e8f9'; c.lineWidth = .8; c.beginPath(); c.moveTo(9, -6); c.lineTo(20, -17); c.stroke();
    c.restore();

    c.save(); c.globalCompositeOperation = 'lighter';
    c.globalAlpha = .38 + .18 * Math.sin(t * 8); c.strokeStyle = '#a855f7'; c.lineWidth = .9;
    c.beginPath(); c.arc(0, -25 + bob, 18 + Math.sin(t * 3) * 1.4, t * .8, t * .8 + Math.PI * 1.3); c.stroke();
    for (var k = 0; k < 4; k++) {
      var a = t * (k % 2 ? -1 : 1) * 1.7 + k * Math.PI / 2;
      var rx = Math.cos(a) * (20 + k * 1.5), ry = -25 + Math.sin(a) * 13;
      c.globalAlpha = .38 + .32 * (.5 + .5 * Math.sin(t * 8 + k));
      c.fillStyle = k % 2 ? '#67e8f9' : '#e9d5ff'; c.shadowColor = c.fillStyle; c.shadowBlur = 7;
      c.beginPath(); c.arc(rx, ry, k === 0 ? 1.8 : 1.1, 0, Math.PI * 2); c.fill();
    }
    c.restore();
    if (attacking) {
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = .75;
      c.strokeStyle = '#f5d0fe'; c.lineWidth = 2.5; c.shadowColor = '#a855f7'; c.shadowBlur = 10;
      c.beginPath(); c.arc(10, -22, 28, -1.5 + (p.animFrame || 0) * .35, .5 + (p.animFrame || 0) * .35); c.stroke();
      c.strokeStyle = '#67e8f9'; c.lineWidth = 1;
      c.beginPath(); c.arc(10, -22, 32, -1.35 + (p.animFrame || 0) * .35, .28 + (p.animFrame || 0) * .35); c.stroke();
    }
    c.restore();
  }

  function drawRuinedSkyline(c, progress, cinematic) {
    var ground = typeof GROUND_Y === 'number' ? GROUND_Y : 210;
    var width = typeof V_WIDTH === 'number' ? V_WIDTH : 480;
    var height = typeof V_HEIGHT === 'number' ? V_HEIGHT : 270;
    var cx = width / 2;
    c.save();
    c.globalAlpha = cinematic ? 1 : .76;
    for (var i = 0; i < 17; i++) {
      var x = i * (width / 16) - 10;
      var w = 15 + (i * 7 % 12);
      var h = 25 + (i * 29 % 57);
      var dist = Math.abs((x + w / 2) - cx) / (width * .53);
      var collapse = cinematic ? Math.max(0, Math.min(1, (progress - .36 - dist * .22) * 3.6)) : 1;
      var lean = (i % 2 ? 1 : -1) * collapse * (.18 + (i % 4) * .08);
      var drop = collapse * (7 + (i % 5) * 4);
      c.save();
      c.translate(x + w / 2, ground + drop);
      c.rotate(lean);
      c.fillStyle = i % 3 === 0 ? '#10091e' : '#090713';
      c.strokeStyle = i % 2 === 0 ? '#6d28d966' : '#31204e';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(-w / 2, 0); c.lineTo(-w / 2, -h * .78);
      c.lineTo(-w * .23, -h); c.lineTo(-w * .04, -h * .73);
      c.lineTo(w * .18, -h * (.91 - (i % 3) * .06)); c.lineTo(w / 2, -h * .72);
      c.lineTo(w / 2, 0); c.closePath(); c.fill(); c.stroke();
      c.globalCompositeOperation = 'lighter';
      for (var win = 0; win < 4; win++) {
        var wx = -w / 2 + 3 + (win % 2) * Math.max(4, w * .45);
        var wy = -h * (.2 + (Math.floor(win / 2)) * .25);
        c.globalAlpha = (cinematic ? .32 : .22) * (0.5 + .5 * Math.sin((typeof gameTime === 'number' ? gameTime : 0) * 2 + i + win));
        c.fillStyle = win % 2 ? '#a855f7' : '#67e8f9';
        c.fillRect(wx, wy, 2.1, 3.5);
      }
      c.globalAlpha = cinematic ? 1 : .76;
      c.restore();
      /* Fallen masonry, broken spires and rubble at street level. */
      c.fillStyle = i % 2 ? '#171027' : '#211434';
      c.beginPath();
      c.moveTo(x - 1, ground - 1); c.lineTo(x + 5, ground - 5 - (i % 3) * 2);
      c.lineTo(x + 12, ground - 2); c.lineTo(x + w + 5, ground);
      c.closePath(); c.fill();
    }
    if (cinematic) {
      c.globalAlpha = .35;
      c.fillStyle = '#020107'; c.fillRect(0, ground + 4, width, height - ground);
    }
    c.restore();
  }

  function drawAtomicDomain(c) {
    if (!DOMAIN.active) return;
    var now = performance.now();
    var remain = Math.max(0, (DOMAIN.expiresAt - now) / 1000);
    if (remain <= 0) { DOMAIN.active = false; return; }
    var w = typeof V_WIDTH === 'number' ? V_WIDTH : 480;
    var h = typeof V_HEIGHT === 'number' ? V_HEIGHT : 270;
    var ground = typeof GROUND_Y === 'number' ? GROUND_Y : 210;
    var t = typeof gameTime === 'number' ? gameTime : 0;
    var fade = Math.min(1, remain * 2.3);
    c.save();
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = .34 * fade;
    var veil = c.createLinearGradient(0, 0, 0, ground);
    veil.addColorStop(0, '#090414'); veil.addColorStop(.62, '#1d0a3a'); veil.addColorStop(1, '#0b0716');
    c.fillStyle = veil; c.fillRect(0, 0, w, ground + 1);
    drawRuinedSkyline(c, 1, false);
    c.globalCompositeOperation = 'lighter';
    var cx = w / 2, pulse = .5 + .5 * Math.sin(t * 4.2);
    c.globalAlpha = (.12 + pulse * .06) * fade;
    var glow = c.createRadialGradient(cx, ground - 42, 4, cx, ground - 42, w * .68);
    glow.addColorStop(0, '#a855f7'); glow.addColorStop(.45, '#581c8799'); glow.addColorStop(1, 'rgba(4,0,18,0)');
    c.fillStyle = glow; c.fillRect(0, 0, w, ground);
    c.globalAlpha = (.35 + pulse * .26) * fade;
    c.strokeStyle = '#c084fc'; c.lineWidth = 1.5;
    c.beginPath(); c.ellipse(cx, ground, Math.min(w*.46,w*(.33+.23*pulse)), 17 + pulse * 7, 0, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = '#7c3aed'; c.lineWidth = 2;
    c.beginPath(); c.ellipse(cx, ground, Math.min(w*.46,w*.61), 27 + pulse * 5, 0, 0, Math.PI * 2); c.stroke();
    c.setLineDash([9, 6]); c.lineWidth = .9; c.strokeStyle = '#e9d5ff';
    c.beginPath(); c.ellipse(cx, ground - 58, Math.min(w*.46,w*.49), 105, 0, Math.PI, Math.PI * 2); c.stroke(); c.setLineDash([]);
    /* Collapsing purple skyline cracks and dust. */
    for (var i = 0; i < 15; i++) {
      var x = (i * 41 + 11) % w;
      var y = ground - (10 + (i * 19) % 74);
      var drift = Math.sin(t * 3 + i * 1.7) * 5;
      c.globalAlpha = (.2 + .45 * ((Math.sin(t * 5 + i) + 1) / 2)) * fade;
      c.strokeStyle = i % 3 ? '#a855f7' : '#67e8f9'; c.lineWidth = i % 4 === 0 ? 1.6 : .7;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + drift, y + 9); c.lineTo(x - drift * .5, y + 18); c.stroke();
    }
    for (var j = 0; j < 22; j++) {
      var px = (j * 59 + t * (23 + j % 4 * 7)) % (w + 20) - 10;
      var py = ground - 8 - ((t * (17 + j % 5 * 4) + j * 13) % (ground + 20));
      c.globalAlpha = (.18 + .4 * ((Math.sin(t * 4 + j) + 1) / 2)) * fade;
      c.fillStyle = j % 3 ? '#c084fc' : '#f5d0fe';
      c.beginPath(); c.moveTo(px, py - 2.5); c.lineTo(px + 2, py); c.lineTo(px, py + 2.5); c.lineTo(px - 2, py); c.closePath(); c.fill();
    }
    c.globalAlpha = .92; c.fillStyle = '#f5d0fe'; c.font = 'bold 8px monospace'; c.textAlign = 'center';
    c.shadowColor = '#a855f7'; c.shadowBlur = 9;
    c.fillText('I AM ATOMIC • LÃNH ĐỊA BÓNG TỐI • ' + Math.ceil(remain) + 's', cx, 16);
    c.restore();
  }

  function drawAtomicCutscene(c) {
    var p = 1 - Math.max(0, burstCutscene.timer) / Math.max(.01, burstCutscene.maxTimer);
    var w = V_WIDTH, h = V_HEIGHT, ground = GROUND_Y, cx = w / 2, cy = ground - 59;
    var t = typeof gameTime === 'number' ? gameTime : 0;
    var charge = Math.max(0, Math.min(1, p / .29));
    var impact = Math.max(0, Math.min(1, (p - .27) / .24));
    var aftermath = Math.max(0, Math.min(1, (p - .48) / .52));
    c.save();
    // Fallback cut-in also ignores any residual world/camera transform.
    if (typeof c.setTransform === 'function') c.setTransform(1,0,0,1,0,0);
    c.beginPath(); c.rect(0,0,w,h); c.clip();
    c.globalCompositeOperation = 'source-over';
    var bg = c.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#030208'); bg.addColorStop(.42, '#17052e'); bg.addColorStop(1, '#05030b');
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(0,0,0,.72)'; c.fillRect(0,0,w,8); c.fillRect(0,h-8,w,8);
    /* Atomic energy gathers around Shadow's silhouette. */
    c.globalCompositeOperation = 'lighter';
    for (var r = 0; r < 4; r++) {
      c.globalAlpha = (.2 + .18 * charge) * (1 - impact * .35);
      c.strokeStyle = r % 2 ? '#e9d5ff' : '#a855f7'; c.lineWidth = r === 0 ? 2 : 1;
      c.beginPath(); c.ellipse(cx, cy, 14 + charge * (20 + r * 12), 7 + charge * (11 + r * 5), (r % 2 ? -1 : 1) * t * (1 + r * .25), 0, Math.PI * 2); c.stroke();
    }
    var orbR = 5 + charge * 28;
    var orb = c.createRadialGradient(cx, cy, 1, cx, cy, orbR * 2.8);
    orb.addColorStop(0, '#ffffff'); orb.addColorStop(.14, '#f5d0fe'); orb.addColorStop(.4, '#c084fc'); orb.addColorStop(1, 'rgba(124,58,237,0)');
    c.globalAlpha = .25 + .75 * charge; c.fillStyle = orb; c.fillRect(cx-orbR*3, cy-orbR*3, orbR*6, orbR*6);
    c.globalCompositeOperation = 'source-over';
    /* Standalone Shadow cut-in silhouette, coat tails blown backward. */
    c.globalAlpha = 1;
    c.fillStyle = '#020208'; c.strokeStyle = '#7e22ce'; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(cx-9,cy-31); c.lineTo(cx-14,cy-42); c.lineTo(cx-5,cy-37); c.lineTo(cx+1,cy-45); c.lineTo(cx+7,cy-37); c.lineTo(cx+13,cy-41); c.lineTo(cx+10,cy-29); c.lineTo(cx+7,cy-18); c.lineTo(cx+13,ground-12); c.lineTo(cx+4,ground-18); c.lineTo(cx,ground-9); c.lineTo(cx-4,ground-18); c.lineTo(cx-14,ground-11); c.lineTo(cx-7,cy-18); c.closePath(); c.fill(); c.stroke();
    c.strokeStyle = '#a855f7'; c.lineWidth = 2; c.beginPath(); c.moveTo(cx-3,cy-9); c.lineTo(cx+5,cy-3); c.lineTo(cx-1,cy+6); c.stroke();
    c.fillStyle = '#67e8f9'; c.shadowColor = '#67e8f9'; c.shadowBlur = 10;
    c.fillRect(cx-5,cy-27,4,1.7); c.fillRect(cx+2,cy-27,4,1.7); c.shadowBlur = 0;

    /* City skyline becomes a shattered silhouette as the shockwave reaches it. */
    drawRuinedSkyline(c, p, true);
    c.globalCompositeOperation = 'lighter';
    if (p > .25) {
      var radius = 8 + impact * Math.min(w*.46,h*.78);
      for (var k = 0; k < 3; k++) {
        c.globalAlpha = Math.max(0, (.85 - k * .22) * (1 - aftermath * .35));
        c.strokeStyle = k === 1 ? '#ffffff' : (k === 2 ? '#7c3aed' : '#e9d5ff');
        c.lineWidth = k === 0 ? 4 : 1.7;
        c.beginPath(); c.ellipse(cx, ground, radius * (1 - k * .12), 12 + k * 9, 0, 0, Math.PI * 2); c.stroke();
      }
      var cutY = ground - 59;
      var blastR = 20 + impact * Math.max(0, Math.hypot(w/2,Math.max(cutY,h-cutY))-20);
      var blast = c.createRadialGradient(cx,cy,2,cx,cy,blastR);
      blast.addColorStop(0, 'rgba(255,255,255,' + (0.9 * (1-aftermath*.92)) + ')');
      blast.addColorStop(.12, 'rgba(233,213,255,' + (.8 * (1-aftermath*.9)) + ')');
      blast.addColorStop(.34, 'rgba(168,85,247,' + (.65 * (1-aftermath*.5)) + ')');
      blast.addColorStop(.68, 'rgba(91,33,182,' + (.3 * (1-aftermath)) + ')');
      blast.addColorStop(1, 'rgba(30,10,60,0)');
      c.fillStyle = blast; c.fillRect(0,0,w,h);
      /* Rising mushroom cloud and branching shock rays. */
      c.globalAlpha = Math.max(0, .7 * (1-aftermath*.72));
      c.fillStyle = '#c084fc';
      c.beginPath(); c.moveTo(cx-8,ground-8); c.quadraticCurveTo(cx-17,cy+5,cx-17,cy-6); c.quadraticCurveTo(cx-39,cy-14,cx-24,cy-29); c.quadraticCurveTo(cx-28,cy-50,cx-9,cy-40); c.quadraticCurveTo(cx,cy-61,cx+12,cy-39); c.quadraticCurveTo(cx+31,cy-50,cx+30,cy-28); c.quadraticCurveTo(cx+18,cy-12,cx+10,cy-7); c.lineTo(cx+8,ground-8); c.closePath(); c.fill();
      c.globalAlpha = Math.max(0, .82 * (1-aftermath));
      for (var ray = 0; ray < 24; ray++) {
        var a = ray * Math.PI * 2 / 24 + t * .05;
        var len = 35 + impact * 210 * (ray % 3 === 0 ? 1 : .55);
        c.strokeStyle = ray % 3 === 0 ? '#ffffff' : (ray % 2 ? '#a855f7' : '#e9d5ff');
        c.lineWidth = ray % 4 === 0 ? 2.5 : .9;
        c.beginPath(); c.moveTo(cx + Math.cos(a)*11, cy + Math.sin(a)*7); c.lineTo(cx+Math.cos(a)*len, cy+Math.sin(a)*len*.58); c.stroke();
      }
    }
    /* Floating masonry fragments tumble away from the blast. */
    c.globalCompositeOperation = 'source-over';
    for (var d = 0; d < 32; d++) {
      var f = (p * (1.1 + (d % 7) * .19) + d * .127) % 1;
      var angle = d * 2.399;
      var dist = 12 + f * w * .62;
      var dx = cx + Math.cos(angle) * dist;
      var dy = cy + Math.sin(angle) * dist * .58 + f * f * 36;
      c.save(); c.translate(dx,dy); c.rotate(t * (d % 2 ? 2 : -2) + d);
      c.globalAlpha = .75 * (1 - f * .48);
      c.fillStyle = d % 3 ? '#211336' : '#c084fc';
      c.fillRect(-2 - d%3, -1.3, 4 + d%3, 2.6); c.restore();
    }
    if (p > .36 && p < .52) { c.globalAlpha = Math.max(0, (1 - Math.abs(p-.43)/.09) * .65); c.fillStyle='#f5d0fe'; c.fillRect(0,0,w,h); }
    c.globalAlpha = 1; c.textAlign = 'center'; c.shadowColor = '#a855f7'; c.shadowBlur = 13;
    c.fillStyle = '#f5d0fe'; c.font = '900 17px monospace'; c.fillText('I AM ATOMIC', cx, 28);
    c.shadowBlur = 0; c.fillStyle = '#c4b5fd'; c.font = 'bold 7px monospace'; c.fillText('SHADOW • SSS+ ĐẶC BIỆT • DOMINION OF THE ECLIPSE', cx, 39);
    c.restore();
  }

  function install() {
    if (!dependenciesReady()) { window.setTimeout(install, 50); return; }
    configureCharacter();
    if (typeof window.renderCharacterRoster === 'function' && !window.__cpShadowRosterWrapped) {
      window.__cpShadowRosterWrapped = true;
      var oldRoster = window.renderCharacterRoster;
      window.renderCharacterRoster = function () {
        oldRoster.apply(this, arguments);
        try {
          var idx = CHARACTER_DATABASE.findIndex(function (x) { return x.id === 'char_shadow'; });
          var grid = document.getElementById('characterRosterGrid');
          var card = grid && grid.children[idx];
          if (card) {
            card.classList.add('rank-SSS-SPEC', 'shadow-special-card');
            var badge = Array.from(card.querySelectorAll('span')).find(function (el) { return /SSS/.test(el.textContent); });
            if (badge) { badge.textContent = 'SSS+ ĐẶC BIỆT'; badge.classList.add('shadow-rank-stamp'); }
            var button = card.querySelector('button');
            if (button && !CHARACTER_DATABASE[idx].unlocked) button.textContent = '🔒 CHỈ MỞ KHÓA BẰNG CODE';
          }
        } catch (_) {}
      };
    }

    if (typeof window.updateCharShowcaseBanner === 'function' && !window.__cpShadowBannerWrapped) {
      window.__cpShadowBannerWrapped = true;
      var oldBanner = window.updateCharShowcaseBanner;
      window.updateCharShowcaseBanner = function () {
        oldBanner.apply(this, arguments);
        try {
          var ch = CHARACTER_DATABASE.find(function (x) { return x.id === playerData.selectedCharacter; });
          if (ch && ch.id === 'char_shadow') {
            var title = document.getElementById('charShowcaseTitle');
            var badge = document.getElementById('charPreviewRankBadge');
            if (title) { title.textContent = 'SSS+ ĐẶC BIỆT • SHADOW EMPEROR'; title.classList.add('shadow-special-title'); }
            if (badge) { badge.textContent = 'SSS+ ĐẶC BIỆT'; badge.className = 'absolute top-1 left-1 text-[7px] font-black px-1 rounded text-white bg-violet-700 animate-pulse'; }
          }
        } catch (_) {}
      };
    }

    if (typeof window.getCharacterVisualTheme === 'function' && !window.__cpShadowThemeWrapped) {
      window.__cpShadowThemeWrapped = true;
      var oldTheme = window.getCharacterVisualTheme;
      window.getCharacterVisualTheme = function (id) {
        if (id === 'char_shadow') return { main:'#a855f7', sub:'#67e8f9', dark:'#080610', name:'SHADOW EMPEROR', icon:'影', vfxType:'shadow_atomic' };
        return oldTheme.apply(this, arguments);
      };
    }

    if (typeof window.drawPixelKurumi === 'function' && !window.__cpShadowModelWrapped) {
      window.__cpShadowModelWrapped = true;
      var oldDraw = window.drawPixelKurumi;
      window.drawPixelKurumi = function (c, p, id, weapon) {
        var selected = id || (typeof playerData !== 'undefined' ? playerData.selectedCharacter : '');
        if (selected === 'char_shadow') paintShadowBack(c, p);
        oldDraw.apply(this, arguments);
        if (selected === 'char_shadow') paintShadowFront(c, p);
      };
    }

    if (typeof window.drawParallaxBackground === 'function' && !window.__cpShadowBgWrapped) {
      window.__cpShadowBgWrapped = true;
      var oldBg = window.drawParallaxBackground;
      window.drawParallaxBackground = function (c) { oldBg.apply(this, arguments); drawAtomicDomain(c); };
    }

    if (typeof window.drawBurstCutscene === 'function' && !window.__cpShadowCutsceneWrapped) {
      window.__cpShadowCutsceneWrapped = true;
      var oldCutscene = window.drawBurstCutscene;
      window.drawBurstCutscene = function (c) {
        if (typeof burstCutscene !== 'undefined' && burstCutscene.active && burstCutscene.charId === 'char_shadow') {
          drawAtomicCutscene(c);
          return;
        }
        return oldCutscene.apply(this, arguments);
      };
    }

    if (typeof window.applyPlayerStatsToCombat === 'function' && !window.__cpShadowStatsWrapped) {
      window.__cpShadowStatsWrapped = true;
      var oldStats = window.applyPlayerStatsToCombat;
      window.applyPlayerStatsToCombat = function () {
        var result = oldStats.apply(this, arguments);
        if (DOMAIN.buffActive && performance.now() < DOMAIN.buffExpiresAt && typeof player !== 'undefined') {
          player.atk = Math.round(player.atk * 1.5);
        }
        return result;
      };
      DOMAIN.restoreStats = function () {
        DOMAIN.buffActive = false;
        DOMAIN.active = false;
        if (DOMAIN.hadSpeed && typeof player !== 'undefined') player.attackSpeed = DOMAIN.baseSpeed;
        else if (typeof player !== 'undefined') delete player.attackSpeed;
        try { oldStats.call(window); } catch (_) {}
      };
    }

    if (typeof window.triggerSkillQ === 'function' && !window.__cpShadowQWrapped) {
      window.__cpShadowQWrapped = true;
      var oldQ = window.triggerSkillQ;
      window.triggerSkillQ = function () {
        var ch = CHARACTER_DATABASE.find(function (x) { return x.id === playerData.selectedCharacter; });
        if (!ch || ch.id !== 'char_shadow') return oldQ.apply(this, arguments);
        if (gameState !== 'PLAYING' || cdTimer.skillQ > 0) return;
        cdTimer.skillQ = COOLDOWNS.skillQ * (1 - ((player.cdr || 0) / 100));
        DOMAIN.startAt = performance.now();
        DOMAIN.active = false;
        DOMAIN.expiresAt = 0;
        DOMAIN.buffActive = false;
        DOMAIN.baseAtk = player.atk;
        DOMAIN.hadSpeed = typeof player.attackSpeed === 'number' && isFinite(player.attackSpeed);
        DOMAIN.baseSpeed = DOMAIN.hadSpeed ? player.attackSpeed : 1;
        burstCutscene = { active:true, timer:2.75, maxTimer:2.75, title:'I AM ATOMIC', sub:'SHADOW • SSS+ ĐẶC BIỆT • ATOMIC DOMINION', color:'#a855f7', charId:'char_shadow' };
        window.__cpShadowQCameraLockUntil = performance.now() + 2950;
        player.isInvincible = true; player.invincibleTimer = 2.75;
        screenShake = 0; screenFlash = .14;
        try { if (typeof sfxUltimateBoom === 'function') sfxUltimateBoom(); } catch (_) {}
        try { if (typeof sfxBossSkill === 'function') sfxBossSkill(30); } catch (_) {}
        var qRingRadius=Math.max(8,Math.min(V_WIDTH*.40,(V_HEIGHT-GROUND_Y-4)/.32));
        spawnMagicCircle(V_WIDTH / 2, GROUND_Y, qRingRadius, '#a855f7', 2.1, true);
        spawnMagicCircle(V_WIDTH / 2, GROUND_Y, qRingRadius*.68, '#f5d0fe', 1.7, true);
        spawnLightPillar(V_WIDTH / 2, GROUND_Y, Math.min(V_HEIGHT*.74,200), '#7e22ce', 1.7);
        for (var r = 0; r < 24; r++) {
          var a = Math.PI * 2 * r / 24;
          spawnDimensionCrack(V_WIDTH/2 + Math.cos(a)*80, GROUND_Y + Math.sin(a)*18, V_WIDTH/2 + Math.cos(a)*220, GROUND_Y + Math.sin(a)*28, r%2?'#c084fc':'#f5d0fe', 3.2, 1.05);
        }
        var nukeDamage = Math.max(1, Math.round(player.atk * 35));
        enemies.forEach(function (e) {
          if (!e.alive) return;
          e.stunTimer = Math.max(e.stunTimer || 0, 2.2);
          damageEnemy(e, nukeDamage, '#a855f7', '☢ I AM ATOMIC', true);
          var fxX = Math.max(36, Math.min(V_WIDTH-36, Number(e.x) || V_WIDTH/2));
          var fxR = Math.max(12, Math.min(V_WIDTH*.18, fxX-4, V_WIDTH-fxX-4));
          spawnLightPillar(fxX, GROUND_Y, Math.min(V_HEIGHT*.38, 96), '#c084fc', 1.0);
          spawnMagicCircle(fxX, GROUND_Y, fxR, '#7e22ce', .9, true);
        });
        if (boss && boss.alive) {
          boss.stunTimer = Math.max(boss.stunTimer || 0, 2.5);
          damageBoss(nukeDamage * 2, '☢ I AM ATOMIC', true, '#c084fc');
          var bossFxX = Math.max(36, Math.min(V_WIDTH-36, Number(boss.x) || V_WIDTH/2));
          var bossFxR = Math.max(12, Math.min(V_WIDTH*.20, bossFxX-4, V_WIDTH-bossFxX-4));
          spawnLightPillar(bossFxX, GROUND_Y, Math.min(V_HEIGHT*.48, 130), '#a855f7', 1.2);
          spawnMagicCircle(bossFxX, GROUND_Y, bossFxR, '#7e22ce', 1.0, true);
        }
        spawnParticles(V_WIDTH/2, GROUND_Y-65, 64, '#a855f7', 1.0);
        spawnParticles(V_WIDTH/2, GROUND_Y-65, 32, '#f5d0fe', .62);
        showToast('☢ I AM ATOMIC — VỤ NỔ NGUYÊN TỬ!', '影');
        if (DOMAIN.timerId) clearTimeout(DOMAIN.timerId);
        DOMAIN.timerId = setTimeout(function () {
          DOMAIN.active = true;
          DOMAIN.expiresAt = performance.now() + 10000;
          DOMAIN.buffActive = true;
          DOMAIN.buffExpiresAt = DOMAIN.expiresAt;
          if (typeof applyPlayerStatsToCombat === 'function') applyPlayerStatsToCombat();
          player.attackSpeed = (DOMAIN.hadSpeed ? DOMAIN.baseSpeed : 1) * 1.1;
          screenShake = 0;
          showToast('LÃNH ĐỊA ATOMIC • ATK +50% • TỐC ĐÁNH +10% • 10 GIÂY', '☄️');
          setTimeout(function () { if (performance.now() >= DOMAIN.buffExpiresAt) { DOMAIN.restoreStats ? DOMAIN.restoreStats() : (DOMAIN.buffActive = false); showToast('Lãnh địa Shadow đã tan biến.', '🌌'); } }, 10030);
        }, 2750);
        return;
      };
    }

    /* The starter remains the D-rank trainee; code-locked characters can never be bought. */
    try {
      if (playerData.selectedCharacter !== 'char_yuno' && playerData.selectedCharacter !== 'char_shadow') playerData.selectedCharacter = 'char_d';
      if (window.updateHubUI) window.updateHubUI();
      if (window.renderCharacterRoster) window.renderCharacterRoster();
    } catch (_) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();