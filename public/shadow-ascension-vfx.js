/* Chrono Phantom: Shadow Ascension VFX pass — Atomic Dominion, E/R skills and ruined-city animation */
(function () {
  'use strict';
  if (window.__cpShadowAscensionVfxLoaded) return;
  window.__cpShadowAscensionVfxLoaded = true;

  var FX = [];
  var css = document.createElement('style');
  css.textContent = [
    '.shadow-special-card{border-width:2px!important}',
    '.shadow-special-card .shadow-rank-stamp{font-size:7px!important;letter-spacing:.04em!important}',
    '@keyframes shadowVioletSurge{0%{filter:drop-shadow(0 0 4px #6d28d9)}50%{filter:drop-shadow(0 0 18px #c084fc)}100%{filter:drop-shadow(0 0 7px #67e8f9)}}',
    '.shadow-special-card .shadow-rank-stamp{animation:shadowVioletSurge 1.1s ease-in-out infinite}',
    '@media(prefers-reduced-motion:reduce){.shadow-special-card .shadow-rank-stamp{animation:none!important}}'
  ].join('\n');
  document.head.appendChild(css);

  function shadowSelected() {
    return typeof playerData !== 'undefined' && playerData.selectedCharacter === 'char_shadow';
  }
  function timeNow() { return performance.now(); }
  function pushFx(fx) {
    fx.start = timeNow();
    FX.push(fx);
    if (FX.length > 18) FX.splice(0, FX.length - 18);
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function smooth(v) { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); }

  function drawBuilding(c, x, ground, w, h, seed, collapse, alpha, far) {
    var angle = (seed % 2 ? 1 : -1) * collapse * (.05 + (seed % 5) * .026);
    var drop = collapse * (3 + seed % 7 * 2.2);
    c.save();
    c.translate(x + w * .5, ground + drop);
    c.rotate(angle);
    c.globalAlpha *= alpha;
    var body = c.createLinearGradient(-w/2, -h, w/2, 0);
    body.addColorStop(0, far ? '#17142a' : '#110d20');
    body.addColorStop(.48, far ? '#0d0b19' : '#080711');
    body.addColorStop(1, far ? '#070611' : '#171027');
    c.fillStyle = body;
    c.strokeStyle = collapse > .45 ? '#6d28d9' : '#43305c';
    c.lineWidth = far ? .65 : 1;
    c.beginPath();
    c.moveTo(-w/2, 0); c.lineTo(-w/2, -h*.78);
    c.lineTo(-w*.3, -h*.81); c.lineTo(-w*.24, -h);
    c.lineTo(-w*.04, -h*.9); c.lineTo(w*.12, -h*.98);
    c.lineTo(w*.2, -h*.78); c.lineTo(w/2, -h*.72);
    c.lineTo(w/2, 0); c.closePath(); c.fill(); c.stroke();

    /* Façade ribs, ledges and broken corners. */
    c.strokeStyle = far ? '#33254d' : '#4c3371';
    c.lineWidth = .7;
    for (var rib=1; rib<4; rib++) {
      var ry = -h * rib / 4;
      c.beginPath(); c.moveTo(-w*.43, ry); c.lineTo(w*.42, ry + collapse * (seed%3-1)*3); c.stroke();
    }
    c.strokeStyle = '#a855f7';
    c.globalAlpha *= .4;
    c.beginPath();
    c.moveTo(-w*.31, -h*.71); c.lineTo(-w*.18, -h*.53); c.lineTo(-w*.24, -h*.32);
    c.lineTo(w*.02, -h*.21); c.lineTo(-w*.08, -h*.08);
    c.stroke();

    /* Window matrix, with independently flickering emergency lights. */
    var cols = Math.max(2, Math.floor(w/5));
    var rows = Math.max(3, Math.floor(h/9));
    for (var ry2=0; ry2<rows; ry2++) {
      for (var wx=0; wx<cols; wx++) {
        var flick = .35 + .65*(.5+.5*Math.sin((typeof gameTime==='number'?gameTime:0)*2.8+seed*1.7+wx*2.3+ry2));
        c.globalAlpha = alpha * (far?.32:.63) * flick * (collapse>.6 && (wx+ry2+seed)%4===0?.18:1);
        c.fillStyle = (wx+ry2+seed)%5===0 ? '#67e8f9' : ((wx*3+ry2+seed)%3===0 ? '#c084fc' : '#6d28d9');
        var xx = -w*.37 + wx*(w*.7/cols);
        var yy = -h*.86 + ry2*(h*.75/rows);
        c.fillRect(xx, yy, Math.max(.8,w*.09), Math.max(1.4,h*.018));
      }
    }
    /* Exposed floors and broken support beams as the buildings collapse. */
    if (collapse > .1 && !far) {
      c.globalAlpha = alpha * collapse * .9;
      c.strokeStyle = '#d8b4fe'; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(-w*.43,-h*.53); c.lineTo(w*.12,-h*.39);
      c.lineTo(-w*.14,-h*.17); c.lineTo(w*.43,-h*.25); c.stroke();
      c.fillStyle = '#090610';
      c.beginPath(); c.moveTo(-w*.5,-h*.31); c.lineTo(-w*.02,-h*.24); c.lineTo(w*.5,-h*.28); c.lineTo(w*.5,-h*.18); c.lineTo(-w*.5,-h*.21); c.closePath(); c.fill();
    }
    c.restore();
  }

  function drawCityscape(c, progress, isDomain) {
    var w = V_WIDTH, h = V_HEIGHT, ground = GROUND_Y;
    var t = typeof gameTime === 'number' ? gameTime : 0;
    var cx = w*.5;
    c.save();
    if (isDomain) {
      var wash=c.createLinearGradient(0,0,0,ground);
      wash.addColorStop(0,'rgba(4,2,12,.63)'); wash.addColorStop(.55,'rgba(18,7,36,.42)'); wash.addColorStop(1,'rgba(10,5,22,.32)');
      c.fillStyle=wash; c.fillRect(0,0,w,ground+2);
    } else {
      var bg=c.createLinearGradient(0,0,0,h);
      bg.addColorStop(0,'#030208'); bg.addColorStop(.42,'#100820'); bg.addColorStop(1,'#07040d');
      c.fillStyle=bg; c.fillRect(0,0,w,h);
    }

    /* A vast eclipse, ringed with fine runes and atmospheric light. */
    c.save(); c.globalCompositeOperation='lighter';
    var eclipseY=34+Math.sin(t*.8)*2, eclipseR=20+(isDomain?2:0);
    var halo=c.createRadialGradient(cx,eclipseY,2,cx,eclipseY,eclipseR*3.3);
    halo.addColorStop(0,'rgba(221,190,255,.27)'); halo.addColorStop(.25,'rgba(124,58,237,.20)'); halo.addColorStop(1,'rgba(20,5,44,0)');
    c.fillStyle=halo; c.fillRect(cx-eclipseR*3.5,eclipseY-eclipseR*3.5,eclipseR*7,eclipseR*7);
    c.strokeStyle='#a855f7'; c.globalAlpha=isDomain?.25:.42; c.lineWidth=.8;
    c.beginPath(); c.ellipse(cx,eclipseY,eclipseR*1.65,eclipseR*.62,t*.08,0,Math.PI*2); c.stroke();
    c.strokeStyle='#e9d5ff'; c.setLineDash([3,6]);
    c.beginPath(); c.arc(cx,eclipseY,eclipseR+9,-t*.12,Math.PI*1.8-t*.12); c.stroke(); c.setLineDash([]);
    c.restore();

    /* Far district: narrow spires, radio towers and distant bridges. */
    for (var f=0; f<25; f++) {
      var fx=f*(w/24)-4;
      var fh=15+(f*23%32);
      c.globalAlpha=isDomain?.65:.82;
      c.fillStyle=f%3===0?'#17102a':'#0b0917';
      c.fillRect(fx,ground-fh,w/30+2,fh);
      if(f%4===0){
        c.strokeStyle='#5b21b6';c.lineWidth=.8;c.globalAlpha=.3;
        c.beginPath();c.moveTo(fx+w/60,ground-fh);c.lineTo(fx+w/60,ground-fh-10-(f%3)*4);c.stroke();
      }
    }
    c.globalAlpha=1;

    /* The main skyline collapses from the blast centre outwards. */
    var count=17, spacing=w/(count-1);
    for(var i=0;i<count;i++){
      var x=i*spacing-7;
      var bw=17+(i*11%12), bh=39+(i*31%57);
      var dist=Math.abs(x+bw/2-cx)/(w*.54);
      var collapse=isDomain?1:smooth((progress-.24-dist*.22)*3.3);
      drawBuilding(c,x,ground,bw,bh,i,collapse,isDomain?.93:.98,false);
      if(collapse>.12 || isDomain) {
        var time= t* (12+i%4*5);
        for(var debris=0;debris<3;debris++){
          var frac=(time*.025+debris*.37+i*.071)%1;
          var dx=x+bw/2+(debris-1)*bw*.8+Math.sin(t*2+i+debris)*4;
          var dy=ground-bh*(.15+frac*.72)+frac*frac*18;
          c.save(); c.translate(dx,dy); c.rotate(t*(i%2?1.8:-1.3)+debris);
          c.globalAlpha=isDomain?.45:.7*(1-collapse*.25);
          c.fillStyle=debris%2?'#312044':'#a855f7';
          c.fillRect(-2,-1,4+(i%3),2.2); c.restore();
        }
      }
    }

    /* Cracked elevated highway, snapped pillars and rubble. */
    c.globalAlpha=isDomain?.88:Math.max(.1,progress);
    c.fillStyle='#0a0712'; c.beginPath(); c.moveTo(0,ground-10); c.lineTo(w*.22,ground-15); c.lineTo(w*.33,ground-7);
    c.lineTo(w*.45,ground-18); c.lineTo(w*.58,ground-8); c.lineTo(w*.72,ground-13); c.lineTo(w,ground-5); c.lineTo(w,ground+4); c.lineTo(0,ground+4); c.closePath(); c.fill();
    c.strokeStyle='#7e22ce';c.lineWidth=1.1;c.beginPath();c.moveTo(0,ground-11);c.lineTo(w*.22,ground-16);c.lineTo(w*.33,ground-8);c.lineTo(w*.45,ground-19);c.lineTo(w*.58,ground-9);c.lineTo(w*.72,ground-14);c.lineTo(w,ground-6);c.stroke();
    for(var rubble=0;rubble<38;rubble++){
      var rx=(rubble*79+13)%w, rsize=2+(rubble*7%6);
      var ry=ground-2-(rubble*13%11);
      c.save();c.translate(rx,ry);c.rotate((rubble%2?1:-1)*(rubble%5)*.23);
      c.fillStyle=rubble%4===0?'#6d28d9':(rubble%3===0?'#2e2140':'#171121');
      c.beginPath();c.moveTo(-rsize,0);c.lineTo(-rsize*.5,-rsize);c.lineTo(rsize*.4,-rsize*.65);c.lineTo(rsize,0);c.closePath();c.fill();c.restore();
    }
    c.globalAlpha=1;

    /* Living smoke columns, ember drift and violet arcs in the ruined district. */
    c.save(); c.globalCompositeOperation='lighter';
    for(var sm=0;sm<8;sm++){
      var sx=(sm*71+18)%w, smokeAge=(t*.16+sm*.137)%1;
      var sy=ground-8-smokeAge*(55+(sm%3)*18);
      var sr=3+smokeAge*12;
      c.globalAlpha=(isDomain?.12:.1)* (1-smokeAge*.5);
      var sg=c.createRadialGradient(sx,sy,1,sx,sy,sr);
      sg.addColorStop(0,'#c084fc');sg.addColorStop(1,'rgba(76,29,149,0)');
      c.fillStyle=sg;c.beginPath();c.arc(sx,sy,sr,0,Math.PI*2);c.fill();
    }
    for(var spark=0;spark<32;spark++){
      var px=(spark*37+t*(8+spark%5*5))%(w+12)-6;
      var py=ground-4-((spark*17+t*(13+spark%4*4))%(ground+12));
      c.globalAlpha=(.16+.32*(.5+.5*Math.sin(t*5+spark)))*(isDomain?1:progress);
      c.fillStyle=spark%3?'#a855f7':'#e9d5ff';
      c.beginPath();c.arc(px,py,spark%6===0?1.4:.7,0,Math.PI*2);c.fill();
    }
    c.restore();

    /* Perimeter of the domain, a rotating multi-ring seal and distant vertical rifts. */
    if(isDomain){
      c.save();c.globalCompositeOperation='lighter';
      c.globalAlpha=.18+.07*Math.sin(t*4);
      var dome=c.createRadialGradient(cx,ground-62,18,cx,ground-62,w*.72);
      dome.addColorStop(0,'rgba(147,51,234,.15)');dome.addColorStop(.6,'rgba(88,28,135,.16)');dome.addColorStop(1,'rgba(5,1,15,0)');
      c.fillStyle=dome;c.fillRect(0,0,w,ground);
      // Keep every seal inside the 480x270 play viewport instead of drawing rings beyond both edges.
      var domainOuterRx=Math.min(w*.46,w*.62);
      c.globalAlpha=.6;c.strokeStyle='#a855f7';c.lineWidth=1.2;
      c.beginPath();c.ellipse(cx,ground,domainOuterRx,34,0,Math.PI,Math.PI*2);c.stroke();
      c.setLineDash([7,5]);c.beginPath();c.ellipse(cx,ground-49,Math.min(w*.46,w*.54),105,t*.025,Math.PI,Math.PI*2);c.stroke();c.setLineDash([]);
      for(var ring=0;ring<3;ring++){
        var runeRx=Math.min(w*.46,w*(.28+ring*.14));
        c.save();c.translate(cx,ground-2);c.rotate(t*(ring%2?-.25:.19)*(ring+1));
        c.globalAlpha=.35;c.strokeStyle=ring===1?'#e9d5ff':'#7c3aed';c.lineWidth=ring===1?1:.7;
        c.setLineDash(ring===2?[3,7]:[12,4,2,4]);c.beginPath();c.ellipse(0,0,runeRx,12+ring*7,0,0,Math.PI*2);c.stroke();c.setLineDash([]);
        for(var rune=0;rune<18;rune++){
          var ra=rune*Math.PI*2/18;
          c.fillStyle=rune%2?'#c084fc':'#67e8f9';
          c.beginPath();c.moveTo(Math.cos(ra)*runeRx,Math.sin(ra)*(12+ring*7));
          c.lineTo(Math.cos(ra)*(runeRx+3),Math.sin(ra)*(16+ring*7));
          c.lineTo(Math.cos(ra)*(runeRx-3),Math.sin(ra)*(16+ring*7));c.closePath();c.fill();
        }
        c.restore();
      }
      c.globalAlpha=.86;c.textAlign='center';c.fillStyle='#e9d5ff';c.font='bold 8px monospace';c.shadowColor='#7e22ce';c.shadowBlur=9;
      c.fillText('SHADOW • ATOMIC DOMINION • '+Math.ceil(Math.max(0,(window.__cpShadowDomain.expiresAt-timeNow())/1000))+'s',cx,13);
      c.restore();
    }
    c.restore();
  }

  function drawAtomicCinematic(c) {
    var bc = burstCutscene;
    var p=1-clamp(bc.timer/Math.max(.01,bc.maxTimer),0,1);
    var w=V_WIDTH,h=V_HEIGHT,g=GROUND_Y,cx=w*.5,cy=g-60;
    var t=typeof gameTime==='number'?gameTime:0;
    var charge=smooth(p/.27), det=smooth((p-.23)/.23), decay=smooth((p-.48)/.52);
    c.save();
    // Draw the ultimate in viewport coordinates, not with any leftover world/camera transform.
    if (typeof c.setTransform === 'function') c.setTransform(1,0,0,1,0,0);
    c.beginPath(); c.rect(0,0,w,h); c.clip();
    c.globalCompositeOperation='source-over';
    var sky=c.createLinearGradient(0,0,0,h);
    sky.addColorStop(0,'#020107');sky.addColorStop(.44,'#10051e');sky.addColorStop(1,'#05030b');
    c.fillStyle=sky;c.fillRect(0,0,w,h);
    drawCityscape(c,p,false);

    /* Suspended-time charge: angular arcane glyphs spiral into an ultra-dense core. */
    c.save();c.globalCompositeOperation='lighter';
    var pulse=.5+.5*Math.sin(t*21);
    for(var orbit=0;orbit<5;orbit++){
      c.globalAlpha=(.16+charge*.38)*(1-det*.45);
      c.strokeStyle=orbit%2?'#a855f7':'#f5d0fe';c.lineWidth=orbit===0?2.2:.9;
      c.setLineDash(orbit%2?[3,7]:[9,4,2,5]);c.beginPath();
      c.ellipse(cx,cy,10+charge*(18+orbit*14),6+charge*(10+orbit*7),(orbit%2?-1:1)*t*(1+orbit*.18),0,Math.PI*2);c.stroke();c.setLineDash([]);
      for(var tick=0;tick<7;tick++){
        var a=t*(orbit%2?-1:1)*(1+orbit*.12)+tick*Math.PI*2/7;
        var rr=15+charge*(18+orbit*13);
        c.globalAlpha=(.2+.4*pulse)*(1-det*.55);
        c.strokeStyle=tick%2?'#c084fc':'#67e8f9';
        c.beginPath();c.moveTo(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr*.65);c.lineTo(cx+Math.cos(a)*(rr+6),cy+Math.sin(a)*(rr+6)*.65);c.stroke();
      }
    }
    var orbR=4+charge*39;
    var orb=c.createRadialGradient(cx,cy,1,cx,cy,orbR*3.8);
    orb.addColorStop(0,'#ffffff');orb.addColorStop(.1,'#f5d0fe');orb.addColorStop(.27,'#c084fc');orb.addColorStop(.53,'rgba(147,51,234,.52)');orb.addColorStop(1,'rgba(35,5,65,0)');
    c.globalAlpha=.38+.62*charge;c.fillStyle=orb;c.fillRect(cx-orbR*4,cy-orbR*4,orbR*8,orbR*8);
    /* Lightning filaments are deterministic and animated, not random flicker noise. */
    for(var bolt=0;bolt<16;bolt++){
      var ba=bolt*Math.PI*2/16+t*.37;
      var br=orbR*(1.3+(bolt%4)*.34);
      c.globalAlpha=(.12+.48*pulse)*charge*(1-det*.4);
      c.strokeStyle=bolt%3?'#a855f7':'#f5d0fe';c.lineWidth=bolt%4===0?2:0.8;
      c.beginPath();c.moveTo(cx+Math.cos(ba)*orbR*.6,cy+Math.sin(ba)*orbR*.6);
      for(var seg=1;seg<=4;seg++){
        var d=orbR*.6+(br-orbR*.6)*seg/4;
        var wig=Math.sin(t*17+bolt*4+seg*2)*4;
        c.lineTo(cx+Math.cos(ba)*d+wig,cy+Math.sin(ba)*d*.7-wig*.5);
      }c.stroke();
    }
    c.restore();

    /* Shadow's imposing silhouette and blade glint remain legible in the charge phase. */
    c.save();c.globalCompositeOperation='source-over';
    c.globalAlpha=1-det*.8;
    c.fillStyle='#030208';c.strokeStyle='#7e22ce';c.lineWidth=1.5;
    c.beginPath();c.moveTo(cx-12,cy-33);c.lineTo(cx-18,cy-48);c.lineTo(cx-7,cy-41);c.lineTo(cx,cy-51);c.lineTo(cx+7,cy-41);c.lineTo(cx+17,cy-47);c.lineTo(cx+12,cy-31);c.lineTo(cx+9,cy-16);c.lineTo(cx+18,g-9);c.lineTo(cx+7,g-15);c.lineTo(cx,g-7);c.lineTo(cx-7,g-15);c.lineTo(cx-18,g-8);c.lineTo(cx-10,cy-16);c.closePath();c.fill();c.stroke();
    c.strokeStyle='#c4b5fd';c.lineWidth=1.6;c.beginPath();c.moveTo(cx+8,cy-14);c.lineTo(cx+31,cy-39);c.stroke();
    c.strokeStyle='#67e8f9';c.lineWidth=1.8;c.shadowColor='#67e8f9';c.shadowBlur=12;
    c.beginPath();c.moveTo(cx-6,cy-29);c.lineTo(cx-1,cy-28);c.moveTo(cx+2,cy-28);c.lineTo(cx+7,cy-29);c.stroke();c.shadowBlur=0;
    c.restore();

    /* The detonation: multiple shock fronts, an expanding plasma shell and a towering cloud. */
    if(p>.22){
      c.save();c.globalCompositeOperation='lighter';
      var impact=clamp((p-.22)/.33,0,1);
      // The shock ring grows only within the viewport width; the previous max(w,h)*1.12
      // made it several screen-widths wide and looked like the Q escaped the screen.
      var ringRadius=8+impact*Math.min(w*.46,h*.78);
      for(var ring=0;ring<6;ring++){
        var rr=ringRadius*(1-ring*.105);
        c.globalAlpha=(.85-ring*.105)*(1-decay*.75);
        c.strokeStyle=ring%3===0?'#ffffff':(ring%2?'#e9d5ff':'#a855f7');
        c.lineWidth=ring===0?4.2:(ring===1?2.6:1.1);
        var ringRy=Math.min(12+ring*8+impact*15,Math.max(4,h-g-4));
        c.beginPath();c.ellipse(cx,g,rr,ringRy,0,0,Math.PI*2);c.stroke();
      }
      var cornerReach=Math.hypot(w/2,Math.max(cy,h-cy));
      var radius=18+impact*Math.max(0,cornerReach-18);
      var flash=c.createRadialGradient(cx,cy,1,cx,cy,radius);
      flash.addColorStop(0,'rgba(255,255,255,'+(.98*(1-decay*.96))+')');
      flash.addColorStop(.09,'rgba(250,232,255,'+(.98*(1-decay*.9))+')');
      flash.addColorStop(.22,'rgba(216,180,254,'+(.84*(1-decay*.75))+')');
      flash.addColorStop(.43,'rgba(147,51,234,'+(.75*(1-decay*.55))+')');
      flash.addColorStop(.71,'rgba(76,29,149,'+(.45*(1-decay*.3))+')');
      flash.addColorStop(1,'rgba(18,3,38,0)');
      c.fillStyle=flash;c.fillRect(0,0,w,h);

      /* Layered nuclear plume: stem, rolling cap, bright inner fire and vortex bands. */
      var plumeScale=.2+impact*1.18;
      c.save();c.translate(cx,cy-3);c.scale(plumeScale,plumeScale);
      var plume=c.createRadialGradient(0,-20,4,0,-20,57);
      plume.addColorStop(0,'#fff');plume.addColorStop(.22,'#f5d0fe');plume.addColorStop(.52,'#c084fc');plume.addColorStop(1,'rgba(109,40,217,0)');
      c.fillStyle=plume;c.globalAlpha=.95*(1-decay*.7);
      c.beginPath();c.moveTo(-8,55);c.bezierCurveTo(-10,36,-18,13,-30,-2);c.bezierCurveTo(-58,-14,-49,-43,-28,-43);c.bezierCurveTo(-28,-69,0,-75,8,-51);c.bezierCurveTo(34,-70,55,-42,37,-22);c.bezierCurveTo(61,-2,36,18,17,14);c.bezierCurveTo(10,30,11,44,10,55);c.closePath();c.fill();
      c.strokeStyle='#f5d0fe';c.lineWidth=2.2;c.beginPath();c.ellipse(0,-20,44,16,-.13,Math.PI*.06,Math.PI*1.85);c.stroke();
      c.strokeStyle='#ffffff';c.lineWidth=1;c.beginPath();c.ellipse(0,-26,31,8,.1,0,Math.PI*2);c.stroke();
      c.restore();

      /* Lightning crown arcs and rays rip through the entire frame. */
      for(var ray=0;ray<36;ray++){
        var a=ray*Math.PI*2/36+t*.07;
        var rayDx=Math.cos(a), rayDy=Math.sin(a)*.6;
        var reachX=rayDx>0?(w-8-cx)/rayDx:(rayDx<0?(8-cx)/rayDx:Infinity);
        var reachY=rayDy>0?(h-8-cy)/rayDy:(rayDy<0?(8-cy)/rayDy:Infinity);
        var maxRay=Math.max(0,Math.min(reachX,reachY));
        var len=Math.min(maxRay,35+impact*maxRay)*(ray%4===0?1:.56);
        c.globalAlpha=(.85*(ray%4===0?1:.54))*(1-decay*.92);
        c.strokeStyle=ray%4===0?'#ffffff':(ray%2?'#c084fc':'#e9d5ff');
        c.lineWidth=ray%6===0?2.8:1;
        c.beginPath();c.moveTo(cx+rayDx*8,cy+Math.sin(a)*5);
        c.lineTo(cx+rayDx*len*.56+Math.sin(t*15+ray)*4,cy+Math.sin(a)*len*.35);
        c.lineTo(cx+rayDx*len,cy+rayDy*len);c.stroke();
      }
      c.restore();
    }

    /* Debris, skyscraper panels and glowing concrete spin through the shockwave. */
    c.save();c.globalCompositeOperation='lighter';
    for(var d=0;d<58;d++){
      var frac=(p*(.8+(d%9)*.19)+d*.079)%1;
      var angle=d*2.399+t*(d%2?.22:-.18);
      var dist=8+frac*Math.min(w*.43,h*.72);
      var dx=clamp(cx+Math.cos(angle)*dist,4,w-4);
      var dy=clamp(cy+Math.sin(angle)*dist*.62+frac*frac*49,4,h-4);
      c.save();c.translate(dx,dy);c.rotate(t*(d%2?2.4:-1.8)+d);
      c.globalAlpha=(.7-frac*.35)*(p>.22?1:.35);
      c.fillStyle=d%5===0?'#f5d0fe':(d%3===0?'#7e22ce':'#20152e');
      c.strokeStyle=d%6===0?'#c084fc':'#3b2452';c.lineWidth=.7;
      c.beginPath();c.moveTo(-3,-2);c.lineTo(3,-1);c.lineTo(2,2);c.lineTo(-2,3);c.closePath();c.fill();c.stroke();
      c.restore();
    }
    c.restore();

    /* Post-blast silhouettes: broken towers, smoke and dust settle into the new domain. */
    if(p>.5){
      c.save();c.globalAlpha=.48*decay;
      var dust=c.createLinearGradient(0,g-65,0,g+5);
      dust.addColorStop(0,'rgba(124,58,237,0)');dust.addColorStop(.72,'rgba(76,29,149,.25)');dust.addColorStop(1,'rgba(10,5,18,.9)');
      c.fillStyle=dust;c.fillRect(0,g-70,w,80);
      for(var smoke=0;smoke<11;smoke++){
        var sx=(smoke*53+22)%w;
        var sy=g-18-((t*9+smoke*13)%52);
        var sr=4+((t*4+smoke*7)%9);
        c.fillStyle=smoke%3?'rgba(91,33,182,.24)':'rgba(192,132,252,.16)';
        c.beginPath();c.ellipse(sx+Math.sin(t+smoke)*4,sy,sr*1.5,sr,Math.sin(t+smoke),0,Math.PI*2);c.fill();
      }
      c.restore();
    }
    if(p>.32&&p<.47){
      c.save();c.globalAlpha=(1-Math.abs(p-.395)/.075)*.42;c.fillStyle='#f5d0fe';c.fillRect(0,0,w,h);c.restore();
    }

    c.save();c.textAlign='center';c.shadowColor='#a855f7';c.shadowBlur=16;
    c.fillStyle='#f5d0fe';c.font='900 17px monospace';c.fillText('I AM ATOMIC',cx,24);
    c.shadowBlur=0;c.fillStyle='#c4b5fd';c.font='bold 7px monospace';c.fillText('SHADOW • SSS+ ĐẶC BIỆT • CITY ERASURE',cx,36);
    c.restore();
    c.restore();
  }

  function drawShadowSkillFx(c) {
    var now=timeNow();
    for(var i=FX.length-1;i>=0;i--){
      var f=FX[i],age=(now-f.start)/1000,p=clamp(age/f.duration,0,1);
      if(p>=1){FX.splice(i,1);continue;}
      c.save();c.globalCompositeOperation='lighter';
      if(f.kind==='E'){
        var ease=smooth(p),x1=f.x1,x2=f.x2,midY=f.y;
        c.globalAlpha=.75*(1-p);
        var grad=c.createLinearGradient(x1,midY,x2,midY);
        grad.addColorStop(0,'rgba(124,58,237,0)');grad.addColorStop(.22,'#7c3aed');grad.addColorStop(.48,'#f5d0fe');grad.addColorStop(.75,'#a855f7');grad.addColorStop(1,'rgba(103,232,249,0)');
        c.strokeStyle=grad;c.lineWidth=18*(1-p)+2;c.beginPath();c.moveTo(x1,midY);c.bezierCurveTo(x1+(x2-x1)*.25,midY-28,x1+(x2-x1)*.7,midY+21,x2,midY);c.stroke();
        c.strokeStyle='#f5d0fe';c.lineWidth=1.5;
        for(var line=0;line<5;line++){
          var yy=midY+(line-2)*5;
          c.globalAlpha=(.66-line*.09)*(1-p);
          c.beginPath();c.moveTo(x1+(x2-x1)*p*.13,yy);c.lineTo(x1+(x2-x1)*p+Math.sin(p*16+line)*5,yy+(line%2?4:-4));c.stroke();
        }
        for(var trail=0;trail<4;trail++){
          var tx=x1+(x2-x1)*clamp(ease-trail*.16,0,1);
          var ty=midY+Math.sin(age*22+trail)*4;
          c.globalAlpha=(.62-trail*.12)*(1-p);
          c.strokeStyle=trail%2?'#a855f7':'#e9d5ff';c.lineWidth=trail===0?2.2:1;
          c.beginPath();c.moveTo(tx-7,ty-21);c.lineTo(tx+4,ty-9);c.lineTo(tx+1,ty+2);c.lineTo(tx-7,ty+8);c.stroke();
          c.beginPath();c.moveTo(tx-9,ty-17);c.lineTo(tx+10,ty-6);c.lineTo(tx+12,ty+3);c.stroke();
        }
        [x1,x2].forEach(function(xx,j){
          c.globalAlpha=.75*(1-p);c.strokeStyle=j?'#67e8f9':'#c084fc';c.lineWidth=1.4;
          c.beginPath();c.ellipse(xx,midY,13+age*12,7+age*5,(j?1:-1)*age*4,0,Math.PI*2);c.stroke();
          for(var n=0;n<7;n++){var a=n*Math.PI*2/7+age*5;c.beginPath();c.moveTo(xx+Math.cos(a)*15,midY+Math.sin(a)*8);c.lineTo(xx+Math.cos(a)*23,midY+Math.sin(a)*13);c.stroke();}
        });
      } else if(f.kind==='R'){
        var flight=smooth(p),ox=f.x,oy=f.y,dir=f.facing;
        /* A seven-blade shadow formation opens like a black-purple fan. */
        c.globalAlpha=.3*(1-p);c.strokeStyle='#a855f7';c.lineWidth=1;
        c.beginPath();c.ellipse(ox,oy,22+age*35,10+age*20,dir*age,0,Math.PI*2);c.stroke();
        for(var blade=0;blade<7;blade++){
          var spread=(blade-3)*12;
          var bx=ox+dir*(22+flight*(wSafe()-55));
          var by=oy+spread+Math.sin(flight*Math.PI)*(blade-3)*9;
          c.globalAlpha=(.95-blade*.045)*(1-p*.55);
          var bladeGrad=c.createLinearGradient(bx-dir*44,by,bx+dir*5,by);
          bladeGrad.addColorStop(0,'rgba(124,58,237,0)');bladeGrad.addColorStop(.65,blade%2?'#a855f7':'#e9d5ff');bladeGrad.addColorStop(1,'#ffffff');
          c.strokeStyle=bladeGrad;c.lineWidth=blade===3?4.3:2.5;
          c.beginPath();c.moveTo(bx-dir*48,by+3);c.lineTo(bx-dir*16,by);c.lineTo(bx+dir*5,by-1);c.stroke();
          c.strokeStyle=blade%2?'#c084fc':'#67e8f9';c.lineWidth=.8;
          c.beginPath();c.moveTo(bx-dir*37,by-4);c.lineTo(bx+dir*2,by-1);c.stroke();
          c.fillStyle='#f5d0fe';c.beginPath();c.moveTo(bx+dir*7,by);c.lineTo(bx-dir*5,by-4);c.lineTo(bx-dir*2,by+4);c.closePath();c.fill();
        }
        c.globalAlpha=.65*(1-p);c.strokeStyle='#e9d5ff';c.lineWidth=1.2;
        c.beginPath();c.moveTo(ox,oy);c.lineTo(ox+dir*100,oy-27);c.moveTo(ox,oy);c.lineTo(ox+dir*100,oy+27);c.stroke();
      } else if(f.kind==='ATOMIC'){
        drawAtomicChainFx(c,f,age,p);
      }
      c.restore();
    }
  }
  function wSafe(){return typeof V_WIDTH==='number'?V_WIDTH:480;}


  function triggerShadowAtomicWeapon() {
    if (gameState !== 'PLAYING') return true;
    var weaponRef = playerData && playerData.equipped ? playerData.equipped.weapon : null;
    var weapon = typeof getGearItem === 'function' ? getGearItem(weaponRef) : null;
    if (!weapon || weapon.id !== 'w_shadow_atomic') return false;
    if (!shadowSelected()) {
      showToast('Thần Khí Hắc Nguyệt chỉ cộng hưởng với Shadow.', '🔒');
      return true;
    }
    if (cdTimer.skillT > 0) {
      showToast('ATOMIC DOMINION đang hồi: ' + cdTimer.skillT.toFixed(1) + 's', '⏳');
      return true;
    }
    var targetBoss = typeof boss !== 'undefined' ? boss : null;
    if (!targetBoss || !targetBoss.alive) {
      showToast('Chưa có boss để khóa mục tiêu Atomic.', '☢️');
      return true;
    }

    var color = '#c084fc';
    var cdr = clamp((player.cdr || 0) / 100, 0, .75);
    cdTimer.skillT = 34 * (1 - cdr);
    sssBuffBaseAtk = player.baseAtk || player.atk;
    sssBuffAppliedAtkBoost = 1.6;
    sssBuffActiveTimer = 3.1;
    activeWeaponSkillMode = 'shadow_atomic';
    activeWeaponSkillColor = color;
    sssPassiveTickTimer = 0;
    if (typeof syncCombatAttack === 'function') syncCombatAttack();
    player.state = 'ATTACK'; player.animTimer = 0; player.animFrame = 2;
    player.isInvincible = true; player.invincibleTimer = Math.max(player.invincibleTimer || 0, 3.1);
    screenShake = Math.max(screenShake || 0, 10);
    screenFlash = Math.max(screenFlash || 0, .28);
    try { sfxBossSkill(6); } catch (_) { try { sfxDash(); } catch (_) {} }
    try {
      spawnMagicCircle(player.x, GROUND_Y, 78, color, 1.15, true);
      spawnMagicCircle(player.x, player.y - 25, 31, '#67e8f9', .9, false);
      spawnLightPillar(player.x, GROUND_Y, 51, color, .7);
      spawnParticles(player.x, player.y - 28, 30, color, 1.8);
      spawnDamageText(player.x, player.y - 55, 'ATOMIC DOMINION', color, true, 'THẦN KHÍ • NGŨ TRỌNG BÙNG NỔ');
    } catch (_) {}
    showToast('ATOMIC DOMINION: 5 vụ nổ • mỗi vụ 8% máu tối đa boss!', '☢️');

    /* Pin the target object to avoid redirecting delayed hits after a stage swap. */
    for (var hitIndex = 0; hitIndex < 5; hitIndex++) {
      (function (index) {
        setTimeout(function () {
          if (gameState !== 'PLAYING' || !shadowSelected() || boss !== targetBoss) return;
          var wasAlive = !!targetBoss.alive;
          var tx = Number(targetBoss.x) || V_WIDTH * .72;
          var ty = (Number(targetBoss.y) || GROUND_Y - 35) - 28;
          pushFx({kind:'ATOMIC', x:tx, y:ty, duration:.86, blastIndex:index + 1, total:5});
          screenShake = Math.max(screenShake || 0, 12 + index);
          screenFlash = Math.max(screenFlash || 0, index === 0 ? .44 : .28);
          try {
            spawnMagicCircle(tx, GROUND_Y, 76 + index * 5, index % 2 ? '#67e8f9' : color, .8, true);
            spawnLightPillar(tx, GROUND_Y, 65 + index * 8, color, .78);
            spawnParticles(tx, ty, 28, index % 2 ? '#67e8f9' : '#d8b4fe', 2);
            spawnDimensionCrack(tx - 48, ty - 18, tx + 52, ty - 7, '#f5d0fe', 3.2, .42);
            try { sfxBossSkill(index % 2 ? 6 : 7); } catch (_) {}
          } catch (_) {}
          if (wasAlive && targetBoss.alive) {
            var maxHp = Math.max(1, Number(targetBoss.maxHp) || Number(targetBoss.hp) || 1);
            var rawDamage = Math.max(1, Math.round(maxHp * .08));
            var safeDamage = Number.isFinite(Number(targetBoss.hp)) ? Math.min(rawDamage, Math.max(1, Number(targetBoss.hp))) : rawDamage;
            damageBoss(safeDamage, 'ATOMIC ' + (index + 1) + '/5 • 8% MAX HP', true, index % 2 ? '#67e8f9' : color);
          }
        }, index * 520);
      })(hitIndex);
    }
    return true;
  }

  function drawAtomicChainFx(c, f, age, progress) {
    var p = clamp(progress, 0, 1), fade = 1 - p;
    var radius = 14 + smooth(p) * 205;
    var pulse = .5 + .5 * Math.sin(age * 30 + f.blastIndex);
    c.save(); c.translate(f.x, f.y); c.globalCompositeOperation = 'lighter';
    var core = c.createRadialGradient(0, 0, 1, 0, 0, radius * .72);
    core.addColorStop(0, 'rgba(255,255,255,' + (.9 * fade) + ')');
    core.addColorStop(.16, 'rgba(245,208,254,' + (.82 * fade) + ')');
    core.addColorStop(.4, 'rgba(192,132,252,' + (.46 * fade) + ')');
    core.addColorStop(1, 'rgba(76,29,149,0)');
    c.globalAlpha = .8 * fade; c.fillStyle = core;
    c.beginPath(); c.arc(0, 0, radius * .72, 0, Math.PI * 2); c.fill();
    for (var ring = 0; ring < 5; ring++) {
      var rr = radius * (.35 + ring * .16);
      c.globalAlpha = (.9 - ring * .13) * fade;
      c.strokeStyle = ring % 3 === 0 ? '#ffffff' : (ring % 2 ? '#67e8f9' : '#c084fc');
      c.lineWidth = ring === 0 ? 3.3 : (ring === 1 ? 2.1 : 1);
      c.beginPath(); c.ellipse(0, 0, rr, rr * (.48 + ring * .035), age * (ring % 2 ? -.9 : .7), 0, Math.PI * 2); c.stroke();
    }
    for (var ray = 0; ray < 24; ray++) {
      var a = ray * Math.PI * 2 / 24 + age * (ray % 2 ? .7 : -.45);
      var len = radius * (ray % 4 === 0 ? 1.22 : .82) * (.88 + .12 * pulse);
      c.globalAlpha = (ray % 4 === 0 ? .92 : .48) * fade;
      c.strokeStyle = ray % 4 === 0 ? '#ffffff' : (ray % 2 ? '#d8b4fe' : '#67e8f9');
      c.lineWidth = ray % 6 === 0 ? 2 : .8;
      c.beginPath(); c.moveTo(Math.cos(a) * 5, Math.sin(a) * 3);
      c.lineTo(Math.cos(a) * len * .52, Math.sin(a) * len * .37 + Math.sin(age * 18 + ray) * 4);
      c.lineTo(Math.cos(a) * len, Math.sin(a) * len * .55); c.stroke();
    }
    c.globalAlpha = .72 * fade; c.strokeStyle = '#e9d5ff'; c.lineWidth = 1.4;
    c.beginPath(); c.arc(0, 0, 18 + (1 - p) * 28, age * 2, age * 2 + Math.PI * 1.6); c.stroke();
    c.globalAlpha = fade; c.fillStyle = '#f5d0fe'; c.font = '900 8px monospace'; c.textAlign = 'center';
    c.shadowColor = '#a855f7'; c.shadowBlur = 10;
    c.fillText('ATOMIC ' + f.blastIndex + '/5', 0, -Math.max(20, radius * .58));
    c.restore();
  }


  function triggerShadowAtomicQFixed() {
    if (gameState !== 'PLAYING' || cdTimer.skillQ > 0 || !shadowSelected()) return false;
    var domain = window.__cpShadowDomain;
    if (!domain) {
      domain = window.__cpShadowDomain = {
        active:false, expiresAt:0, buffActive:false, buffExpiresAt:0,
        baseAtk:null, baseSpeed:null, hadSpeed:false, startAt:0, timerId:0
      };
    }

    /* Cancel a previous cast cleanly so ATK/speed buffs never stack on rapid recasts. */
    if (domain.timerId) clearTimeout(domain.timerId);
    if (domain.expireTimerId) clearTimeout(domain.expireTimerId);
    if (window.__shadowAtomicTimer) clearTimeout(window.__shadowAtomicTimer);
    if ((domain.buffActive || domain.active) && typeof domain.restoreStats === 'function') {
      try { domain.restoreStats(); } catch (_) {}
    }
    domain.active = false;
    domain.expiresAt = 0;
    domain.buffActive = false;
    domain.buffExpiresAt = 0;

    var cdr = clamp((Number(player.cdr) || 0) / 100, 0, .8);
    cdTimer.skillQ = Math.max(1, COOLDOWNS.skillQ * (1 - cdr));
    domain.startAt = timeNow();
    domain.baseAtk = Number(player.atk) || 1;
    domain.hadSpeed = typeof player.attackSpeed === 'number' && isFinite(player.attackSpeed);
    domain.baseSpeed = domain.hadSpeed ? player.attackSpeed : 1;

    var token = ((window.__cpShadowQState && window.__cpShadowQState.token) || 0) + 1;
    window.__cpShadowQState = {token:token};
    var castTime = 2.85;
    // Persist the camera lock for the full Q duration even if another wrapper touches the cut-in state.
    window.__cpShadowQCameraLockUntil = performance.now() + castTime * 1000 + 200;
    burstCutscene = {
      active:true, timer:castTime, maxTimer:castTime,
      title:'I AM ATOMIC', sub:'SHADOW • SSS+ ĐẶC BIỆT • ATOMIC DOMINION',
      color:'#a855f7', charId:'char_shadow'
    };
    player.isInvincible = true;
    player.invincibleTimer = Math.max(player.invincibleTimer || 0, castTime);
    player.state = 'ATTACK';
    player.animTimer = 0;
    player.animFrame = 2;

    /* Keep the flash below the cinematic layer; the old .7-.9 white flash hid the Q animation. */
    screenShake = 0;
    screenFlash = Math.max(screenFlash || 0, .14);
    try { if (typeof sfxUltimateBoom === 'function') sfxUltimateBoom(); } catch (_) {}
    try { if (typeof sfxBossSkill === 'function') sfxBossSkill(30); } catch (_) {}
    try {
      // Ground circles are vertically squashed to .32 in drawMagicCircles; size them to the
      // real space below GROUND_Y so the lower arc cannot be cut off by the canvas edge.
      var qRingRadius = Math.max(8, Math.min(V_WIDTH*.40, (V_HEIGHT-GROUND_Y-4)/.32));
      spawnMagicCircle(V_WIDTH/2, GROUND_Y, qRingRadius, '#a855f7', 2.1, true);
      spawnMagicCircle(V_WIDTH/2, GROUND_Y, qRingRadius*.68, '#f5d0fe', 1.65, true);
      spawnLightPillar(V_WIDTH/2, GROUND_Y, Math.min(V_HEIGHT*.74, 200), '#7e22ce', 1.7);
      for (var r = 0; r < 20; r++) {
        var a = Math.PI * 2 * r / 20;
        var innerR = Math.min(V_WIDTH*.16, 72);
        var outerR = Math.min(V_WIDTH*.43, 205);
        var innerY = Math.min(V_HEIGHT*.045, 12);
        var outerY = Math.min(V_HEIGHT*.07, 19);
        spawnDimensionCrack(
          V_WIDTH/2 + Math.cos(a)*innerR, GROUND_Y + Math.sin(a)*innerY,
          V_WIDTH/2 + Math.cos(a)*outerR, GROUND_Y + Math.sin(a)*outerY,
          r%2 ? '#c084fc' : '#f5d0fe', 2.7, .72
        );
      }
      // Lower particle speed/count: the former high-speed burst scattered off the arena edges.
      spawnParticles(V_WIDTH/2, GROUND_Y-65, 64, '#a855f7', 1.0);
      spawnParticles(V_WIDTH/2, GROUND_Y-65, 32, '#f5d0fe', .62);
      showToast('I AM ATOMIC — VỤ NỔ NGUYÊN TỬ!', '影');
    } catch (_) {}

    var targetBoss = typeof boss !== 'undefined' ? boss : null;
    var targetList = Array.isArray(enemies) ? enemies.slice() : [];
    var attack = Math.max(1, Number(player.atk) || 1);
    var nukeDamage = Math.max(1, Math.round(attack * 35));

    targetList.forEach(function (enemy) {
      if (!enemy || !enemy.alive) return;
      try {
        enemy.stunTimer = Math.max(enemy.stunTimer || 0, 2.2);
        damageEnemy(enemy, nukeDamage, '#a855f7', '☢ I AM ATOMIC', true);
        var enemyFxX = clamp(Number(enemy.x) || V_WIDTH/2, 36, V_WIDTH-36);
        var enemyFxRadius = Math.max(12, Math.min(V_WIDTH*.18, enemyFxX-4, V_WIDTH-enemyFxX-4));
        spawnLightPillar(enemyFxX, GROUND_Y, Math.min(V_HEIGHT*.38, 96), '#c084fc', 1.0);
        spawnMagicCircle(enemyFxX, GROUND_Y, enemyFxRadius, '#7e22ce', .9, true);
      } catch (_) {}
    });

    /* Spawn all boss-side visuals before applying damage; damageBoss may end/advance the stage. */
    if (targetBoss && targetBoss.alive) {
      try {
        targetBoss.stunTimer = Math.max(targetBoss.stunTimer || 0, 2.5);
        var bossFxX = clamp(Number(targetBoss.x) || V_WIDTH/2, 36, V_WIDTH-36);
        var bossFxRadius = Math.max(12, Math.min(V_WIDTH*.20, bossFxX-4, V_WIDTH-bossFxX-4));
        spawnLightPillar(bossFxX, GROUND_Y, Math.min(V_HEIGHT*.48, 130), '#a855f7', 1.2);
        spawnMagicCircle(bossFxX, GROUND_Y, bossFxRadius, '#7e22ce', 1.0, true);
      } catch (_) {}
      try { damageBoss(nukeDamage * 2, '☢ I AM ATOMIC', true, '#c084fc'); } catch (_) {}
    }

    /* Start the domain after the cinematic. Token-guarding prevents stale timers from old casts. */
    domain.timerId = setTimeout(function () {
      var current = window.__cpShadowQState;
      if (!current || current.token !== token) return;
      if (gameState === 'DEFEAT' || gameState === 'START') return;
      domain.active = true;
      domain.expiresAt = timeNow() + 10000;
      domain.buffActive = true;
      domain.buffExpiresAt = domain.expiresAt;
      try { if (typeof applyPlayerStatsToCombat === 'function') applyPlayerStatsToCombat(); } catch (_) {}
      player.attackSpeed = (domain.hadSpeed ? domain.baseSpeed : 1) * 1.1;
      screenShake = Math.max(screenShake || 0, 12);
      showToast('LÃNH ĐỊA ATOMIC • ATK +50% • TỐC ĐÁNH +10% • 10 GIÂY', '☄️');
      domain.expireTimerId = setTimeout(function () {
        var state = window.__cpShadowQState;
        if (!state || state.token !== token) return;
        if (typeof domain.restoreStats === 'function') {
          try { domain.restoreStats(); } catch (_) { domain.active = false; domain.buffActive = false; }
        } else {
          domain.active = false;
          domain.buffActive = false;
          domain.buffExpiresAt = 0;
          try { if (typeof applyPlayerStatsToCombat === 'function') applyPlayerStatsToCombat(); } catch (_) {}
        }
        showToast('Lãnh địa Shadow đã tan biến.', '🌌');
      }, 10010);
    }, castTime * 1000);

    return true;
  }

  function install() {
    if(typeof CHARACTER_DATABASE==='undefined'||typeof playerData==='undefined'){
      setTimeout(install,50);return;
    }
    var sh=CHARACTER_DATABASE.find(function(c){return c.id==='char_shadow';});
    if(sh){
      sh.rankLabel='SSS+ ĐẶC BIỆT';
      sh.skillLabels={e:'E: SHADOW STEP — VOID WALK',r:'R: BLACK KNIGHT PARADE',q:'Q: I AM ATOMIC'};
      sh.desc='Shadow Emperor: Void Walk, Black Knight Parade và I AM ATOMIC — xóa sổ chiến trường, rồi mở lãnh địa thành phố đổ nát trong 10 giây.';
    }

    window.__cpShadowQFixed = triggerShadowAtomicQFixed;
    window.__cpActivateShadowAtomicWeapon = triggerShadowAtomicWeapon;

    var oldQ = window.triggerSkillQ;
    if (typeof oldQ === 'function' && !window.__cpShadowQFinalWrapped) {
      window.__cpShadowQFinalWrapped = true;
      window.triggerSkillQ = function () {
        if (!shadowSelected()) return oldQ.apply(this, arguments);
        return triggerShadowAtomicQFixed();
      };
    }

    var oldT=window.triggerSkillT;
    if(typeof oldT==='function'&&!window.__cpShadowAtomicWeaponWrapped){
      window.__cpShadowAtomicWeaponWrapped=true;
      window.triggerSkillT=function(){
        var weaponRef=typeof playerData!=='undefined'&&playerData.equipped?playerData.equipped.weapon:null;
        var weapon=typeof getGearItem==='function'?getGearItem(weaponRef):null;
        if(weapon&&weapon.id==='w_shadow_atomic'){
          var handled=triggerShadowAtomicWeapon();
          if(handled!==false)return;
        }
        return oldT.apply(this,arguments);
      };
    }

    var oldE=window.triggerSkillE;
    if(typeof oldE==='function'&&!window.__cpShadowEOverhaul){
      window.__cpShadowEOverhaul=true;
      window.triggerSkillE=function(){
        var isSh=shadowSelected(),ready=isSh&&typeof gameState!=='undefined'&&gameState==='PLAYING'&&cdTimer.skillE<=0;
        var x1=isSh?player.x:0,y=isSh?player.y-23:0,dir=isSh?player.facing:1;
        var result=oldE.apply(this,arguments);
        if(ready&&cdTimer.skillE>0){
          var x2=player.x;
          if(Math.abs(x2-x1)<15)x2=clamp(x1+dir*150,22,V_WIDTH-22);
          pushFx({kind:'E',x1:x1,x2:x2,y:y,duration:.82});
          player.state='ATTACK';player.animTimer=0;player.animFrame=2;
          player.isInvincible=true;player.invincibleTimer=Math.max(player.invincibleTimer||0,.3);
          try{sfxDash();}catch(_){}
          try{spawnMagicCircle(x1,GROUND_Y,46,'#7c3aed',.7,true);spawnMagicCircle(x2,GROUND_Y,72,'#a855f7',.95,true);}catch(_){}
          try{spawnLightPillar(x2,GROUND_Y,48,'#c084fc',.58);}catch(_){}
          try{for(var j=0;j<8;j++){var a=j*Math.PI/4;spawnParticles(x2+Math.cos(a)*15,player.y-20+Math.sin(a)*8,3,j%2?'#a855f7':'#e9d5ff',1.6);}}catch(_){}
        }
        return result;
      };
    }

    var oldR=window.triggerSkillR;
    if(typeof oldR==='function'&&!window.__cpShadowROverhaul){
      window.__cpShadowROverhaul=true;
      window.triggerSkillR=function(){
        var isSh=shadowSelected(),ready=isSh&&typeof gameState!=='undefined'&&gameState==='PLAYING'&&cdTimer.skillR<=0;
        var x=isSh?player.x:0,y=isSh?player.y-23:0,dir=isSh?player.facing:1;
        var result=oldR.apply(this,arguments);
        if(ready&&cdTimer.skillR>0){
          pushFx({kind:'R',x:x,y:y,facing:dir,duration:1.08});
          player.state='ATTACK';player.animTimer=0;player.animFrame=2;
          screenShake=Math.max(screenShake||0,9);
          screenFlash=Math.max(screenFlash||0,.28);
          try{sfxBossSkill(6);}catch(_){}
          try{
            for(var j=0;j<7;j++){
              var angle=(j-3)*.105;
              var speed=470+(3-Math.abs(j-3))*28;
              projectiles.push({
                x:x+dir*23,y:y+(j-3)*9,
                vx:dir*speed*Math.cos(angle),vy:speed*Math.sin(angle),
                facing:dir,radius:j===3?13:9,
                damage:Math.round(player.atk*(j===3?1.28:1.02)),
                hitList:new Set(),color:j%3===0?'#67e8f9':(j%2?'#c084fc':'#8b5cf6'),
                vfxType:'shadow_atomic',style:'shadow',life:1.55,stunDuration:.16
              });
            }
            for(var k=0;k<5;k++){
              var tx=x+dir*(42+k*37);
              spawnDimensionCrack(tx,y-31,tx+dir*21,y+5,k%2?'#c084fc':'#e9d5ff',2.1,.45);
            }
          }catch(_){}
        }
        return result;
      };
    }

    /* Replace the previous simpler cinematic with a full multi-phase city-erasure sequence. */
    var oldCut=window.drawBurstCutscene;
    if(typeof oldCut==='function'&&!window.__cpShadowCineWrapped){
      window.__cpShadowCineWrapped=true;
      window.drawBurstCutscene=function(c){
        if(typeof burstCutscene!=='undefined'&&burstCutscene.active&&burstCutscene.charId==='char_shadow'){
          drawAtomicCinematic(c);return;
        }
        return oldCut.apply(this,arguments);
      };
    }

    /* Draw the more intricate 10-second ruined city after the original domain background pass. */
    var oldBg=window.drawParallaxBackground;
    if(typeof oldBg==='function'&&!window.__cpShadowCityWrapped){
      window.__cpShadowCityWrapped=true;
      window.drawParallaxBackground=function(c){
        oldBg.apply(this,arguments);
        if(window.__cpShadowDomain&&window.__cpShadowDomain.active)drawCityscape(c,1,true);
      };
    }

    var oldParticles=window.drawParticles;
    if(typeof oldParticles==='function'&&!window.__cpShadowFxWrapped){
      window.__cpShadowFxWrapped=true;
      window.drawParticles=function(c){
        oldParticles.apply(this,arguments);
        drawShadowSkillFx(c);
      };
    }
    try{if(window.updateHubUI)window.updateHubUI();if(window.renderCharacterRoster)window.renderCharacterRoster();}catch(_){}
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();