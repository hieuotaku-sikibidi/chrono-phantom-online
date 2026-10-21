/* Chrono Phantom: boss identities, signature mechanics, and layered audio */
(function () {
  'use strict';
  if (window.__cpBossAudioOverhaul) return;
  window.__cpBossAudioOverhaul = true;

  var PROFILE = {
    3:{name:'THỐNG LĨNH BÓNG TỐI',type:'lich',primary:'#8b5cf6',secondary:'#c4b5fd',skill:'HẮC ÁM PHÁN QUYẾT',move:'shadowNova',cooldown:5.1,voice:146.83},
    5:{name:'MALAKOR • BẠO CHÚA HUYẾT THỜI',type:'blood',primary:'#f43f5e',secondary:'#fda4af',skill:'HỒNG NGUYỆT LIÊM TRẢM',move:'bloodCrescent',cooldown:4.7,voice:110},
    6:{name:'CHRONO OVERLORD • KẺ NUỐT THỜI GIAN',type:'clock',primary:'#fbbf24',secondary:'#67e8f9',skill:'NGHỊCH LƯU THỜI KHẮC',move:'timeRift',cooldown:5.5,voice:73.42},
    7:{name:'HƯ VÔ CỔ THẦN',type:'void',primary:'#a78bfa',secondary:'#22d3ee',skill:'XÚC TUẾ VỰC SÂU',move:'voidRoots',cooldown:4.9,voice:65.41},
    8:{name:'OMEGA • THẦN HỦY DIỆT',type:'omega',primary:'#22d3ee',secondary:'#fde047',skill:'SIÊU TÂN TINH DIỆT THẾ',move:'omegaCross',cooldown:5.2,voice:98},
    9:{name:'CHAOS KING • CHÚA TỂ HỖN MANG',type:'chaos',primary:'#fb7185',secondary:'#c084fc',skill:'HỖN MANG LUÂN VŨ',move:'chaosFan',cooldown:4.4,voice:82.41},
    10:{name:'ZAPHKIEL • HẮC ÁM TỐI THƯỢNG',type:'zaph',primary:'#f472b6',secondary:'#fde68a',skill:'CHUNG KẾT ĐỊNH MỆNH',move:'judgmentClocks',cooldown:5.7,voice:55},
    13:{name:'AURELION • THIÊN LONG CANH CỔNG',type:'dragon',primary:'#fbbf24',secondary:'#fb923c',skill:'LONG VIÊM THIÊN PHẠT',move:'solarDive',cooldown:4.6,voice:123.47},
    15:{name:'ILYRA • NỮ THẦN MẶT NẠ',type:'veil',primary:'#e879f9',secondary:'#f5d0fe',skill:'VẠN ẢNH KÍNH HOA',move:'mirrorPrism',cooldown:5.0,voice:207.65},
    18:{name:'VARKOS • THẦN RÈN DIỆT GIỚI',type:'forge',primary:'#fb923c',secondary:'#fde047',skill:'THIÊN THẠCH LÔ TÂM',move:'forgeQuake',cooldown:4.8,voice:61.74},
    20:{name:'MORVETH • THẦN TƯ TƯỞNG',type:'mind',primary:'#38bdf8',secondary:'#c084fc',skill:'MỘNG YỂM TÂM TRÍ',move:'psychicDarts',cooldown:5.3,voice:92.5},
    22:{name:'ASTRAEA • NỮ THẦN PHÁN QUYẾT',type:'astraea',primary:'#fef08a',secondary:'#67e8f9',skill:'THIÊN PHÁN QUANG TRỤ',move:'celestialRain',cooldown:5.0,voice:164.81},
    24:{name:'SONG THẦN NHẬT NGUYỆT',type:'eclipse',primary:'#facc15',secondary:'#818cf8',skill:'NHẬT THỰC SONG CỰC',move:'eclipseOrbs',cooldown:4.6,voice:73.42},
    26:{name:'KARVHAN • THẦN CHIẾN TRANH',type:'war',primary:'#ef4444',secondary:'#f97316',skill:'XUNG PHONG DIỆT QUÂN',move:'warCharge',cooldown:4.2,voice:49},
    29:{name:'PRIMORDIA • THẦN NGUYÊN THỦY',type:'primordial',primary:'#4ade80',secondary:'#a3e635',skill:'CĂN NGUYÊN THẦN MỘC',move:'primordialRoots',cooldown:5.1,voice:58.27},
    30:{name:'ĐẤNG XƯNG THẦN VÔ DANH',type:'nameless',primary:'#e2e8f0',secondary:'#c084fc',skill:'PHÁN QUYẾT HƯ VÔ CUỐI CÙNG',move:'godfallSpiral',cooldown:4.0,voice:41.2}
  };

  function stageId(){ return typeof currentStage === 'number' ? currentStage : 1; }
  function profileFor(stage){ return PROFILE[stage] || null; }
  function activeCtx(){
    try {
      if (typeof audioCtx !== 'undefined' && audioCtx) {
        if (audioCtx.state === 'suspended') audioCtx.resume().catch(function(){});
        return audioCtx;
      }
      if (typeof initAudio === 'function') initAudio();
      return typeof audioCtx !== 'undefined' ? audioCtx : null;
    } catch (_) { return null; }
  }
  var audioBus = null, audioBusCtx = null, noiseBuf = null, noiseCtx = null;
  function bus(ctx){
    if (audioBus && audioBusCtx === ctx) return audioBus;
    try {
      var comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -20; comp.knee.value = 18; comp.ratio.value = 4;
      comp.attack.value = .004; comp.release.value = .18;
      var master = ctx.createGain(); master.gain.value = .78;
      comp.connect(master); master.connect(ctx.destination);
      audioBus = comp; audioBusCtx = ctx;
      return audioBus;
    } catch (_) { return ctx.destination; }
  }
  function outGain(ctx, amount, t, duration) {
    var g = ctx.createGain();
    g.gain.setValueAtTime(.0001,t);
    g.gain.exponentialRampToValueAtTime(Math.max(.0002,amount),t+Math.min(.012,duration*.25));
    g.gain.setValueAtTime(Math.max(.0002,amount),Math.max(t+.013,t+duration*.38));
    g.gain.exponentialRampToValueAtTime(.0001,t+duration);
    g.connect(bus(ctx));
    return g;
  }
  function tone(startHz,endHz,duration,volume,wave,delay,filterHz,detune){
    var ctx=activeCtx(); if(!ctx || (typeof isAudioMuted!=='undefined'&&isAudioMuted))return;
    try {
      var t=ctx.currentTime+(delay||0),o=ctx.createOscillator(),f=ctx.createBiquadFilter(),g=outGain(ctx,volume,t,duration);
      o.type=wave||'sine'; o.frequency.setValueAtTime(Math.max(1,startHz),t);
      if(endHz && endHz!==startHz)o.frequency.exponentialRampToValueAtTime(Math.max(1,endHz),t+duration);
      if(detune)o.detune.setValueAtTime(detune,t);
      f.type='lowpass'; f.frequency.setValueAtTime(Math.max(100,filterHz||8000),t);
      f.frequency.exponentialRampToValueAtTime(Math.max(100,Math.min(filterHz||8000,(endHz||startHz)*7)),t+duration);
      f.Q.value=.65; o.connect(f);f.connect(g);o.start(t);o.stop(t+duration+.025);
    } catch (_) {}
  }
  function noise(duration,volume,highHz,lowHz,delay,kind){
    var ctx=activeCtx(); if(!ctx || (typeof isAudioMuted!=='undefined'&&isAudioMuted))return;
    try {
      if(noiseCtx!==ctx||!noiseBuf){noiseCtx=ctx;var len=Math.ceil(ctx.sampleRate*.5),buf=ctx.createBuffer(1,len,ctx.sampleRate),a=buf.getChannelData(0);for(var i=0;i<len;i++){var pink=(Math.random()*2-1)*.72; a[i]=pink;}noiseBuf=buf;}
      var t=ctx.currentTime+(delay||0),src=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=outGain(ctx,volume,t,duration);
      src.buffer=noiseBuf;src.loop=true;f.type=kind||'bandpass';f.frequency.setValueAtTime(Math.max(80,highHz),t);f.frequency.exponentialRampToValueAtTime(Math.max(80,lowHz),t+duration);f.Q.value=kind==='bandpass'?1.25:.65;
      src.connect(f);f.connect(g);src.start(t);src.stop(t+duration+.02);
    } catch (_) {}
  }
  function metalPing(freq,delay,vol){
    tone(freq,freq*.985,.26,vol||.045,'sine',delay||0,9500);
    tone(freq*2.76,freq*2.42,.18,(vol||.045)*.35,'triangle',(delay||0)+.012,10000);
  }
  function swordSlash(){
    if(typeof isAudioMuted!=='undefined'&&isAudioMuted)return;
    noise(.19,.12,8200,500,0,'bandpass');
    noise(.115,.055,4200,900,.015,'highpass');
    tone(520,118,.16,.095,'sawtooth',0,3200);
    metalPing(1580+Math.random()*260,.018,.037);
  }
  function hit(critical){
    var c=!!critical;if(typeof isAudioMuted!=='undefined'&&isAudioMuted)return;
    noise(c?.22:.11,c?.21:.15,c?5200:2400,c?180:110,0,'lowpass');
    noise(c?.075:.045,c?.08:.065,c?9000:3800,c?2400:900,.006,'bandpass');
    tone(c?220:138,c?39:52,c?.33:.16,c?.24:.17,'sine',0,900);
    tone(c?920:360,c?110:75,c?.20:.11,c?.07:.045,'triangle',.003,2200);
    if(c){metalPing(1900,.018,.05);metalPing(2637,.075,.034);tone(120,42,.34,.08,'sawtooth',.035,650);}
  }
  function dash(){
    if(typeof isAudioMuted!=='undefined'&&isAudioMuted)return;
    noise(.22,.105,6500,180,0,'bandpass');tone(420,95,.19,.075,'triangle',0,2100);
    tone(1250,340,.13,.035,'sine',.01,6000);metalPing(1046,.035,.022);
  }
  function parry(){
    if(typeof isAudioMuted!=='undefined'&&isAudioMuted)return;
    noise(.07,.11,10500,3300,0,'bandpass');
    [1174.66,1567.98,2093,2793.8].forEach(function(n,i){metalPing(n,i*.028,.043-i*.006);});
    tone(2500,1300,.20,.045,'triangle',.02,9000);
  }
  function ultimate(){
    if(typeof isAudioMuted!=='undefined'&&isAudioMuted)return;
    noise(.55,.20,950,85,.035,'lowpass');noise(.20,.10,8500,450,.07,'bandpass');
    tone(125,28,.9,.28,'sine',0,420);tone(310,42,.62,.12,'sawtooth',.012,950);
    tone(880,180,.42,.06,'triangle',.04,5000);metalPing(1760,.12,.045);
  }
  function gacha(rank){
    if(typeof isAudioMuted!=='undefined'&&isAudioMuted)return;
    var base=rank==='SSS'?1318.51:(rank==='SSR'||rank==='SS'?987.77:rank==='S'?783.99:523.25);
    noise(rank==='SSS'?.38:.14,rank==='SSS'?.09:.03,rank==='SSS'?9800:5700,1200,0,'bandpass');
    var chord=rank==='SSS'?[1,1.25,1.5,2,2.5]:rank==='SSR'||rank==='SS'?[1,1.25,1.5]:[1,1.25];
    chord.forEach(function(m,i){metalPing(base*m,i*.065,rank==='SSS'?.062:.035);});
    if(rank==='SSS'){tone(659,1318,.62,.11,'sine',.18,9000);tone(1760,2637,.42,.055,'triangle',.27,10000);}
  }
  function bossSkill(stage){
    var p=profileFor(stage);if(!p)return;
    if(typeof isAudioMuted!=='undefined'&&isAudioMuted)return;
    noise(.32,.16,Math.max(220,p.voice*14),Math.max(60,p.voice*.45),0,'lowpass');
    tone(p.voice*2.5,p.voice*.48,.46,.14,'sawtooth',0,Math.max(550,p.voice*18));
    tone(p.voice*5,p.voice*2.2,.24,.06,'triangle',.045,9000);
    metalPing(p.voice*8,.09,.035);
    if(typeof sfxUltimateBoom==='function') { /* separate from standard ultimate; layered voice owns the attack */ }
  }
  window.sfxSwordSlash=swordSlash;
  window.sfxHitImpact=hit;
  window.sfxDash=dash;
  window.sfxParrySuccess=parry;
  window.sfxUltimateBoom=ultimate;
  window.sfxGachaChime=gacha;
  window.sfxBossSkill=bossSkill;
  try{sfxSwordSlash=swordSlash;sfxHitImpact=hit;sfxDash=dash;sfxParrySuccess=parry;sfxUltimateBoom=ultimate;sfxGachaChime=gacha;}catch(_){}

  var oldBgmTimer = null, bgmSeq = 0;
  var minor=[0,3,5,7,10,7,5,3,0,3,7,10,12,10,7,5];
  function startBetterBgm(){
    if(typeof isAudioMuted!=='undefined'&&isAudioMuted)return;
    var ctx=activeCtx();if(!ctx)return;
    try { if(typeof bgmTimer!=='undefined'&&bgmTimer)clearInterval(bgmTimer); } catch(_){}
    if(oldBgmTimer)clearInterval(oldBgmTimer);
    bgmSeq=0;
    var bass=[55,55,65.41,49],mode=[0,3,5,7,10,12];
    oldBgmTimer=setInterval(function(){
      if(typeof isAudioMuted!=='undefined'&&isAudioMuted)return;
      if(typeof gameState!=='undefined'&&gameState!=='PLAYING')return;
      var c=activeCtx();if(!c)return;
      var stage=stageId(),bossMode=!!profileFor(stage),t=bgmSeq++;
      var base=stage>=11?146.83:(bossMode?110:98),step=minor[t%minor.length],freq=base*Math.pow(2,step/12);
      tone(freq,freq*.997,.30,bossMode?.026:.019,'triangle',0,bossMode?1100:1800,(t%2?3:-3));
      tone(freq*2.003,freq*1.5,.13,.008,'sine',.02,6000);
      if(t%4===0){var low=bass[(Math.floor(t/4))%bass.length]*(stage>=11?1.25:1);tone(low,low*.72,.42,bossMode?.10:.072,'sine',0,310);noise(.085,bossMode?.08:.052,150,60,0,'lowpass');}
      if(t%8===0){var chordRoot=base*Math.pow(2,mode[(Math.floor(t/8))%mode.length]/12);tone(chordRoot*1.5,chordRoot*1.5,.72,.014,'sine',.02,2600);tone(chordRoot*2,chordRoot*1.99,.54,.009,'triangle',.05,4800);}
      if(t%16===0){tone(base*.5,base*.48,1.8,.018,'sine',0,240);tone(base*4,base*3.9,.55,.007,'sine',.22,7500);}
    },205);
    try{bgmTimer=oldBgmTimer;startBgmLoop= startBetterBgm;}catch(_){}
  }
  window.startBgmLoop=startBetterBgm;
  try{startBgmLoop=startBetterBgm;}catch(_){}

  function strokePath(c,color,width,fn,alpha){
    c.save();c.globalAlpha=alpha==null?1:alpha;c.strokeStyle=color;c.lineWidth=width||2;c.lineJoin='round';c.lineCap='round';c.shadowColor=color;c.shadowBlur=9;c.beginPath();fn();c.stroke();c.restore();
  }
  function fillPath(c,color,fn,alpha){
    c.save();c.globalAlpha=alpha==null?1:alpha;c.fillStyle=color;c.shadowColor=color;c.shadowBlur=12;c.beginPath();fn();c.fill();c.restore();
  }
  function star(c,x,y,r,color,rot){
    c.save();c.translate(x,y);c.rotate(rot||0);c.fillStyle=color;c.shadowColor=color;c.shadowBlur=12;c.beginPath();
    for(var i=0;i<10;i++){var a=-Math.PI/2+i*Math.PI/5,rr=i%2===0?r:r*.34;c.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}
    c.closePath();c.fill();c.restore();
  }
  function drawBossIdentity(c,b,p){
    var t=b.animTimer||0,ang=t*(b.isEnraged?1.9:1),lift=Math.sin(t*4.1)*3,prim=p.primary,sec=p.secondary;
    c.save();c.translate(b.x,b.y);if(b.facing===-1)c.scale(-1,1);
    c.globalCompositeOperation='lighter';
    // Every identity has its own silhouette ornament and idle loop, not just recolored armor.
    if(p.type==='lich'){
      c.globalCompositeOperation='source-over';
      fillPath(c,'#160b2b',function(){c.moveTo(-17,-72+lift);c.lineTo(0,-102+lift);c.lineTo(18,-72+lift);c.lineTo(26,-23);c.lineTo(12,-34);c.lineTo(0,-19);c.lineTo(-12,-34);c.lineTo(-27,-22);c.closePath();},.92);
      strokePath(c,prim,2,function(){c.moveTo(-16,-77+lift);c.quadraticCurveTo(-29,-51, -18,-29);c.moveTo(16,-77+lift);c.quadraticCurveTo(29,-51,18,-29);c.moveTo(-7,-67+lift);c.lineTo(-2,-62+lift);c.lineTo(-7,-58+lift);c.moveTo(7,-67+lift);c.lineTo(2,-62+lift);c.lineTo(7,-58+lift);});
      [-1,1].forEach(function(d){c.save();c.translate(d*(39+Math.sin(ang)*5),-48+Math.cos(ang)*7);c.rotate(d*ang*.8);strokePath(c,sec,3,function(){c.moveTo(-8,-20);c.quadraticCurveTo(12,-5,4,13);c.moveTo(4,13);c.lineTo(12,8);c.lineTo(8,20);});fillPath(c,prim,function(){c.arc(0,0,4,0,Math.PI*2);});c.restore();});
      strokePath(c,sec,1.7,function(){c.arc(0,-48+lift,57,ang,ang+Math.PI*1.35);c.arc(0,-48+lift,65,-ang,-ang+Math.PI*1.05);},.65);
    }else if(p.type==='blood'){
      strokePath(c,prim,4,function(){c.moveTo(-12,-73);c.quadraticCurveTo(-31,-88-Math.sin(t*3)*5,-35,-104);c.quadraticCurveTo(-18,-91,-9,-73);c.moveTo(12,-73);c.quadraticCurveTo(31,-88-Math.sin(t*3)*5,35,-104);c.quadraticCurveTo(18,-91,9,-73);});
      [-1,1].forEach(function(d){c.save();c.translate(d*(42+Math.sin(ang)*7),-53+Math.cos(ang)*11);c.rotate(d*ang);strokePath(c,'#fecdd3',2,function(){c.arc(0,0,20,-Math.PI*.84,Math.PI*.55);c.moveTo(Math.cos(-Math.PI*.84)*20,Math.sin(-Math.PI*.84)*20);c.lineTo(-5,-17);},.95);c.restore();});
      for(var z=0;z<4;z++){var a=ang+z*Math.PI/2;fillPath(c,prim,function(){c.arc(Math.cos(a)*29,-49+Math.sin(a)*18,2.6,0,Math.PI*2);},.8);}
    }else if(p.type==='clock'){
      c.save();c.translate(0,-56+lift);c.rotate(-ang*.36);strokePath(c,sec,3,function(){c.arc(0,0,61,0,Math.PI*2);},.9);strokePath(c,prim,1.4,function(){c.arc(0,0,54,0,Math.PI*2);for(var i=0;i<12;i++){var a=i*Math.PI/6;c.moveTo(Math.cos(a)*47,Math.sin(a)*47);c.lineTo(Math.cos(a)*56,Math.sin(a)*56);}},.9);strokePath(c,sec,2.2,function(){c.moveTo(0,0);c.lineTo(Math.cos(ang*1.9)*38,Math.sin(ang*1.9)*38);c.moveTo(0,0);c.lineTo(Math.cos(-ang*.8)*27,Math.sin(-ang*.8)*27);});c.restore();
      [-1,1].forEach(function(d){c.save();c.translate(d*34,-35+Math.sin(ang*2+d)*4);c.rotate(ang*d);strokePath(c,prim,2,function(){c.rect(-8,-8,16,16);c.moveTo(-8,0);c.lineTo(8,0);c.moveTo(0,-8);c.lineTo(0,8);});c.restore();});
      fillPath(c,sec,function(){c.arc(0,-46+lift,5+Math.sin(t*6),0,Math.PI*2);});
    }else if(p.type==='void'){
      for(var a2=0;a2<4;a2++){var d2=a2%2?1:-1;c.save();c.translate(d2*(22+a2*3),-40+lift);c.rotate(Math.sin(t*2+a2)*.22+d2*.25);strokePath(c,prim,4,function(){c.moveTo(0,0);c.bezierCurveTo(d2*24,-12,d2*22,16,d2*39,Math.sin(t*3+a2)*12);c.bezierCurveTo(d2*47,22,d2*48,-5,d2*54,-8);},.93);fillPath(c,sec,function(){c.arc(d2*(43+a2),Math.sin(t*3+a2)*10,3,0,Math.PI*2);});c.restore();}
      c.save();c.translate(0,-83+Math.sin(t*3)*5);c.rotate(ang*.75);strokePath(c,prim,2,function(){for(var i=0;i<3;i++)c.arc(0,0,11+i*6,i*2.1,i*2.1+Math.PI*1.45);});c.restore();
    }else if(p.type==='omega'){
      [-1,1].forEach(function(d){for(var i=0;i<3;i++){c.save();c.translate(d*(17+i*4),-48);c.rotate(d*(.25+i*.2)+Math.sin(t*6+i)*.12);fillPath(c,i===1?sec:prim,function(){c.moveTo(0,0);c.lineTo(d*(34+i*4),-27-i*3);c.lineTo(d*(52+i*2),-4+i*4);c.lineTo(d*27,9+i*3);c.closePath();},.65);strokePath(c,'#e0f2fe',1,function(){c.moveTo(0,0);c.lineTo(d*(34+i*4),-27-i*3);c.lineTo(d*(52+i*2),-4+i*4);});c.restore();}});
      c.save();c.translate(0,-51+lift);c.rotate(ang*.65);strokePath(c,sec,2,function(){c.moveTo(-62,0);c.lineTo(62,0);c.moveTo(0,-62);c.lineTo(0,62);});for(var j=0;j<4;j++)star(c,Math.cos(ang+j*Math.PI/2)*57,Math.sin(ang+j*Math.PI/2)*57,5,prim,ang);c.restore();
    }else if(p.type==='chaos'){
      [-1,1].forEach(function(d){c.save();c.translate(d*(37+Math.sin(ang)*4),-58+Math.cos(ang*1.1)*8);c.rotate(d*.15);fillPath(c,'#260b24',function(){c.moveTo(-12,-4);c.lineTo(-8,-16);c.lineTo(-2,-8);c.lineTo(5,-16);c.lineTo(12,-3);c.lineTo(9,9);c.lineTo(0,14);c.lineTo(-9,8);c.closePath();});strokePath(c,sec,1.6,function(){c.moveTo(-5,-2);c.lineTo(-2,1);c.moveTo(5,-2);c.lineTo(2,1);c.moveTo(-4,7);c.lineTo(4,7);});c.restore();});
      for(var k=0;k<6;k++){var aa=ang*1.25+k*Math.PI/3;strokePath(c,prim,2,function(){c.moveTo(Math.cos(aa)*28,-50+Math.sin(aa)*26);c.lineTo(Math.cos(aa)*47,-50+Math.sin(aa)*26);},.8);star(c,Math.cos(aa)*48,-50+Math.sin(aa)*26,4,sec,aa);}
    }else if(p.type==='zaph'){
      c.save();c.translate(0,-79+lift);c.rotate(-ang*.22);strokePath(c,sec,2,function(){c.ellipse(0,0,52,15,0,0,Math.PI*2);c.ellipse(0,0,34,10,0,0,Math.PI*2);});for(var j2=0;j2<8;j2++){var aa2=j2*Math.PI/4;fillPath(c,j2%2?prim:sec,function(){c.moveTo(Math.cos(aa2)*40,Math.sin(aa2)*12);c.lineTo(Math.cos(aa2)*58,Math.sin(aa2)*20);c.lineTo(Math.cos(aa2+.18)*44,Math.sin(aa2+.18)*13);c.closePath();},.9);}c.restore();
      [-1,1].forEach(function(d){c.save();c.translate(d*(47+Math.sin(ang)*4),-36+Math.cos(ang)*8);c.rotate(d*(ang*.7+.2));strokePath(c,sec,3,function(){c.moveTo(-5,-22);c.lineTo(5,-22);c.lineTo(8,22);c.lineTo(-8,22);c.closePath();c.moveTo(0,-22);c.lineTo(0,22);});c.restore();});
    }else if(p.type==='dragon'){
      [-1,1].forEach(function(d){c.save();c.translate(d*8,-49+lift);c.rotate(d*(.3+Math.sin(t*5)*.15));fillPath(c,'#713f12',function(){c.moveTo(0,0);c.quadraticCurveTo(d*24,-33,d*59,-37);c.lineTo(d*47,-17);c.lineTo(d*63,-5);c.lineTo(d*30,4);c.lineTo(d*13,12);c.closePath();},.9);strokePath(c,sec,2,function(){c.moveTo(0,0);c.lineTo(d*53,-31);c.lineTo(d*34,-1);});for(var n=0;n<4;n++)strokePath(c,prim,1,function(){c.moveTo(d*(18+n*8),-8-n*4);c.lineTo(d*(25+n*8),-15-n*3);});c.restore();});
      strokePath(c,prim,3,function(){c.moveTo(-8,-70);c.quadraticCurveTo(-22,-89,-13,-101);c.lineTo(-3,-75);c.moveTo(8,-70);c.quadraticCurveTo(22,-89,13,-101);c.lineTo(3,-75);});
      fillPath(c,sec,function(){c.arc(0,-51+lift,7+Math.sin(t*8),0,Math.PI*2);});
    }else if(p.type==='veil'){
      strokePath(c,sec,2,function(){c.moveTo(-9,-70+lift);c.quadraticCurveTo(-26,-42, -20,-17);c.quadraticCurveTo(-8,-26,0,-9);c.quadraticCurveTo(8,-26,20,-17);c.quadraticCurveTo(26,-42,9,-70+lift);},.95);
      for(var f=0;f<5;f++){c.save();c.translate(-14+f*7,-42+lift);c.rotate(Math.sin(t*5+f)*.15+(f-2)*.16);strokePath(c,prim,2,function(){c.moveTo(0,0);c.quadraticCurveTo(-12,-25,-4,-39);c.quadraticCurveTo(7,-23,0,0);});c.restore();}
      c.save();c.translate(0,-63+lift);c.rotate(ang*.4);strokePath(c,sec,1.5,function(){c.ellipse(0,0,43,24,0,0,Math.PI*2);});c.restore();
    }else if(p.type==='forge'){
      fillPath(c,'#431407',function(){c.moveTo(-21,-51);c.lineTo(-29,-62);c.lineTo(-15,-59);c.lineTo(-9,-73);c.lineTo(0,-61);c.lineTo(12,-75);c.lineTo(17,-58);c.lineTo(30,-62);c.lineTo(20,-44);c.closePath();},.95);
      c.save();c.translate(38+Math.sin(t*3)*3,-40+lift);c.rotate(Math.sin(t*4)*.35-.18);strokePath(c,sec,4,function(){c.moveTo(-4,-32);c.lineTo(2,15);});fillPath(c,prim,function(){c.moveTo(-13,-35);c.lineTo(11,-39);c.lineTo(20,-25);c.lineTo(4,-14);c.lineTo(-15,-21);c.closePath();});strokePath(c,'#fff7ed',1,function(){c.moveTo(-13,-35);c.lineTo(11,-39);c.lineTo(20,-25);c.lineTo(4,-14);c.lineTo(-15,-21);c.closePath();});c.restore();
      for(var q=0;q<4;q++){var aa3=t*2+q*Math.PI/2;fillPath(c,sec,function(){c.arc(Math.cos(aa3)*37,-28+Math.sin(aa3)*18,2+Math.random(),0,Math.PI*2);},.75);}
    }else if(p.type==='mind'){
      c.save();c.translate(0,-64+lift);c.rotate(ang*.2);strokePath(c,prim,3,function(){c.ellipse(0,0,16,11,0,0,Math.PI*2);});fillPath(c,sec,function(){c.ellipse(0,0,6,9,0,0,Math.PI*2);});fillPath(c,'#020617',function(){c.arc(0,0,2.5,0,Math.PI*2);});c.restore();
      for(var eye=0;eye<3;eye++){var an=ang+eye*Math.PI*2/3;c.save();c.translate(Math.cos(an)*38,-51+Math.sin(an)*19);c.rotate(an);strokePath(c,sec,1.5,function(){c.ellipse(0,0,8,4,0,0,Math.PI*2);});fillPath(c,prim,function(){c.arc(0,0,2.5,0,Math.PI*2);});c.restore();}
      strokePath(c,prim,2,function(){c.moveTo(-16,-38);c.bezierCurveTo(-48,-29,-38,-9,-52,-4);c.moveTo(16,-38);c.bezierCurveTo(48,-29,38,-9,52,-4);},.7);
    }else if(p.type==='astraea'){
      [-1,1].forEach(function(d){c.save();c.translate(d*7,-50+lift);c.rotate(d*(.18+Math.sin(t*4)*.12));fillPath(c,'#fef3c7',function(){c.moveTo(0,0);c.quadraticCurveTo(d*31,-30,d*55,-26);c.lineTo(d*38,-7);c.lineTo(d*57,5);c.lineTo(d*19,9);c.closePath();},.75);strokePath(c,sec,2,function(){c.moveTo(0,0);c.lineTo(d*51,-23);c.moveTo(d*18,-3);c.lineTo(d*34,2);});c.restore();});
      c.save();c.translate(0,-91+lift);c.rotate(ang*.45);strokePath(c,prim,2,function(){c.arc(0,0,18,Math.PI,0);c.moveTo(-18,0);c.lineTo(18,0);});c.restore();
      strokePath(c,sec,2,function(){c.moveTo(35,-55);c.lineTo(46,-92);c.lineTo(49,-42);c.moveTo(42,-67);c.lineTo(55,-63);});
    }else if(p.type==='eclipse'){
      [-1,1].forEach(function(d){c.save();c.translate(d*(34+Math.sin(ang)*5),-55+Math.cos(ang)*8);c.rotate(d*ang*.6);strokePath(c,d===1?prim:sec,2,function(){c.arc(0,0,19,d===1?.4:-2.8,d===1?5.8:2.8);});fillPath(c,d===1?prim:sec,function(){c.arc(0,0,8,0,Math.PI*2);},.5);if(d===1){fillPath(c,'#fef3c7',function(){c.arc(3,-2,6,0,Math.PI*2);},.9);fillPath(c,'#facc15',function(){c.arc(6,-3,6,0,Math.PI*2);},.95);}else{fillPath(c,'#c7d2fe',function(){c.arc(0,0,8,0,Math.PI*2);},.6);fillPath(c,'#1e1b4b',function(){c.arc(3,-2,6,0,Math.PI*2);});}c.restore();});
      strokePath(c,sec,1.6,function(){c.ellipse(0,-52+lift,59,20,Math.sin(ang)*.1,0,Math.PI*2);},.65);
    }else if(p.type==='war'){
      strokePath(c,prim,5,function(){c.moveTo(-10,-70);c.lineTo(-28,-91);c.lineTo(-30,-73);c.lineTo(-17,-57);c.moveTo(10,-70);c.lineTo(28,-91);c.lineTo(30,-73);c.lineTo(17,-57);});
      c.save();c.translate(39,-36+lift);c.rotate(Math.sin(t*4)*.45);strokePath(c,sec,5,function(){c.moveTo(-5,-36);c.lineTo(6,24);});fillPath(c,prim,function(){c.moveTo(-7,-37);c.lineTo(19,-33);c.lineTo(25,-13);c.lineTo(0,-8);c.lineTo(-15,-21);c.closePath();});strokePath(c,'#fee2e2',1,function(){c.moveTo(-7,-37);c.lineTo(19,-33);c.lineTo(25,-13);c.lineTo(0,-8);c.lineTo(-15,-21);c.closePath();});c.restore();
      c.save();c.translate(0,-61+lift);c.rotate(-ang);strokePath(c,sec,2,function(){c.arc(0,0,36,-.7,Math.PI*.7);});c.restore();
    }else if(p.type==='primordial'){
      for(var r=0;r<5;r++){var side=r%2?1:-1;c.save();c.translate(side*(8+r*4),-28+lift);c.rotate(side*(.2+Math.sin(t*2+r)*.12));strokePath(c,prim,3,function(){c.moveTo(0,0);c.bezierCurveTo(side*14,-9,side*18,-28,side*(26+r*4),-37-r*3);c.moveTo(side*18,-25);c.lineTo(side*27,-25);});c.restore();}
      c.save();c.translate(0,-85+lift);c.rotate(ang*.7);strokePath(c,sec,2,function(){for(var u=0;u<4;u++)c.arc(0,0,8+u*5,u*1.6,u*1.6+Math.PI*1.1);});fillPath(c,prim,function(){c.arc(0,0,4+Math.sin(t*7)*1.5,0,Math.PI*2);});c.restore();
    }else if(p.type==='nameless'){
      for(var ep=0;ep<6;ep++){var epa=ang+ep*Math.PI/3;var ex=Math.cos(epa)*47,ey=-58+Math.sin(epa)*28;strokePath(c,sec,1.5,function(){c.ellipse(ex,ey,7,4,epa,0,Math.PI*2);},.8);fillPath(c,prim,function(){c.arc(ex,ey,2.4,0,Math.PI*2);});}
      for(var h=0;h<3;h++){c.save();c.translate(0,-63+lift);c.rotate(ang*(h%2?-.35:.42)+h*.9);strokePath(c,h===1?prim:sec,2,function(){c.ellipse(0,0,27+h*11,13+h*4,0,0,Math.PI*2);});c.restore();}
      for(var tent=0;tent<4;tent++){var dd=tent%2?1:-1;strokePath(c,prim,3,function(){c.moveTo(dd*13,-28);c.bezierCurveTo(dd*28,-12,dd*37,-26,dd*(45+Math.sin(t*3+tent)*4),-11);},.85);}
      if(b.isEnraged){for(var sh=0;sh<8;sh++){var sha=sh*Math.PI/4+ang;star(c,Math.cos(sha)*68,-55+Math.sin(sha)*35,4,sec,sha);}}
    }
    // A unique telegraph pose: active skill winds up differently for each boss.
    if(b._cpSkillWindup>0){c.save();c.translate(0,-54+lift);c.rotate(ang);strokePath(c,sec,2.6,function(){c.arc(0,0,73,Math.PI*.15,Math.PI*1.72);},Math.min(1,b._cpSkillWindup/.65));star(c,Math.cos(ang)*73,Math.sin(ang)*73,5,sec,ang);c.restore();}
    c.restore();
  }
  var oldDrawBoss=window.drawPixelBoss;
  if(typeof oldDrawBoss==='function'){
    window.drawPixelBoss=function(c,b){
      oldDrawBoss.apply(this,arguments);
      var p=profileFor(stageId());if(p&&b&&b.alive)drawBossIdentity(c,b,p);
    };
    try{drawPixelBoss=window.drawPixelBoss;}catch(_){}
  }

  function bullet(x,y,vx,vy,color,damage,radius,life){
    if(typeof enemyBullets==='undefined'||!Array.isArray(enemyBullets))return;
    enemyBullets.push({x:x,y:y,vx:vx,vy:vy,color:color,damage:damage,radius:radius||5,life:life||3});
  }
  function fireAimed(b,count,spread,speed,color,damage){
    var px=typeof player!=='undefined'?player.x:b.x-1,py=typeof player!=='undefined'?player.y-20:b.y-50;
    var a=Math.atan2(py-(b.y-48),px-b.x),n=Math.max(1,count);
    for(var i=0;i<n;i++){var off=(i-(n-1)/2)*spread;bullet(b.x,b.y-48,Math.cos(a+off)*speed,Math.sin(a+off)*speed,color,damage,4.5,3.4);}
  }
  function radial(b,count,speed,color,damage,offset){
    var n=Math.max(1,count),base=offset||0;
    for(var i=0;i<n;i++){var a=base+(Math.PI*2*i/n);bullet(b.x,b.y-48,Math.cos(a)*speed,Math.sin(a)*speed,color,damage,4.5,3.4);}
  }
  function pillars(b,count,color,damage){
    var px=typeof player!=='undefined'?player.x:b.x;
    var width=typeof V_WIDTH!=='undefined'?V_WIDTH:520;
    for(var i=0;i<count;i++){
      var x=Math.max(18,Math.min(width-18,px+(i-(count-1)/2)*52));
      if(typeof spawnMagicCircle==='function')spawnMagicCircle(x,typeof GROUND_Y!=='undefined'?GROUND_Y:390,17,color,.65,true);
      bullet(x, (typeof GROUND_Y!=='undefined'?GROUND_Y:390)-120, 0, 290,color,damage,7,1.2);
      if(typeof spawnParticles==='function')spawnParticles(x,(typeof GROUND_Y!=='undefined'?GROUND_Y:390)-105,6,color,.6);
    }
  }
  function announceSkill(b,p){
    if(typeof spawnDamageText==='function')spawnDamageText(b.x,b.y-107,p.skill,p.secondary,true,'BOSS SKILL • NÉ HOẶC ĐỠ ĐÒN');
    if(typeof sfxBossSkill==='function')sfxBossSkill(stageId());
    if(typeof screenShake!=='undefined')screenShake= Math.max(screenShake||0,5);
    if(typeof screenFlash!=='undefined')screenFlash=Math.max(screenFlash||0,.18);
    if(typeof spawnMagicCircle==='function')spawnMagicCircle(b.x,typeof GROUND_Y!=='undefined'?GROUND_Y:390,64,p.primary,.8,true);
    if(typeof spawnParticles==='function')spawnParticles(b.x,b.y-53,14,p.secondary,.9);
  }
  function useSignatureSkill(b,p,stage){
    var hurt=Math.round((stage>=11?70:30+stage*4)*(b.isEnraged?1.5:1));
    if(stage===3){announceSkill(b,p);radial(b,9,145,p.primary,hurt,b.animTimer*.25);}
    else if(stage===5){announceSkill(b,p);[-.20,0,.20].forEach(function(a){fireAimed(b,3,a,225,p.primary,hurt);});if(typeof shockwaves!=='undefined')[-1,1].forEach(function(d){shockwaves.push({x:b.x,y:typeof GROUND_Y!=='undefined'?GROUND_Y:390,vx:d*220,life:1.25,damage:hurt,color:p.primary,width:11});});}
    else if(stage===6){announceSkill(b,p);radial(b,14,115,p.secondary,hurt,b.animTimer*.9);radial(b,8,205,p.primary,Math.round(hurt*.8),-b.animTimer*.55);}
    else if(stage===7){announceSkill(b,p);fireAimed(b,5,.42,180,p.primary,hurt);pillars(b,3,p.secondary,hurt);}
    else if(stage===8){announceSkill(b,p);fireAimed(b,7,.10,250,p.secondary,hurt);radial(b,8,130,p.primary,Math.round(hurt*.8),Math.PI/4);}
    else if(stage===9){announceSkill(b,p);fireAimed(b,9,.17,205,p.secondary,hurt);radial(b,7,115,p.primary,hurt,b.animTimer);}
    else if(stage===10){announceSkill(b,p);pillars(b,5,p.secondary,hurt);radial(b,8,150,p.primary,hurt,Math.PI/8);}
    else if(stage===13){announceSkill(b,p);fireAimed(b,5,.24,265,p.primary,hurt);if(typeof shockwaves!=='undefined')[-1,1].forEach(function(d){shockwaves.push({x:b.x,y:typeof GROUND_Y!=='undefined'?GROUND_Y:390,vx:d*310,life:1.1,damage:hurt,color:p.secondary,width:15});});}
    else if(stage===15){announceSkill(b,p);radial(b,6,150,p.primary,hurt,b.animTimer*.4);radial(b,6,210,p.secondary,hurt,b.animTimer*.4+Math.PI/6);}
    else if(stage===18){announceSkill(b,p);pillars(b,4,p.primary,hurt);if(typeof shockwaves!=='undefined')[-1,1].forEach(function(d){shockwaves.push({x:b.x,y:typeof GROUND_Y!=='undefined'?GROUND_Y:390,vx:d*260,life:1.4,damage:hurt,color:p.secondary,width:17});});}
    else if(stage===20){announceSkill(b,p);fireAimed(b,7,.11,235,p.secondary,hurt);radial(b,5,95,p.primary,Math.round(hurt*.7),b.animTimer);}
    else if(stage===22){announceSkill(b,p);pillars(b,5,p.secondary,hurt);fireAimed(b,3,.15,145,p.primary,hurt);}
    else if(stage===24){announceSkill(b,p);radial(b,10,155,p.primary,hurt,b.animTimer);radial(b,10,155,p.secondary,hurt,b.animTimer+Math.PI/10);}
    else if(stage===26){announceSkill(b,p);fireAimed(b,7,.22,315,p.primary,hurt);if(typeof shockwaves!=='undefined')[-1,1].forEach(function(d){shockwaves.push({x:b.x,y:typeof GROUND_Y!=='undefined'?GROUND_Y:390,vx:d*360,life:1.2,damage:Math.round(hurt*1.25),color:p.secondary,width:19});});}
    else if(stage===29){announceSkill(b,p);pillars(b,4,p.primary,hurt);fireAimed(b,5,.25,160,p.secondary,hurt);}
    else if(stage===30){announceSkill(b,p);radial(b,22,165,p.secondary,hurt,b.animTimer*.6);fireAimed(b,7,.14,270,p.primary,Math.round(hurt*1.15));if(typeof shockwaves!=='undefined')[-1,1].forEach(function(d){shockwaves.push({x:b.x,y:typeof GROUND_Y!=='undefined'?GROUND_Y:390,vx:d*300,life:1.5,damage:hurt,color:p.secondary,width:20});});}
  }
  var oldUpdateBoss=window.updateBossCombat;
  if(typeof oldUpdateBoss==='function'){
    window.updateBossCombat=function(dt){
      var stage=stageId(),b=typeof boss!=='undefined'?boss:null,p=profileFor(stage);
      if(b&&b.alive&&p){
        if(b._cpBossStage!==stage){b._cpBossStage=stage;b._cpSkillTimer=2.7+((stage%4)*.24);b._cpSkillWindup=0;b._cpSkillPulse=0;}
        if((b.hp/Math.max(1,b.maxHp))<.52&&!b._cpSecondPhase){b._cpSecondPhase=true;b._cpSkillTimer=Math.min(b._cpSkillTimer||4,1.0);if(typeof spawnDamageText==='function')spawnDamageText(b.x,b.y-115,'THẦN TÍNH THỨC TỈNH!',p.primary,true,'GIAI ĐOẠN II • CHIÊU THỨC CƯỜNG HÓA');if(typeof sfxBossSkill==='function')sfxBossSkill(stage);}
        b._cpSkillTimer-=dt||0;b._cpSkillWindup=Math.max(0,(b._cpSkillWindup||0)-(dt||0));
        if(b._cpSkillTimer<=.68&&b._cpSkillTimer>0&&b._cpSkillWindup===0){b._cpSkillWindup=.66;if(typeof spawnMagicCircle==='function')spawnMagicCircle(typeof player!=='undefined'?player.x:b.x,typeof GROUND_Y!=='undefined'?GROUND_Y:390,35,p.secondary,.7,true);if(typeof sfxBossSkill==='function')sfxBossSkill(stage);}
        if(b._cpSkillTimer<=0){useSignatureSkill(b,p,stage);b._cpSkillTimer=p.cooldown*(b.isEnraged?.76:1);b._cpSkillWindup=0;}
      }
      return oldUpdateBoss.apply(this,arguments);
    };
    try{updateBossCombat=window.updateBossCombat;}catch(_){}
  }

  function updateBossHud(){
    var p=profileFor(stageId());if(!p)return;
    var name=document.getElementById('bossNameHud');if(name&&name.textContent!==p.name)name.textContent=p.name;
    var badge=document.getElementById('bossPhaseBadge');
    if(badge&&typeof boss!=='undefined'&&boss&&boss.alive&&boss._cpSecondPhase&&!boss.isEnraged){badge.textContent='THỨC TỈNH ✦';badge.style.borderColor=p.secondary;badge.style.color=p.secondary;}
  }
  var oldStart=window.startGame;
  if(typeof oldStart==='function'){
    window.startGame=function(){var result=oldStart.apply(this,arguments);var p=profileFor(stageId());if(p){var b=typeof boss!=='undefined'?boss:null;if(b){b._cpBossStage=stageId();b._cpSkillTimer=2.7+((stageId()%4)*.24);b._cpSkillWindup=0;b._cpSecondPhase=false;}var n=document.getElementById('bossNameHud');if(n)n.textContent=p.name;if(typeof screenFlash!=='undefined')screenFlash=Math.max(screenFlash||0,.25);if(typeof spawnDamageText==='function'&&b)spawnDamageText(b.x,b.y-119,p.name,p.primary,true,'SIGNATURE BOSS • UNIQUE SKILLS');if(typeof sfxBossSkill==='function')sfxBossSkill(stageId());}return result;};
    try{startGame=window.startGame;}catch(_){}
  }
  var hudTimer=setInterval(function(){try{updateBossHud();}catch(_){}},350);
  window.addEventListener('beforeunload',function(){clearInterval(hudTimer);if(oldBgmTimer)clearInterval(oldBgmTimer);});
})();