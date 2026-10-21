/* Chrono Phantom — Character Identity FX + Weapon Banner */
(function () {
  'use strict';
  if (window.__cpCharacterIdentityPass) return;
  window.__cpCharacterIdentityPass = true;

  const PALETTES = {
    char_yuno:     { main:'#ff174f', sub:'#ffd1dc', accent:'#991b1b', motif:'blood', name:'Huyết Nguyệt' },
    char_sss_ult:  { main:'#c084fc', sub:'#f9a8d4', accent:'#7e22ce', motif:'wings', name:'Dạ Nguyệt' },
    char_sss:      { main:'#fb7185', sub:'#fde047', accent:'#9f1239', motif:'thorns', name:'Huyết Tộc' },
    char_ssr:      { main:'#e2e8f0', sub:'#93c5fd', accent:'#64748b', motif:'moon', name:'Bạch Nguyệt' },
    char_ss:       { main:'#f43f5e', sub:'#fbbf24', accent:'#7f1d1d', motif:'clock', name:'Thời Kiếm' },
    char_s:        { main:'#facc15', sub:'#f0f9ff', accent:'#38bdf8', motif:'halo', name:'Thánh Quang' },
    char_a:        { main:'#a855f7', sub:'#f0abfc', accent:'#581c87', motif:'sigil', name:'Hắc Ám' },
    char_b:        { main:'#22d3ee', sub:'#f9a8d4', accent:'#0e7490', motif:'spark', name:'Tinh Nghịch' },
    char_c:        { main:'#f9a8d4', sub:'#fef3c7', accent:'#be185d', motif:'petal', name:'Kiếm Đạo' },
    char_d:        { main:'#86efac', sub:'#e2e8f0', accent:'#15803d', motif:'training', name:'Tập Sự' },
    char_shadow:   { main:'#a78bfa', sub:'#f5f3ff', accent:'#4c1d95', motif:'eclipse', name:'Atomic Shadow' }
  };

  const WEAPON_SPOTLIGHTS = [
    { id:'w_yuno_sss', name:'ĐOẢN ĐAO HUYẾT NGUYỆT YUNO', icon:'🔪', rank:'SSS', atk:680, color:'#fb335c', sub:'#ffc2d1', text:'Lưỡi đao khắc lời nguyền Hồng Nguyệt. Hút sinh lực và khuếch đại sát thương cuồng nộ.', shape:'dagger' },
    { id:'w_sss_1', name:'THÁNH KIẾM ZAPHKIEL VÔ HẠN', icon:'🔱', rank:'SSS', atk:560, color:'#fbbf24', sub:'#fff7cc', text:'Thần kiếm thao túng dòng thời gian, đóng băng khoảnh khắc trước nhát chém.', shape:'holy' },
    { id:'w_sss_2', name:'ĐAO HƯ KHÔNG THÍ THẦN', icon:'⚔️', rank:'SSS', atk:540, color:'#a78bfa', sub:'#ede9fe', text:'Đại đao tôi luyện từ tâm sao, xé mặt trận bằng một đường nứt hư không.', shape:'void' },
    { id:'w_sss_3', name:'LIỀM TỬ THẦN CHRONOS VÔ CỰC', icon:'☠️', rank:'SSS', atk:580, color:'#67e8f9', sub:'#cffafe', text:'Lưỡi liềm đoạt hồn xuyên thời không, để lại vệt sáng lạnh như sương linh giới.', shape:'scythe' },
    { id:'w_sss_4', name:'SÚNG MA NĂNG HUYẾT NGUYỆT', icon:'🔫', rank:'SSS', atk:520, color:'#fb923c', sub:'#ffedd5', text:'Hỏa pháo ngưng tụ năng lượng tinh vân đỏ thẫm, bắn xuyên tuyến mục tiêu.', shape:'cannon' },
    { id:'w_sss_5', name:'THÁI ĐAO ẢNH NGUYỆT VÔ SONG', icon:'🗡️', rank:'SSS', atk:550, color:'#e879f9', sub:'#fae8ff', text:'Thái đao chém rách kết giới, tạo ba bóng kiếm xuất hiện gần như đồng thời.', shape:'katana' },
    { id:'w_shadow_atomic', name:'THẦN KHÍ HẮC NGUYỆT — ATOMIC DOMINION', icon:'☢️', rank:'SSS', atk:820, color:'#c084fc', sub:'#f5f3ff', text:'Thần khí của Shadow. Kích hoạt Atomic để giáng xuống chuỗi vụ nổ hư vô.', shape:'atomic' }
  ];

  function currentCharId() {
    try {
      return (typeof playerData !== 'undefined' && playerData.selectedCharacter) || 'char_d';
    } catch (_) { return 'char_d'; }
  }
  function playing() {
    try { return typeof gameState !== 'undefined' && gameState === 'PLAYING'; }
    catch (_) { return false; }
  }
  function getWorldPoint() {
    let x = 0, y = 0;
    try {
      if (typeof player !== 'undefined' && player) { x = Number(player.x) || 0; y = (Number(player.y) || 0) - 24; }
    } catch (_) {}
    return { x, y };
  }

  let baseCanvas, fxCanvas, fxCtx, gameHost, fxItems = [], lastResize = '';
  function ensureLayer() {
    baseCanvas = document.getElementById('gameCanvas');
    gameHost = document.getElementById('gameWrapper');
    if (!baseCanvas || !gameHost) return false;
    if (!fxCanvas) {
      fxCanvas = document.createElement('canvas');
      fxCanvas.id = 'cpCharacterFxCanvas';
      fxCanvas.setAttribute('aria-hidden', 'true');
      Object.assign(fxCanvas.style, { position:'absolute', pointerEvents:'none', zIndex:'6', overflow:'hidden' });
      const hud = document.getElementById('inGameHud');
      if (hud && hud.parentNode === gameHost) gameHost.insertBefore(fxCanvas, hud);
      else gameHost.appendChild(fxCanvas);
      fxCtx = fxCanvas.getContext('2d');
    }
    resizeLayer();
    return true;
  }
  function resizeLayer() {
    if (!baseCanvas || !fxCanvas || !gameHost) return;
    const b = baseCanvas.getBoundingClientRect();
    const h = gameHost.getBoundingClientRect();
    const left = b.left - h.left, top = b.top - h.top;
    const sig = [left, top, b.width, b.height, baseCanvas.width, baseCanvas.height].join(':');
    if (sig === lastResize) return;
    lastResize = sig;
    Object.assign(fxCanvas.style, { left:left+'px', top:top+'px', width:b.width+'px', height:b.height+'px' });
    fxCanvas.width = baseCanvas.width || Math.max(1, Math.round(b.width));
    fxCanvas.height = baseCanvas.height || Math.max(1, Math.round(b.height));
  }
  window.addEventListener('resize', resizeLayer, { passive:true });

  function addFX(action) {
    if (!playing() || !ensureLayer()) return;
    const id = currentCharId(), palette = PALETTES[id] || PALETTES.char_d, point = getWorldPoint();
    const facing = (() => { try { return player && player.facing < 0 ? -1 : 1; } catch (_) { return 1; } })();
    const now = performance.now();
    const duration = action === 'Q' ? (id === 'char_shadow' ? 2.05 : 1.65) : action === 'R' ? .92 : action === 'E' ? .68 : .38;
    fxItems.push({
      id, action, palette, start:now, duration, x:point.x + (action === 'attack' ? facing*22 : facing*31),
      y:point.y, facing, seed:Math.random()*1000, count:action==='Q'?32:action==='R'?19:action==='E'?13:7
    });
    if (fxItems.length > 30) fxItems.splice(0, fxItems.length - 30);
    try {
      const host = document.getElementById('gameWrapper');
      if (host) {
        host.classList.remove('cp-fx-hit-flash');
        void host.offsetWidth;
        host.classList.add('cp-fx-hit-flash');
      }
    } catch (_) {}
  }

  function wrapAction(name, action, cooldownKey) {
    const original = window[name];
    if (typeof original !== 'function' || original.__cpCharacterFxWrapped) return;
    const wrapped = function () {
      const allowed = playing() && (!cooldownKey || (typeof cdTimer === 'undefined' || !(Number(cdTimer[cooldownKey]) > 0)));
      const result = original.apply(this, arguments);
      if (allowed && playing()) addFX(action);
      return result;
    };
    wrapped.__cpCharacterFxWrapped = true;
    window[name] = wrapped;
  }
  wrapAction('playerAttack', 'attack', null);
  wrapAction('triggerSkillE', 'E', 'skillE');
  wrapAction('triggerSkillR', 'R', 'skillR');
  wrapAction('triggerSkillQ', 'Q', 'skillQ');

  function path(ctx, points, close) {
    if (!points.length) return;
    ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]);
    for (let i=1;i<points.length;i++) ctx.lineTo(points[i][0],points[i][1]);
    if (close) ctx.closePath();
  }
  function line(ctx, x1,y1,x2,y2,color,width,alpha) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle=color; ctx.lineWidth=width; ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.restore();
  }
  function circle(ctx,x,y,r,color,width,alpha,start,end) {
    ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle=color;ctx.lineWidth=width;
    ctx.beginPath();ctx.arc(x,y,Math.max(1,r),start===undefined?0:start,end===undefined?Math.PI*2:end);ctx.stroke();ctx.restore();
  }
  function glow(ctx,x,y,r,color,alpha) {
    ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=Math.max(4,r*.55);
    ctx.beginPath();ctx.arc(x,y,Math.max(1,r),0,Math.PI*2);ctx.fill();ctx.restore();
  }
  function star(ctx,x,y,r,color,rot,alpha) {
    ctx.save();ctx.translate(x,y);ctx.rotate(rot||0);ctx.globalAlpha=alpha;ctx.strokeStyle=color;ctx.lineWidth=Math.max(1,r*.13);ctx.beginPath();
    ctx.moveTo(-r,0);ctx.lineTo(r,0);ctx.moveTo(0,-r);ctx.lineTo(0,r);
    ctx.moveTo(-r*.58,-r*.58);ctx.lineTo(r*.58,r*.58);ctx.moveTo(-r*.58,r*.58);ctx.lineTo(r*.58,-r*.58);ctx.stroke();ctx.restore();
  }
  function triangle(ctx,x,y,r,color,rot,alpha) {
    ctx.save();ctx.translate(x,y);ctx.rotate(rot||0);ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(0,-r);ctx.lineTo(r*.56,r);ctx.lineTo(-r*.56,r);ctx.closePath();ctx.fill();ctx.restore();
  }
  function drawMotif(ctx,e,x,y,r,t,alpha) {
    const p=e.palette, spin=(t*2+e.seed*.01), q=e.action==='Q';
    ctx.save();ctx.globalAlpha=alpha;
    // A shared kinetic ring makes each skill readable; the inner motif is unique per character.
    circle(ctx,x,y,r,p.main,q?3.2:2.1,alpha*.76,spin,spin+Math.PI*(q?1.72:1.1));
    circle(ctx,x,y,r*.72,p.sub,1.1,alpha*.5,-spin*.7,-spin*.7+Math.PI*1.45);
    if (p.motif==='blood') {
      circle(ctx,x,y,r*.52,p.main,2.2,alpha*.82,Math.PI*.08+spin,Math.PI*1.58+spin);
      circle(ctx,x-r*.13,y-r*.1,r*.28,p.sub,1.5,alpha*.8,Math.PI*1.05,Math.PI*2.05);
      for(let i=0;i<3;i++){const a=spin+i*2.09;line(ctx,x+Math.cos(a)*r*.45,y+Math.sin(a)*r*.45,x+Math.cos(a+.75)*r*1.15,y+Math.sin(a+.75)*r*1.15,i===1?p.sub:p.main,q?4:2,alpha*(1-t*.3));}
      if(q){glow(ctx,x,y,r*.24,p.main,alpha*.38);circle(ctx,x,y,r*.93,'#ffeff4',1.2,alpha*.85,0,Math.PI*1.9);}
    } else if (p.motif==='wings') {
      for(let side of [-1,1]){
        ctx.save();ctx.translate(x,y);ctx.scale(side,1);ctx.globalAlpha=alpha*.85;
        ctx.strokeStyle=p.main;ctx.lineWidth=q?2.5:1.8;ctx.beginPath();ctx.moveTo(0,0);
        ctx.bezierCurveTo(r*.2,-r*.9,r*.95,-r*1.08,r*1.1,-r*.26);
        ctx.bezierCurveTo(r*.75,-r*.45,r*.96,r*.18,r*.55,r*.35);
        ctx.bezierCurveTo(r*.5,-r*.05,r*.25,r*.45,0,0);ctx.stroke();
        for(let k=0;k<3;k++){line(ctx,r*.18+k*r*.18,-r*.12,r*.55+k*r*.12,-r*.5,p.sub,1.5,alpha*.7);}
        ctx.restore();
      }
      for(let i=0;i<5;i++){const a=spin+i*1.25;triangle(ctx,x+Math.cos(a)*r*.95,y+Math.sin(a)*r*.55,r*.12,p.sub,a,alpha*.78);}
    } else if (p.motif==='thorns') {
      for(let i=0;i<10;i++){const a=spin+i*Math.PI/5, rr=r*(i%2?.74:1.12);line(ctx,x+Math.cos(a)*r*.22,y+Math.sin(a)*r*.22,x+Math.cos(a)*rr,y+Math.sin(a)*rr,i%2?p.sub:p.main,q?3.2:2,alpha*.9);glow(ctx,x+Math.cos(a)*rr,y+Math.sin(a)*rr,r*.035,p.sub,alpha*.6);}
      circle(ctx,x,y,r*.36,p.sub,1.5,alpha*.8);
    } else if (p.motif==='moon') {
      circle(ctx,x,y,r*.62,p.sub,q?2.8:1.7,alpha*.85,.25+spin,.25+spin+Math.PI*1.55);
      ctx.save();ctx.globalAlpha=alpha*.8;ctx.strokeStyle=p.main;ctx.lineWidth=2;ctx.beginPath();ctx.arc(x-r*.1,y-r*.08,r*.42,Math.PI*.25,Math.PI*1.6);ctx.stroke();ctx.restore();
      for(let i=0;i<4;i++){const a=spin+i*Math.PI/2;star(ctx,x+Math.cos(a)*r*.95,y+Math.sin(a)*r*.72,r*.11,p.sub,a,alpha*.8);}
    } else if (p.motif==='clock') {
      circle(ctx,x,y,r*.84,p.sub,1.5,alpha*.72);
      for(let i=0;i<12;i++){const a=i*Math.PI/6+spin*.2;line(ctx,x+Math.cos(a)*r*.72,y+Math.sin(a)*r*.72,x+Math.cos(a)*r*.84,y+Math.sin(a)*r*.84,p.sub,i%3===0?2:1,alpha*.8);}
      line(ctx,x,y,x+Math.cos(-spin*1.8)*r*.44,y+Math.sin(-spin*1.8)*r*.44,p.main,q?3:2,alpha);
      line(ctx,x,y,x+Math.cos(spin*2.7)*r*.64,y+Math.sin(spin*2.7)*r*.64,p.sub,q?2.4:1.5,alpha);
      glow(ctx,x,y,r*.055,p.main,alpha);
      if(q){for(let i=0;i<6;i++){const a=i*Math.PI/3+spin;circle(ctx,x+Math.cos(a)*r*.98,y+Math.sin(a)*r*.98,r*.08,p.main,1.5,alpha);}}
    } else if (p.motif==='halo') {
      circle(ctx,x,y,r*.62,p.sub,q?4:2,alpha*.9,spin,spin+Math.PI*1.85);
      circle(ctx,x,y,r*.82,p.main,1.5,alpha*.7,-spin,-spin+Math.PI*1.25);
      for(let i=0;i<8;i++){const a=i*Math.PI/4+spin;line(ctx,x+Math.cos(a)*r*.32,y+Math.sin(a)*r*.32,x+Math.cos(a)*r*1.05,y+Math.sin(a)*r*1.05,p.sub,q?2.5:1.3,alpha*.82);}
      line(ctx,x,y-r*.35,x,y+r*.6,'#ffffff',q?3:1.5,alpha*.78);
      line(ctx,x-r*.33,y,x+r*.33,y,p.sub,q?3:1.5,alpha*.78);
    } else if (p.motif==='sigil') {
      path(ctx,[[x,y-r*.92],[x+r*.8,y+r*.55],[x-r*.8,y+r*.55]],true);ctx.strokeStyle=p.main;ctx.lineWidth=q?2.8:1.8;ctx.globalAlpha=alpha*.8;ctx.stroke();
      path(ctx,[[x,y+r*.82],[x-r*.72,y-r*.45],[x+r*.72,y-r*.45]],true);ctx.strokeStyle=p.sub;ctx.lineWidth=1.3;ctx.stroke();
      circle(ctx,x,y,r*.28,p.main,1.8,alpha*.9,spin,spin+Math.PI*1.4);
      for(let i=0;i<4;i++){const a=spin+i*Math.PI/2;line(ctx,x+Math.cos(a)*r*.65,y+Math.sin(a)*r*.65,x+Math.cos(a)*r*1.1,y+Math.sin(a)*r*1.1,p.main,2,alpha*.85);}
    } else if (p.motif==='spark') {
      for(let i=0;i<7;i++){const a=spin+i*2.399, rr=r*(.36+(i%3)*.2);const px=x+Math.cos(a)*rr,py=y+Math.sin(a)*rr;star(ctx,px,py,r*(.1+(i%2)*.04),i%2?p.sub:p.main,a,alpha*.9);}
      circle(ctx,x,y,r*.33,p.sub,1.8,alpha*.72,-spin,-spin+Math.PI*1.2);
      ctx.save();ctx.translate(x+r*.15,y-r*.04);ctx.rotate(spin*.35);ctx.strokeStyle=p.main;ctx.lineWidth=2;ctx.globalAlpha=alpha*.85;ctx.beginPath();ctx.moveTo(-r*.22,0);ctx.quadraticCurveTo(-r*.5,-r*.45,-r*.65,-r*.12);ctx.quadraticCurveTo(-r*.82,r*.08,-r*.22,r*.48);ctx.quadraticCurveTo(r*.42,r*.08,r*.22,-r*.12);ctx.quadraticCurveTo(0,-r*.38,-r*.22,0);ctx.stroke();ctx.restore();
    } else if (p.motif==='petal') {
      for(let i=0;i<8;i++){const a=spin+i*Math.PI/4;const px=x+Math.cos(a)*r*.75,py=y+Math.sin(a)*r*.63;ctx.save();ctx.translate(px,py);ctx.rotate(a);ctx.globalAlpha=alpha*.85;ctx.strokeStyle=i%2?p.main:p.sub;ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(0,0,r*.13,r*.29,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
      line(ctx,x-r*.78,y+r*.22,x+r*.98,y-r*.48,p.sub,q?4:2.4,alpha*.95);
      line(ctx,x-r*.53,y+r*.38,x+r*.65,y-r*.32,p.main,1.2,alpha*.85);
    } else if (p.motif==='training') {
      line(ctx,x-r*.8,y+r*.35,x+r*.9,y-r*.35,p.sub,q?3:2,alpha*.9);
      line(ctx,x-r*.7,y+r*.47,x+r*.55,y-.01*r,p.main,1.4,alpha*.8);
      for(let i=0;i<4;i++){const a=spin+i*Math.PI/2;triangle(ctx,x+Math.cos(a)*r*.78,y+Math.sin(a)*r*.55,r*.11,p.sub,a,alpha*.78);}
      circle(ctx,x,y,r*.38,p.main,1.3,alpha*.6,-spin,-spin+Math.PI);
    } else if (p.motif==='eclipse') {
      glow(ctx,x,y,r*.28,p.accent,alpha*.5);
      circle(ctx,x,y,r*.59,p.sub,q?3.1:1.7,alpha*.95,spin,spin+Math.PI*1.9);
      circle(ctx,x+r*.11,y-r*.07,r*.47,p.accent,q?5:3,alpha*.9,spin*.4,spin*.4+Math.PI*1.7);
      for(let i=0;i<12;i++){const a=spin+i*Math.PI/6;const inn=r*(i%2?.73:.48);line(ctx,x+Math.cos(a)*inn,y+Math.sin(a)*inn,x+Math.cos(a)*r*1.15,y+Math.sin(a)*r*1.15,i%2?p.sub:p.main,q?2.8:1.5,alpha*.85);}
      if(q){for(let i=0;i<4;i++){const a=spin+i*Math.PI/2;circle(ctx,x+Math.cos(a)*r*.82,y+Math.sin(a)*r*.82,r*.14,p.sub,1.5,alpha*.9);}}
    }
    ctx.restore();
  }

  function drawEffect(ctx,e,now,w,h) {
    const t = Math.max(0,Math.min(1,(now-e.start)/e.duration));
    const fade = Math.sin(Math.PI*Math.min(1,t*1.08)) * (1-t*.25);
    const p=e.palette, q=e.action==='Q', r0=Math.min(w,h)*(q?.29:e.action==='R'?.13:e.action==='E'?.105:.067);
    let x=e.x, y=e.y;
    if(q){x=w*.5;y=h*.48;}
    else if(e.action==='R'){x+=e.facing*r0*.22;}
    else if(e.action==='E'){x+=e.facing*r0*.16;}
    x=Math.max(8,Math.min(w-8,x));y=Math.max(8,Math.min(h-8,y));
    ctx.save();ctx.globalCompositeOperation='lighter';
    const r=r0*(.63+t*.6);
    glow(ctx,x,y,r*.3,p.accent,fade*.3);
    drawMotif(ctx,e,x,y,r,t,fade);
    // Character-specific travelling attacks: the silhouette changes with identity and action.
    const travel=(e.action==='attack'?r0*.5:e.action==='E'?r0*1.8:e.action==='R'?r0*2.4:r0*3.0);
    const k=1-Math.pow(t,1.45);
    if(e.id==='char_yuno'){
      for(let i=0;i<(q?7:3);i++){const yy=y+(i-(q?3:1))*r*.19;line(ctx,x-e.facing*travel*k,yy-r*.1,x+e.facing*travel*(.45+t*.1),yy+r*.09,i%2?p.sub:p.main,q?3.4:2.2,fade*(1-i*.055));}
    } else if(e.id==='char_sss_ult'){
      for(const side of [-1,1]){ctx.save();ctx.translate(x,y);ctx.scale(side,1);ctx.globalAlpha=fade*.85;ctx.strokeStyle=p.main;ctx.lineWidth=q?3:1.8;ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(r*.24,-r*.85,r*1.1,-r*.7,r*.9,r*.2);ctx.bezierCurveTo(r*.55,-r*.1,r*.45,r*.55,0,0);ctx.stroke();ctx.restore();}
    } else if(e.id==='char_sss'){
      for(let i=0;i<6;i++){const px=x+(i-2.5)*r*.22;line(ctx,px,y+r*.42,px+e.facing*r*.24,y-r*(.7+t*.25),i%2?p.main:p.sub,q?3:1.8,fade*.8);}
    } else if(e.id==='char_ssr'){
      circle(ctx,x+e.facing*travel*k,y-r*.12,r*.24,p.sub,1.8,fade*.8,t*6,t*6+Math.PI*1.4);
      line(ctx,x-e.facing*travel*k,y+r*.3,x+e.facing*travel*.9,y-r*.4,p.sub,q?3:1.5,fade);
    } else if(e.id==='char_ss'){
      for(let i=0;i<4;i++){const a=now*.004+i*Math.PI/2;const px=x+Math.cos(a)*r*(.5+t*.5),py=y+Math.sin(a)*r*(.5+t*.5);glow(ctx,px,py,r*.05,i%2?p.main:p.sub,fade*.9);}
      line(ctx,x-r*.7,y-r*.24,x+r*.72,y+r*.24,p.main,q?3:1.7,fade*.85);
    } else if(e.id==='char_s'){
      line(ctx,x,y-r*1.65,x,y+r*1.3,p.sub,q?5:2,fade*.8);
      line(ctx,x-r*.74,y,x+r*.74,y,p.main,q?3:1.3,fade*.9);
      for(let i=0;i<5;i++)star(ctx,x+(i-2)*r*.3,y-r*(.5+(i%2)*.4),r*.08,p.sub,now*.003+i,fade*.85);
    } else if(e.id==='char_a'){
      for(let i=0;i<4;i++){const a=t*Math.PI*2+i*Math.PI/2;line(ctx,x+Math.cos(a)*r*.3,y+Math.sin(a)*r*.3,x+Math.cos(a)*r*(1.2+t*.3),y+Math.sin(a)*r*(1.2+t*.3),i%2?p.main:p.sub,q?2.8:1.4,fade*.85);}
    } else if(e.id==='char_b'){
      for(let i=0;i<6;i++){const a=now*.003+i*Math.PI/3;const px=x+Math.cos(a)*r*(.35+t*.9),py=y+Math.sin(a)*r*(.35+t*.7);star(ctx,px,py,r*.12,i%2?p.sub:p.main,a,fade*.9);}
    } else if(e.id==='char_c'){
      for(let i=0;i<7;i++){const a=now*.0018+i*2.4;const px=x+Math.cos(a)*r*(.6+t*.7),py=y+Math.sin(a)*r*(.4+t*.45);ctx.save();ctx.translate(px,py);ctx.rotate(a);ctx.globalAlpha=fade*.8;ctx.strokeStyle=i%2?p.main:p.sub;ctx.beginPath();ctx.ellipse(0,0,r*.07,r*.15,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
      line(ctx,x-e.facing*r*.4,y+r*.25,x+e.facing*r*1.1,y-r*.5,p.sub,q?4:2.2,fade);
    } else if(e.id==='char_d'){
      line(ctx,x-e.facing*travel*k,y+r*.4,x+e.facing*travel*.6,y-r*.32,p.sub,q?3:1.5,fade*.9);
      for(let i=0;i<3;i++)triangle(ctx,x+e.facing*(i-1)*r*.38,y-r*.15,r*.07,p.main,now*.002+i,fade*.75);
    } else if(e.id==='char_shadow'){
      for(let i=0;i<8;i++){const a=now*.002+i*Math.PI/4;const px=x+Math.cos(a)*r*(.3+t*.8),py=y+Math.sin(a)*r*(.3+t*.8);line(ctx,x+Math.cos(a)*r*.25,y+Math.sin(a)*r*.25,px,py,i%2?p.main:p.sub,q?3.4:1.8,fade*.85);}
      if(q){circle(ctx,x,y,r*(1+t*.5),'#ffffff',2.2,fade*.8,-t*7,-t*7+Math.PI*1.25);glow(ctx,x,y,r*.17,p.main,fade*.7);}
    }
    // Orbital motes are tinted per character rather than generic white particles.
    for(let i=0;i<e.count;i++){
      const a=e.seed+i*2.399+t*(e.id==='char_ss'?5:2.8);
      const spread=r*(.35+((i*7)%11)/10)*(1+t*.65);
      const px=x+Math.cos(a)*spread, py=y+Math.sin(a)*spread*.72 - t*r*.15;
      const pr=(i%4===0?2.4:1.2)*(1-t*.4);
      glow(ctx,px,py,pr,i%3===0?p.sub:p.main,fade*(.35+((i%3)*.18)));
    }
    // Q gets a brief cinematic flash across the arena, without obscuring controls.
    if(q && t<.68){
      const wave=Math.min(1,t/.68), rr=Math.min(w,h)*(.06+wave*.47);
      circle(ctx,w*.5,h*.48,rr,p.main,q?3.5:1.5,(1-wave)*.8,now*.002,now*.002+Math.PI*1.9);
      line(ctx,w*.5-rr*1.1,h*.48-rr*.1,w*.5+rr*1.1,h*.48+rr*.1,p.sub,2.4,(1-wave)*.62);
    }
    ctx.restore();
  }

  let animationStarted=false;
  function renderFX(now) {
    if (!ensureLayer()) { requestAnimationFrame(renderFX); return; }
    resizeLayer();
    const ctx=fxCtx, w=fxCanvas.width, h=fxCanvas.height;
    ctx.clearRect(0,0,w,h);
    let logicalW=w, logicalH=h;
    try { if (typeof V_WIDTH==='number' && V_WIDTH>0) logicalW=V_WIDTH; if (typeof V_HEIGHT==='number' && V_HEIGHT>0) logicalH=V_HEIGHT; } catch (_) {}
    ctx.setTransform(w/logicalW,0,0,h/logicalH,0,0);
    fxItems=fxItems.filter(e=>now-e.start<e.duration);
    if (playing()) fxItems.forEach(e=>drawEffect(ctx,e,now,logicalW,logicalH));
    requestAnimationFrame(renderFX);
  }

  function weaponSvg(shape,color,sub) {
    const start='<svg viewBox="0 0 150 260" role="img" aria-label="Minh họa vũ khí SSS" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="wbBlade" x1="0" y1="0" x2="1" y2="1"><stop stop-color="'+sub+'"/><stop offset=".45" stop-color="'+color+'"/><stop offset="1" stop-color="#170b25"/></linearGradient><filter id="wbGlow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>';
    let body='';
    if(shape==='dagger') body='<path d="M75 12 L98 92 L82 148 L75 180 L68 148 L52 92Z" fill="url(#wbBlade)" stroke="'+sub+'" stroke-width="2"/><path d="M75 30 L75 156" stroke="#fff" stroke-width="2" opacity=".8"/><path d="M47 126 L103 126 L91 139 L59 139Z" fill="'+color+'" stroke="'+sub+'"/><path d="M70 140 L80 140 L82 211 L68 211Z" fill="#27152d" stroke="'+color+'" stroke-width="2"/><path d="M75 215 L91 238 L75 251 L59 238Z" fill="'+color+'" stroke="'+sub+'"/>';
    else if(shape==='holy') body='<path d="M75 18 L91 67 L84 142 L75 171 L66 142 L59 67Z" fill="url(#wbBlade)" stroke="'+sub+'" stroke-width="2"/><path d="M75 35 L75 143" stroke="#fff" stroke-width="2.5"/><path d="M37 116 L113 116 L99 133 L51 133Z" fill="'+color+'" stroke="'+sub+'" stroke-width="2"/><path d="M71 137 L79 137 L83 213 L67 213Z" fill="#261b31" stroke="'+color+'" stroke-width="2"/><path d="M75 16 L65 49 L75 40 L85 49Z" fill="'+sub+'"/><circle cx="75" cy="121" r="9" fill="'+sub+'" stroke="'+color+'" stroke-width="3"/>';
    else if(shape==='void') body='<path d="M75 8 L112 81 L91 140 L75 168 L59 140 L38 81Z" fill="url(#wbBlade)" stroke="'+sub+'" stroke-width="2.5"/><path d="M75 28 L75 150 M53 82 L97 82" stroke="#fff" stroke-width="2" opacity=".75"/><path d="M30 121 L120 121 L99 143 L51 143Z" fill="'+color+'" stroke="'+sub+'" stroke-width="2"/><path d="M69 144 L81 144 L85 216 L65 216Z" fill="#20142d" stroke="'+color+'" stroke-width="2"/><circle cx="75" cy="93" r="10" fill="#100719" stroke="'+color+'" stroke-width="3"/>';
    else if(shape==='scythe') body='<path d="M80 30 L90 226 L77 244 L65 224 L74 30Z" fill="#241833" stroke="'+sub+'" stroke-width="2"/><path d="M74 22 C36 12 19 42 26 72 C32 95 57 104 75 81 C50 84 45 59 57 45 C62 37 70 31 74 22Z" fill="url(#wbBlade)" stroke="'+sub+'" stroke-width="2.5"/><path d="M71 38 C51 47 46 65 57 76" fill="none" stroke="#fff" stroke-width="2"/><circle cx="78" cy="124" r="7" fill="'+color+'" stroke="'+sub+'" stroke-width="2"/>';
    else if(shape==='cannon') body='<rect x="51" y="38" width="48" height="103" rx="12" fill="url(#wbBlade)" stroke="'+sub+'" stroke-width="2.5"/><path d="M57 43 L93 43 L89 88 L61 88Z" fill="'+color+'" opacity=".7"/><circle cx="75" cy="56" r="10" fill="#190b1d" stroke="'+sub+'" stroke-width="2"/><path d="M54 94 L96 94 L106 114 L44 114Z" fill="'+color+'" stroke="'+sub+'" stroke-width="2"/><path d="M61 130 L89 130 L94 173 L56 173Z" fill="#27152d" stroke="'+color+'" stroke-width="2"/><path d="M61 174 L89 174 L84 220 L66 220Z" fill="#20152b" stroke="'+sub+'" stroke-width="2"/><circle cx="75" cy="110" r="17" fill="none" stroke="'+sub+'" stroke-width="3" filter="url(#wbGlow)"/>';
    else if(shape==='katana') body='<path d="M83 12 Q98 60 84 140 L74 173 L65 145 Q72 65 56 29Z" fill="url(#wbBlade)" stroke="'+sub+'" stroke-width="2.2"/><path d="M69 28 Q83 75 75 140" fill="none" stroke="#fff" stroke-width="2"/><path d="M43 135 L107 135 L94 147 L56 147Z" fill="'+color+'" stroke="'+sub+'" stroke-width="2"/><path d="M71 146 L80 146 L85 217 L67 217Z" fill="#21142d" stroke="'+color+'" stroke-width="2"/><path d="M75 222 L85 234 L75 246 L65 234Z" fill="'+sub+'"/>';
    else body='<path d="M75 14 L99 76 L87 142 L75 165 L63 142 L51 76Z" fill="url(#wbBlade)" stroke="'+sub+'" stroke-width="2.5"/><path d="M75 33 L75 151" stroke="#fff" stroke-width="2"/><path d="M36 119 L114 119 L98 136 L52 136Z" fill="'+color+'" stroke="'+sub+'" stroke-width="2"/><path d="M69 140 L81 140 L86 217 L64 217Z" fill="#21142d" stroke="'+color+'" stroke-width="2"/><circle cx="75" cy="86" r="25" fill="none" stroke="'+color+'" stroke-width="3" filter="url(#wbGlow)"/>';
    return start+body+'</svg>';
  }

  function installWeaponBanner() {
    const tab=document.getElementById('tabContentGacha');
    if(!tab || document.getElementById('cpWeaponBanner')) return;
    const section=document.createElement('section');
    section.id='cpWeaponBanner';
    section.className='cp-weapon-banner';
    section.innerHTML=
      '<div class="cpwb-top"><span class="cpwb-kicker">CHRONO ARMORY / LIMITED WEAPON SHOWCASE</span><span class="cpwb-live"><i></i> BANNER LIVE</span></div>'+
      '<div class="cpwb-main">'+
        '<div class="cpwb-art-stage"><div class="cpwb-rune cpwb-rune-a"></div><div class="cpwb-rune cpwb-rune-b"></div><div class="cpwb-starfield"></div><div class="cpwb-weapon-art" id="cpwbWeaponArt"></div><div class="cpwb-rank-seal">SSS</div><div class="cpwb-art-caption" id="cpwbArtCaption">RELIC 01 / 07</div></div>'+
        '<div class="cpwb-copy"><span class="cpwb-eyebrow">VŨ KHÍ NỔI BẬT • THẦN KHÍ</span><h2 id="cpwbWeaponName">ĐOẢN ĐAO HUYẾT NGUYỆT YUNO</h2><p id="cpwbWeaponDesc"></p>'+
          '<div class="cpwb-stat-row"><div><small>ĐỘ HIẾM</small><strong>SSS · MYTHIC</strong></div><div><small>ATK CƠ BẢN</small><strong id="cpwbWeaponAtk">680</strong></div><div><small>THẦN KỸ</small><strong id="cpwbWeaponSkill">Huyết Nguyệt Phán Quyết</strong></div></div>'+
          '<div class="cpwb-carousel"><button type="button" id="cpwbPrev" aria-label="Vũ khí trước">‹</button><div id="cpwbDots" class="cpwb-dots"></div><button type="button" id="cpwbNext" aria-label="Vũ khí tiếp theo">›</button></div>'+
        '</div>'+
      '</div>'+
      '<div class="cpwb-bottom"><div class="cpwb-pool-info"><span class="cpwb-pool-icon">⚔</span><div><strong id="cpwbModeHeading">BANNER VŨ KHÍ ĐANG ĐƯỢC CHỌN</strong><small id="cpwbModeDesc">Kết quả chỉ ra vũ khí; tỷ lệ hiếm và Pity 90 giữ nguyên.</small></div></div>'+
        '<div class="cpwb-mode-switch"><button type="button" id="cpwbWeaponMode" class="active">⚔ BANNER VŨ KHÍ</button><button type="button" id="cpwbAllMode">✦ THÁNH KHÍ TỔNG HỢP</button></div></div>';
    const existingHeader=tab.firstElementChild;
    tab.insertBefore(section,existingHeader || null);

    let index=0;
    const art=document.getElementById('cpwbWeaponArt'), name=document.getElementById('cpwbWeaponName'), desc=document.getElementById('cpwbWeaponDesc');
    const atk=document.getElementById('cpwbWeaponAtk'), skill=document.getElementById('cpwbWeaponSkill'), caption=document.getElementById('cpwbArtCaption'), dots=document.getElementById('cpwbDots');
    function renderWeapon(i){
      index=(i+WEAPON_SPOTLIGHTS.length)%WEAPON_SPOTLIGHTS.length;
      const w=WEAPON_SPOTLIGHTS[index];
      section.style.setProperty('--wb-color',w.color);section.style.setProperty('--wb-sub',w.sub);
      art.innerHTML=weaponSvg(w.shape,w.color,w.sub);
      name.textContent=w.name;desc.textContent=w.text;atk.textContent=String(w.atk);
      let skillName=w.id==='w_yuno_sss'?'Huyết Nguyệt Phán Quyết':w.id==='w_sss_1'?'Vạn Vật Đình Trệ':w.id==='w_sss_2'?'Hư Không Táng Diệt':w.id==='w_sss_3'?'Tử Thần Thu Hồn':w.id==='w_sss_4'?'Pháo Tinh Vân 0-K':w.id==='w_sss_5'?'Ảnh Nguyệt Tam Đoạn':'Atomic Dominion';
      if (typeof WEAPON_SKILL_PRESETS!=='undefined' && WEAPON_SKILL_PRESETS[w.id]) skillName=WEAPON_SKILL_PRESETS[w.id].name;
      skill.textContent=skillName;
      caption.textContent='RELIC '+String(index+1).padStart(2,'0')+' / '+String(WEAPON_SPOTLIGHTS.length).padStart(2,'0');
      dots.innerHTML='';
      WEAPON_SPOTLIGHTS.forEach((x,j)=>{const b=document.createElement('button');b.type='button';b.className='cpwb-dot'+(j===index?' active':'');b.setAttribute('aria-label','Hiện '+x.name);b.addEventListener('click',()=>renderWeapon(j));dots.appendChild(b);});
    }
    document.getElementById('cpwbPrev').addEventListener('click',()=>renderWeapon(index-1));
    document.getElementById('cpwbNext').addEventListener('click',()=>renderWeapon(index+1));
    document.getElementById('cpwbWeaponMode').addEventListener('click',()=>setWeaponMode(true));
    document.getElementById('cpwbAllMode').addEventListener('click',()=>setWeaponMode(false));
    renderWeapon(0);
  }

  function setWeaponMode(enabled) {
    window.__cpWeaponBannerMode=!!enabled;
    const weaponBtn=document.getElementById('cpwbWeaponMode'), allBtn=document.getElementById('cpwbAllMode');
    if(weaponBtn)weaponBtn.classList.toggle('active',!!enabled);
    if(allBtn)allBtn.classList.toggle('active',!enabled);
    const heading=document.getElementById('cpwbModeHeading'), copy=document.getElementById('cpwbModeDesc');
    if(heading)heading.textContent=enabled?'BANNER VŨ KHÍ ĐANG ĐƯỢC CHỌN':'BANNER THÁNH KHÍ TỔNG HỢP';
    if(copy)copy.textContent=enabled?'Kết quả chỉ ra vũ khí; tỷ lệ hiếm và Pity 90 giữ nguyên.':'Kết quả có thể là vũ khí, giáp, mũ, nhẫn hoặc bảo vật.';
    const tab=document.getElementById('tabContentGacha');
    if(tab){
      const h=tab.querySelector(':scope > div h3');
      if(h)h.textContent=enabled?'TRIỆU HỒI VŨ KHÍ THẦN THOẠI':'TRIỆU HỒI BỘ THÁNH KHÍ GENESIS VÔ HẠN';
    }
    if(typeof showToast==='function')showToast(enabled?'Đã chọn Banner Vũ Khí — không rơi giáp/phụ kiện.':'Đã chọn Banner Thánh Khí Tổng Hợp.','⚔️');
  }

  function patchWeaponPool() {
    if(typeof window.getRandomGearByRank!=='function' || window.getRandomGearByRank.__cpWeaponPoolWrapped) return;
    const original=window.getRandomGearByRank;
    const wrapped=function(rank){
      if(!window.__cpWeaponBannerMode) return original.apply(this,arguments);
      try{
        const pool=typeof GEAR_DATABASE!=='undefined'?GEAR_DATABASE.filter(g=>g&&g.type==='weapon'&&g.rank===rank):[];
        if(pool.length)return pool[Math.floor(Math.random()*pool.length)];
      }catch(_){}
      return original.apply(this,arguments);
    };
    wrapped.__cpWeaponPoolWrapped=true;
    window.getRandomGearByRank=wrapped;
  }

  function boot() {
    ensureLayer();
    installWeaponBanner();
    patchWeaponPool();
    if(window.__cpWeaponBannerMode===undefined)setWeaponMode(true);
    if(!animationStarted){animationStarted=true;requestAnimationFrame(renderFX);}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
  // Some legacy game panels are constructed during startup; retry only the light UI hooks.
  let retries=0;
  const retry=setInterval(function(){
    if(document.getElementById('gameCanvas')&&document.getElementById('tabContentGacha')){
      ensureLayer();installWeaponBanner();patchWeaponPool();
    }
    if(++retries>20)clearInterval(retry);
  },250);
})();