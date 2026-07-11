
(() => {
'use strict';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

const ui = {
  score: document.getElementById('score'),
  balls: document.getElementById('balls'),
  combo: document.getElementById('combo'),
  high: document.getElementById('high'),
  status: document.getElementById('status'),
  message: document.getElementById('message'),
  leftTouch: document.getElementById('leftTouch'),
  rightTouch: document.getElementById('rightTouch'),
  launchTouch: document.getElementById('launchTouch')
};

const C = { cyan:'#36f3ff', blue:'#257cff', pink:'#ff357e', gold:'#ffd447', lime:'#72ff99', purple:'#9a74ff', white:'#eefcff' };
const STEP = 1 / 120;
const GRAVITY = 16;
const DRAG = 0.998;
const MAX_SPEED = 16;
const keys = {};

let last = performance.now();
let acc = 0;
let paused = false;
let tick = 0;

const state = {
  score:0,
  high:Number(localStorage.getItem('cyberArenaHigh') || 0),
  balls:3,
  combo:0,
  comboTimer:0,
  ready:true,
  charging:false,
  charge:0,
  gameOver:false,
  sparks:[]
};

const ball = { x:450, y:942, r:11, vx:0, vy:0, trail:[] };

/*
  Open-field version:
  No tunnel. No scripted handoff. The entire table is the playfield.
  Launch starts near the bottom center and goes straight into live gameplay.
*/
const walls = [
  [54,1018,54,175],
  [54,175,150,70],
  [150,70,750,70],
  [750,70,846,175],
  [846,175,846,1018],

  [105,350,122,200],
  [122,200,205,135],
  [795,350,778,200],
  [778,200,695,135],

  [88,560,120,430],
  [120,430,178,382],
  [812,560,780,430],
  [780,430,722,382],

  [54,690,170,790],
  [170,790,255,875],
  [846,690,730,790],
  [730,790,645,875],

  [255,875,298,910],
  [645,875,602,910],

  [54,1018,250,1018],
  [650,1018,846,1018]
];

const bumpers = [
  {x:315,y:250,r:42,points:250,color:C.pink,label:'250',pulse:0},
  {x:585,y:250,r:42,points:250,color:C.pink,label:'250',pulse:0},
  {x:450,y:390,r:54,points:500,color:C.gold,label:'500',pulse:0},
  {x:310,y:535,r:36,points:150,color:C.cyan,label:'150',pulse:0},
  {x:590,y:535,r:36,points:150,color:C.lime,label:'150',pulse:0}
];

const posts = [
  {x:190,y:760,r:13},{x:710,y:760,r:13},
  {x:275,y:680,r:10},{x:625,y:680,r:10},
  {x:362,y:610,r:9},{x:538,y:610,r:9}
];

const targets = [
  {x:118,y:498,w:17,h:58,on:false,cool:0},
  {x:145,y:540,w:17,h:58,on:false,cool:0},
  {x:765,y:498,w:17,h:58,on:false,cool:0},
  {x:738,y:540,w:17,h:58,on:false,cool:0},
  {x:370,y:700,w:58,h:16,on:false,cool:0},
  {x:472,y:700,w:58,h:16,on:false,cool:0}
];

const lanes = [
  {x:330,y1:90,y2:160,on:false},
  {x:390,y1:82,y2:155,on:false},
  {x:450,y1:90,y2:160,on:false},
  {x:510,y1:82,y2:155,on:false},
  {x:570,y1:90,y2:160,on:false}
];

const flippers = [
  {px:295,py:930,len:118,w:23,rest:.24,active:-.62,a:.24,on:false},
  {px:605,py:930,len:118,w:23,rest:Math.PI-.24,active:Math.PI+.62,a:Math.PI-.24,on:false}
];

const slings = [
  {a:[170,700],b:[255,835],c:[168,825],points:80},
  {a:[730,700],b:[645,835],c:[732,825],points:80}
];

function clamp(v,a,b){ return Math.max(a, Math.min(b,v)); }

function limitSpeed(max=MAX_SPEED){
  const s = Math.hypot(ball.vx, ball.vy);
  if(s > max){
    ball.vx *= max / s;
    ball.vy *= max / s;
  }
}

function setStatus(a,b){
  if(ui.status) ui.status.textContent = a;
  if(ui.message) ui.message.textContent = b;
}

function updateUI(){
  const pad = n => Math.floor(n).toString().padStart(7,'0');
  ui.score.textContent = pad(state.score);
  ui.balls.textContent = String(state.balls);
  ui.combo.textContent = String(state.combo);
  ui.high.textContent = pad(state.high);
}

function addScore(n){
  const gain = Math.round(n * (1 + Math.min(state.combo,8)*0.12));
  state.score += gain;
  state.combo++;
  state.comboTimer = 2;
  if(state.score > state.high){
    state.high = state.score;
    localStorage.setItem('cyberArenaHigh', String(state.high));
  }
  updateUI();
}

function resetBall(){
  ball.x = 450;
  ball.y = 942;
  ball.vx = 0;
  ball.vy = 0;
  ball.trail.length = 0;
  state.ready = true;
  state.charging = false;
  state.charge = 0;
  setStatus('READY','Hold SPACE to charge. Release to launch.');
}

function restart(){
  state.score = 0;
  state.balls = 3;
  state.combo = 0;
  state.comboTimer = 0;
  state.gameOver = false;
  resetBall();
  updateUI();
}

function launch(){
  if(!state.ready || state.gameOver) return;
  const power = 12 + state.charge * 8;
  const spread = (Math.random() - 0.5) * 4.2;
  ball.vx = spread;
  ball.vy = -power;
  state.ready = false;
  state.charging = false;
  state.charge = 0;
  setStatus('LIVE','Ball is in the open playfield.');
}

function emit(x,y,color,count=8,speed=4){
  for(let i=0;i<count;i++){
    const a = Math.random()*Math.PI*2;
    const s = Math.random()*speed;
    state.sparks.push({ x,y, vx:Math.cos(a)*s, vy:Math.sin(a)*s, life:1, color });
  }
}

function segmentCollision(x1,y1,x2,y2,width=8,bounce=.72,onHit){
  const dx=x2-x1, dy=y2-y1;
  const l2=dx*dx+dy*dy;
  const t=clamp(((ball.x-x1)*dx+(ball.y-y1)*dy)/l2,0,1);
  const px=x1+t*dx, py=y1+t*dy;
  const bx=ball.x-px, by=ball.y-py;
  const d=Math.hypot(bx,by);
  const min=ball.r+width;
  if(d >= min || d === 0) return false;
  const nx=bx/d, ny=by/d;
  ball.x = px + nx*min;
  ball.y = py + ny*min;
  const dot = ball.vx*nx + ball.vy*ny;
  if(dot < 0){
    ball.vx -= (1+bounce)*dot*nx;
    ball.vy -= (1+bounce)*dot*ny;
    ball.vx *= .99;
    ball.vy *= .99;
    limitSpeed();
    if(onHit) onHit(nx,ny);
  }
  return true;
}

function circleCollision(o,bounce=1.35,onHit){
  const dx=ball.x-o.x, dy=ball.y-o.y;
  const d=Math.hypot(dx,dy);
  const min=ball.r+o.r;
  if(d >= min || d === 0) return false;
  const nx=dx/d, ny=dy/d;
  ball.x = o.x + nx*min;
  ball.y = o.y + ny*min;
  const dot = ball.vx*nx + ball.vy*ny;
  if(dot < 0){
    ball.vx -= (1+bounce)*dot*nx;
    ball.vy -= (1+bounce)*dot*ny;
    ball.vx *= .99;
    ball.vy *= .99;
    limitSpeed();
    if(onHit) onHit(nx,ny);
  }
  return true;
}

function rectCollision(t){
  if(t.cool > 0) return;
  if(ball.x+ball.r<t.x || ball.x-ball.r>t.x+t.w || ball.y+ball.r<t.y || ball.y-ball.r>t.y+t.h) return;
  const cx=t.x+t.w/2, cy=t.y+t.h/2;
  const dx=ball.x-cx, dy=ball.y-cy;
  if(Math.abs(dx) > Math.abs(dy)){
    const side = dx < 0 ? -1 : 1;
    ball.x = cx + side*(t.w/2 + ball.r + 1);
    ball.vx = side * Math.max(3.5, Math.abs(ball.vx)*.75);
  }else{
    const side = dy < 0 ? -1 : 1;
    ball.y = cy + side*(t.h/2 + ball.r + 1);
    ball.vy = side * Math.max(3.5, Math.abs(ball.vy)*.75);
  }
  limitSpeed();
  t.cool = .2;
  t.on = true;
  addScore(300);
  emit(cx,cy,C.pink,8,4);
  setTimeout(()=>t.on=false,180);
}

function flipperCollision(f){
  const ex=f.px+Math.cos(f.a)*f.len;
  const ey=f.py+Math.sin(f.a)*f.len;
  segmentCollision(f.px,f.py,ex,ey,f.w/2,1.05,(nx)=>{
    if(f.on){
      ball.vy -= 8.8;
      ball.vx += nx*3.6;
      limitSpeed(17);
      addScore(20);
      emit(ball.x,ball.y,C.pink,5,3);
    }
  });
}

function update(dt){
  if(paused) return;

  if(state.comboTimer > 0){
    state.comboTimer -= dt;
    if(state.comboTimer <= 0){
      state.combo = 0;
      updateUI();
    }
  }

  flippers[0].on = !!(keys.ArrowLeft || keys.KeyA);
  flippers[1].on = !!(keys.ArrowRight || keys.KeyD);
  flippers.forEach(f=>{
    const target = f.on ? f.active : f.rest;
    f.a += (target - f.a) * Math.min(1, dt*32);
  });

  if(state.charging && state.ready){
    state.charge = Math.min(1, state.charge + dt*.72);
  }

  if(!state.ready && !state.gameOver){
    ball.vy += GRAVITY*dt;
    ball.vx *= Math.pow(DRAG,dt*120);
    ball.vy *= Math.pow(DRAG,dt*120);
    limitSpeed();

    const travel = Math.hypot(ball.vx,ball.vy);
    const steps = Math.max(1, Math.ceil(travel/2.2));
    for(let i=0;i<steps;i++){
      ball.x += ball.vx/steps;
      ball.y += ball.vy/steps;

      walls.forEach(w=>segmentCollision(...w,9,.68));

      if(ball.x-ball.r < 54){
        ball.x = 54 + ball.r;
        ball.vx = Math.abs(ball.vx)*.65;
      }
      if(ball.x+ball.r > 846){
        ball.x = 846 - ball.r;
        ball.vx = -Math.abs(ball.vx)*.65;
      }
      if(ball.y-ball.r < 70){
        ball.y = 70 + ball.r;
        ball.vy = Math.abs(ball.vy)*.65;
      }
      limitSpeed();
    }

    bumpers.forEach(b=>{
      circleCollision(b,1.25,(nx,ny)=>{
        const speed = clamp(Math.hypot(ball.vx,ball.vy)+1.4,6,10.5);
        ball.vx = nx*speed;
        ball.vy = ny*speed;
        b.pulse = 1;
        addScore(b.points);
        emit(b.x,b.y,b.color,12,5);
      });
      b.pulse = Math.max(0,b.pulse-dt*4);
    });

    posts.forEach(p=>circleCollision(p,1.1,()=>addScore(25)));

    targets.forEach(t=>{
      t.cool = Math.max(0,t.cool-dt);
      rectCollision(t);
    });

    lanes.forEach(l=>{
      segmentCollision(l.x,l.y1,l.x,l.y2,5,.4);
      if(!l.on && Math.abs(ball.x-l.x)<15 && ball.y>l.y1 && ball.y<l.y2){
        l.on = true;
        addScore(200);
        emit(l.x,(l.y1+l.y2)/2,C.white,6,3);
      }
      if(ball.y > l.y2+40) l.on = false;
    });

    slings.forEach(s=>{
      segmentCollision(...s.a,...s.b,9,1.02,()=>{
        ball.vy -= 3.8;
        limitSpeed(16);
        addScore(s.points);
        emit(ball.x,ball.y,C.pink,7,4);
      });
      segmentCollision(...s.b,...s.c,9,.78);
      segmentCollision(...s.c,...s.a,9,.78);
    });

    flippers.forEach(flipperCollision);
    limitSpeed();
    if(Math.abs(ball.vx)<.12) ball.vx=0;

    ball.trail.unshift({x:ball.x,y:ball.y});
    if(ball.trail.length>12) ball.trail.pop();

    if(!Number.isFinite(ball.x) || !Number.isFinite(ball.y) || !Number.isFinite(ball.vx) || !Number.isFinite(ball.vy)){
      resetBall();
      setStatus('RESET','Physics safety reset.');
      return;
    }

    if(ball.y > H+40){
      state.balls--;
      updateUI();
      if(state.balls <= 0){
        state.gameOver = true;
        setStatus('GAME OVER','Press R to restart.');
      }else{
        resetBall();
      }
    }
  }

  updateParticles(dt);
}

function updateParticles(dt){
  for(const p of state.sparks){
    p.x += p.vx;
    p.y += p.vy;
    p.vy += .12;
    p.vx *= .98;
    p.vy *= .98;
    p.life -= dt*2.2;
  }
  state.sparks = state.sparks.filter(p=>p.life>0);
}

function neonLine(x1,y1,x2,y2,color,width=8){
  ctx.save();
  ctx.lineCap='round';
  ctx.strokeStyle=color;
  ctx.shadowColor=color;
  ctx.shadowBlur=15;
  ctx.lineWidth=width;
  ctx.beginPath();
  ctx.moveTo(x1,y1);
  ctx.lineTo(x2,y2);
  ctx.stroke();
  ctx.shadowBlur=0;
  ctx.strokeStyle='rgba(255,255,255,.55)';
  ctx.lineWidth=Math.max(1,width*.18);
  ctx.stroke();
  ctx.restore();
}

function drawBackground(){
  const g=ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#081329');
  g.addColorStop(.55,'#062d4d');
  g.addColorStop(1,'#061020');
  ctx.fillStyle=g;
  ctx.fillRect(0,0,W,H);
  ctx.save();
  ctx.globalAlpha=.18;
  ctx.strokeStyle=C.cyan;
  ctx.lineWidth=1;
  for(let i=0;i<18;i++){
    ctx.beginPath();
    ctx.moveTo(60+i*45,180);
    ctx.lineTo(35+i*48,940);
    ctx.stroke();
  }
  ctx.globalAlpha=.25;
  for(let i=0;i<48;i++){
    const y=(i*79+tick*.2)%900+90;
    const x=(i*137)%850+25;
    ctx.fillStyle=i%3?C.cyan:C.pink;
    ctx.fillRect(x,y,2,2);
  }
  ctx.restore();
}

function drawShell(){
  ctx.save();
  ctx.lineJoin='round';
  ctx.strokeStyle='#15233d';
  ctx.lineWidth=26;
  ctx.beginPath();
  ctx.moveTo(54,1018);
  ctx.lineTo(54,175);
  ctx.lineTo(150,70);
  ctx.lineTo(750,70);
  ctx.lineTo(846,175);
  ctx.lineTo(846,1018);
  ctx.stroke();
  ctx.strokeStyle=C.cyan;
  ctx.shadowColor=C.cyan;
  ctx.shadowBlur=18;
  ctx.lineWidth=7;
  ctx.stroke();
  ctx.restore();

  walls.slice(5).forEach((w,i)=>{
    const color=i<8?C.blue:(i<14?C.cyan:C.gold);
    neonLine(w[0],w[1],w[2],w[3],color,i<8?9:7);
  });
}

function drawLanes(){
  lanes.forEach((l,i)=>{
    neonLine(l.x,l.y1,l.x,l.y2,l.on?C.gold:C.white,8);
    ctx.fillStyle=l.on?C.gold:'#8190ad';
    ctx.font='800 13px monospace';
    ctx.textAlign='center';
    ctx.fillText(String(i+1),l.x,l.y2+20);
  });
}

function drawBumpers(){
  bumpers.forEach(b=>{
    const r=b.r+b.pulse*7+Math.sin(tick*.045+b.x)*1.2;
    ctx.save();
    ctx.fillStyle='rgba(4,8,18,.92)';
    ctx.shadowColor=b.color;
    ctx.shadowBlur=24+b.pulse*18;
    ctx.beginPath();
    ctx.arc(b.x,b.y,r,0,Math.PI*2);
    ctx.fill();
    ctx.lineWidth=9;
    ctx.strokeStyle=b.color;
    ctx.stroke();
    ctx.lineWidth=2;
    ctx.strokeStyle='white';
    ctx.stroke();
    ctx.fillStyle=b.color;
    ctx.font='900 18px monospace';
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.fillText(b.label,b.x,b.y);
    ctx.restore();
  });
}

function drawTargets(){
  targets.forEach(t=>{
    ctx.save();
    ctx.fillStyle=t.on?C.white:C.pink;
    ctx.shadowColor=ctx.fillStyle;
    ctx.shadowBlur=t.on?24:10;
    ctx.fillRect(t.x,t.y,t.w,t.h);
    ctx.restore();
  });
}

function drawPosts(){
  posts.forEach(p=>{
    ctx.save();
    ctx.fillStyle='#eaffff';
    ctx.shadowColor=C.cyan;
    ctx.shadowBlur=15;
    ctx.beginPath();
    ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
    ctx.fill();
    ctx.fillStyle='#17253b';
    ctx.beginPath();
    ctx.arc(p.x,p.y,p.r*.48,0,Math.PI*2);
    ctx.fill();
    ctx.restore();
  });
}

function drawSlings(){
  slings.forEach(s=>{
    ctx.save();
    ctx.fillStyle='rgba(31,80,150,.55)';
    ctx.strokeStyle=C.pink;
    ctx.shadowColor=C.pink;
    ctx.shadowBlur=14;
    ctx.lineWidth=6;
    ctx.beginPath();
    ctx.moveTo(...s.a);
    ctx.lineTo(...s.b);
    ctx.lineTo(...s.c);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  });
}

function drawFlippers(){
  flippers.forEach(f=>{
    const ex=f.px+Math.cos(f.a)*f.len;
    const ey=f.py+Math.sin(f.a)*f.len;
    ctx.save();
    ctx.lineCap='round';
    ctx.strokeStyle='#2a1020';
    ctx.lineWidth=f.w+14;
    ctx.beginPath();
    ctx.moveTo(f.px,f.py);
    ctx.lineTo(ex,ey);
    ctx.stroke();
    neonLine(f.px,f.py,ex,ey,C.pink,f.w);
    ctx.fillStyle=C.white;
    ctx.shadowColor=C.white;
    ctx.shadowBlur=10;
    ctx.beginPath();
    ctx.arc(f.px,f.py,9,0,Math.PI*2);
    ctx.fill();
    ctx.restore();
  });
}

function drawBall(){
  ball.trail.forEach((p,i)=>{
    ctx.fillStyle=`rgba(54,243,255,${.14*(1-i/ball.trail.length)})`;
    ctx.beginPath();
    ctx.arc(p.x,p.y,ball.r*(1-i/ball.trail.length),0,Math.PI*2);
    ctx.fill();
  });
  const g=ctx.createRadialGradient(ball.x-4,ball.y-5,2,ball.x,ball.y,ball.r);
  g.addColorStop(0,'white');
  g.addColorStop(.35,'#e4faff');
  g.addColorStop(1,'#44708c');
  ctx.save();
  ctx.fillStyle=g;
  ctx.shadowColor='white';
  ctx.shadowBlur=18;
  ctx.beginPath();
  ctx.arc(ball.x,ball.y,ball.r,0,Math.PI*2);
  ctx.fill();
  ctx.restore();
}

function drawLauncher(){
  if(!state.ready) return;
  ctx.save();
  ctx.strokeStyle='#263c55';
  ctx.lineWidth=3;
  ctx.strokeRect(405,960,90,22);
  const w=state.charge*86;
  const g=ctx.createLinearGradient(405,0,495,0);
  g.addColorStop(0,C.lime);
  g.addColorStop(.6,C.gold);
  g.addColorStop(1,C.pink);
  ctx.fillStyle=g;
  ctx.fillRect(407,962,w,18);
  ctx.fillStyle=C.gold;
  ctx.font='800 14px monospace';
  ctx.textAlign='center';
  ctx.fillText('LAUNCH',450,1005);
  ctx.restore();
}

function drawHUD(){
  ctx.save();
  ctx.textAlign='center';
  ctx.fillStyle=C.cyan;
  ctx.shadowColor=C.cyan;
  ctx.shadowBlur=12;
  ctx.font='900 34px system-ui';
  ctx.fillText('CYBER PINBALL ARENA',450,122);
  if(state.ready && !state.gameOver){
    ctx.shadowBlur=0;
    ctx.fillStyle=C.gold;
    ctx.font='900 17px system-ui';
    ctx.fillText(state.charging ? 'RELEASE SPACE TO LAUNCH' : 'HOLD SPACE TO CHARGE',450,1062);
  }
  if(paused || state.gameOver){
    ctx.fillStyle='rgba(0,3,10,.78)';
    ctx.fillRect(0,0,W,H);
    ctx.fillStyle=state.gameOver?C.pink:C.cyan;
    ctx.shadowColor=ctx.fillStyle;
    ctx.shadowBlur=24;
    ctx.font='900 58px system-ui';
    ctx.fillText(state.gameOver?'GAME OVER':'PAUSED',W/2,H/2-20);
    ctx.shadowBlur=0;
    ctx.fillStyle='white';
    ctx.font='700 22px monospace';
    ctx.fillText(state.gameOver?'PRESS R TO RESTART':'PRESS P TO RESUME',W/2,H/2+35);
  }
  ctx.restore();
}

function draw(){
  tick++;
  drawBackground();
  drawShell();
  drawLanes();
  drawTargets();
  drawBumpers();
  drawSlings();
  drawPosts();
  drawFlippers();
  drawLauncher();
  drawBall();
  for(const p of state.sparks){
    ctx.globalAlpha=Math.max(0,p.life);
    ctx.fillStyle=p.color;
    ctx.fillRect(p.x,p.y,3,3);
  }
  ctx.globalAlpha=1;
  drawHUD();
}

function frame(now){
  const elapsed=Math.min(.05,(now-last)/1000);
  last=now;
  acc+=elapsed;
  while(acc>=STEP){
    update(STEP);
    acc-=STEP;
  }
  draw();
  requestAnimationFrame(frame);
}

window.addEventListener('keydown',e=>{
  if(['Space','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
  keys[e.code]=true;
  if(e.code==='Space' && state.ready && !state.charging){
    state.charging=true;
    state.charge=.05;
  }
  if(e.code==='KeyR') restart();
  if(e.code==='KeyP'){
    paused=!paused;
    setStatus(paused?'PAUSED':'LIVE',paused?'Press P to resume.':'Game resumed.');
  }
});

window.addEventListener('keyup',e=>{
  keys[e.code]=false;
  if(e.code==='Space' && state.charging) launch();
});

function holdButton(el,code){
  if(!el) return;
  const down=e=>{ e.preventDefault(); keys[code]=true; };
  const up=e=>{ e.preventDefault(); keys[code]=false; };
  el.addEventListener('pointerdown',down);
  el.addEventListener('pointerup',up);
  el.addEventListener('pointercancel',up);
  el.addEventListener('pointerleave',up);
}

holdButton(ui.leftTouch,'ArrowLeft');
holdButton(ui.rightTouch,'ArrowRight');

if(ui.launchTouch){
  ui.launchTouch.addEventListener('pointerdown',e=>{
    e.preventDefault();
    if(state.ready && !state.charging){
      state.charging=true;
      state.charge=.05;
    }
  });
  ui.launchTouch.addEventListener('pointerup',e=>{
    e.preventDefault();
    if(state.charging) launch();
  });
}

window.__pinballDebug = {
  launch:()=>{ if(state.ready){ state.charge=1; launch(); } },
  get:()=>({ x:ball.x,y:ball.y,vx:ball.vx,vy:ball.vy,ready:state.ready,balls:state.balls,score:state.score })
};

updateUI();
resetBall();
requestAnimationFrame(frame);
})();
