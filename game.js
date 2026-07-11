(() => {
"use strict";

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const W = canvas.width;
const H = canvas.height;

const ui = {
  score: document.querySelector("#score"),
  ball: document.querySelector("#ballCount"),
  multi: document.querySelector("#multiplier"),
  high: document.querySelector("#highScore"),
  missionName: document.querySelector("#missionName"),
  missionText: document.querySelector("#missionText"),
  progress: document.querySelector("#missionProgress"),
  log: document.querySelector("#messageLog"),
  pause: document.querySelector("#pauseButton"),
  restart: document.querySelector("#restartButton"),
  leftTouch: document.querySelector("#leftTouch"),
  rightTouch: document.querySelector("#rightTouch"),
  launchTouch: document.querySelector("#launchTouch")
};

const C = {
  cyan:"#35f1ff", blue:"#2176ff", pink:"#ff357e",
  lime:"#72ff99", gold:"#ffd447", purple:"#9a74ff",
  white:"#eefcff", dark:"#050a18"
};

const keys = Object.create(null);
let last = performance.now();
let accumulator = 0;
const STEP = 1 / 120;
const GRAVITY = 12;
const AIR_DRAG = 0.9985;
const MAX_BALL_SPEED = 10;
const MIN_ROLL_SPEED = 0.15;
let paused = false;
let audio;
let shooterTransferred = false;

const state = {
  score:0,
  high:Number(localStorage.getItem("cyborgPinballHigh") || 0),
  balls:3,
  multiplier:1,
  combo:0,
  comboTimer:0,
  launchCharge:0,
  charging:false,
  ready:true,
  gameOver:false,
  flash:0,
  shake:0,
  message:"SYSTEM ONLINE",
  subMessage:"HOLD SPACE TO CHARGE",
  particles:[],
  sparks:[],
  missionIndex:0,
  missionProgress:0,
  missionCompleteTimer:0
};

const missions = [
  {name:"BOOT SEQUENCE", text:"Activate all five data gates.", goal:5, type:"gate", reward:2500},
  {name:"REACTOR ONLINE", text:"Strike the reactor core six times.", goal:6, type:"reactor", reward:5000},
  {name:"ORBITAL LINK", text:"Complete four upper orbits.", goal:4, type:"orbit", reward:7500},
  {name:"FIREWALL BREACH", text:"Hit eight cyber targets.", goal:8, type:"target", reward:10000}
];

const ball = {x:800,y:965,r:11,vx:0,vy:0,trail:[]};

const bumpers = [
  {x:300,y:235,r:44,points:250,color:C.pink,label:"250",pulse:0},
  {x:545,y:235,r:44,points:250,color:C.pink,label:"250",pulse:0},
  {x:425,y:375,r:54,points:500,color:C.gold,label:"500",pulse:0},
  {x:280,y:510,r:37,points:150,color:C.cyan,label:"150",pulse:0},
  {x:570,y:510,r:37,points:150,color:C.lime,label:"150",pulse:0}
];

const rollovers = [
  {x:320,y1:84,y2:156,on:false},
  {x:372,y1:72,y2:150,on:false},
  {x:425,y1:80,y2:156,on:false},
  {x:478,y1:72,y2:150,on:false},
  {x:530,y1:84,y2:156,on:false}
];

const targets = [
  {x:116,y:500,w:17,h:54,on:false},
  {x:141,y:535,w:17,h:54,on:false},
  {x:650,y:500,w:17,h:54,on:false},
  {x:625,y:535,w:17,h:54,on:false},
  {x:210,y:630,w:48,h:14,on:false},
  {x:593,y:630,w:48,h:14,on:false}
];

const posts = [
  {x:205,y:735,r:14},{x:645,y:735,r:14},
  {x:272,y:672,r:10},{x:578,y:672,r:10},
  {x:340,y:590,r:9},{x:510,y:590,r:9}
];

const flippers = [
  {px:275,py:930,len:108,width:22,rest:.24,active:-.60,angle:.24,pressed:false},
  {px:575,py:930,len:108,width:22,rest:Math.PI-.24,active:Math.PI+.60,angle:Math.PI-.24,pressed:false}
];

const walls = [
  // Main cabinet shell
  [44,1010,44,170],
  [44,170,145,62],
  [145,62,665,62],
  [665,62,820,150],
  [820,150,820,1010],

  // Left orbit guides
  [72,350,86,190],
  [86,190,160,115],
  [116,380,124,245],
  [124,245,188,178],

  // Right-side guides kept away from the shooter exit
  [610,200,665,255],
  [665,255,680,360],

  // Mid-table returns
  [70,570,92,430],
  [92,430,145,380],
  [690,570,668,450],
  [668,450,625,405],

  // Smooth lower funnels
  [44,690,155,770],
  [155,770,220,850],
  [760,690,650,770],
  [650,770,585,850],

  // Inlanes
  [220,850,255,895],
  [585,850,550,895],

  // Outlanes
  [82,735,145,840],
  [722,735,660,840],

  // Wide center drain
  [44,1010,225,1010],
  [615,1010,820,1010]
];

// No triangle slingshots or closed trap pockets.
const slings = [];

const orbitSensors = [
  {x:110,y:205,w:45,h:90,armed:true},
  {x:625,y:205,w:45,h:90,armed:true}
];

const reactor = {x:425,y:650,r:67,pulse:0,hits:0};

function resetBall() {
  ball.x = 800;
  ball.y = 965;
  ball.vx = 0;
  ball.vy = 0;
  ball.trail.length = 0;
  state.ready = true;
  state.charging = false;
  state.launchCharge = 0;
  shooterTransferred = false;
  state.combo = 0;
  state.comboTimer = 0;
  rollovers.forEach(r => r.on = false);
}

function restartGame() {
  state.score = 0;
  state.balls = 3;
  state.multiplier = 1;
  state.gameOver = false;
  state.missionIndex = 0;
  state.missionProgress = 0;
  state.message = "SYSTEM REBOOTED";
  state.subMessage = "BALL 1 READY";
  resetBall();
  updateUI();
}

function tone(freq=440, duration=.06, type="square", volume=.035) {
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, audio.currentTime);
    g.gain.setValueAtTime(volume, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + duration);
    o.connect(g).connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + duration);
  } catch {}
}

function setMessage(a,b="") {
  state.message = a;
  state.subMessage = b;
  ui.log.innerHTML = `${a}<br>${b}`;
}

function addScore(base, kind="target") {
  const comboBonus = Math.min(state.combo, 8) * .125;
  const gained = Math.round(base * state.multiplier * (1 + comboBonus));
  state.score += gained;
  state.combo++;
  state.comboTimer = 2.1;
  if (state.score > state.high) {
    state.high = state.score;
    localStorage.setItem("cyborgPinballHigh", String(state.high));
  }
  if (missions[state.missionIndex]?.type === kind) advanceMission();
  updateUI();
  return gained;
}

function advanceMission(amount=1) {
  const mission = missions[state.missionIndex];
  if (!mission || state.missionCompleteTimer > 0) return;
  state.missionProgress = Math.min(mission.goal, state.missionProgress + amount);
  if (state.missionProgress >= mission.goal) {
    state.score += mission.reward;
    state.multiplier = Math.min(5, state.multiplier + 1);
    state.missionCompleteTimer = 2.2;
    state.flash = 1;
    setMessage("MISSION COMPLETE", `+${mission.reward} // MULTIPLIER ${state.multiplier}×`);
    tone(880,.12,"sawtooth",.05);
    setTimeout(() => tone(1320,.18,"sine",.04), 90);
  }
  updateUI();
}

function nextMission() {
  state.missionIndex = (state.missionIndex + 1) % missions.length;
  state.missionProgress = 0;
  state.missionCompleteTimer = 0;
  setMessage("NEW MISSION", missions[state.missionIndex].name);
  updateUI();
}

function updateUI() {
  const pad = n => Math.floor(n).toString().padStart(7,"0");
  ui.score.textContent = pad(state.score);
  ui.ball.textContent = String(state.balls);
  ui.multi.textContent = `${state.multiplier}×`;
  ui.high.textContent = pad(state.high);
  const mission = missions[state.missionIndex];
  ui.missionName.textContent = mission.name;
  ui.missionText.textContent = mission.text;
  ui.progress.style.width = `${100 * state.missionProgress / mission.goal}%`;
}

function launch() {
  if (!state.ready || state.gameOver) return;
  const power = 12 + state.launchCharge * 4;
  ball.vx = 0;
  ball.vy = -power;
  state.ready = false;
  state.charging = false;
  state.launchCharge = 0;
  setMessage("BALL DEPLOYED","ENTER THE CORE");
  tone(180,.13,"sawtooth",.045);
}

function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
function dist(ax,ay,bx,by){ return Math.hypot(ax-bx,ay-by); }

function limitBallSpeed(max=MAX_BALL_SPEED){
  const speed=Math.hypot(ball.vx,ball.vy);
  if(speed>max){
    const scale=max/speed;
    ball.vx*=scale;
    ball.vy*=scale;
  }
}

function emit(x,y,color,count=8,speed=5) {
  for (let i=0;i<count;i++) {
    const a = Math.random()*Math.PI*2;
    const s = Math.random()*speed;
    state.sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,color});
  }
}

function circleCollision(o, bounce=1.85, onHit) {
  const dx = ball.x-o.x, dy = ball.y-o.y;
  const d = Math.hypot(dx,dy);
  const min = ball.r+o.r;
  if (d >= min || d === 0) return false;
  const nx=dx/d, ny=dy/d;
  ball.x=o.x+nx*min;
  ball.y=o.y+ny*min;
  const dot=ball.vx*nx+ball.vy*ny;
  if (dot < 0) {
    ball.vx -= (1+bounce)*dot*nx;
    ball.vy -= (1+bounce)*dot*ny;
    ball.vx*=0.99;
    ball.vy*=0.99;
    limitBallSpeed();
  }
  onHit?.(nx,ny);
  return true;
}

function segmentCollision(x1,y1,x2,y2,width=7,bounce=.88,onHit) {
  const dx=x2-x1, dy=y2-y1;
  const l2=dx*dx+dy*dy;
  const t=clamp(((ball.x-x1)*dx+(ball.y-y1)*dy)/l2,0,1);
  const px=x1+t*dx, py=y1+t*dy;
  const bx=ball.x-px, by=ball.y-py;
  const d=Math.hypot(bx,by);
  const min=ball.r+width;
  if (d >= min || d === 0) return false;
  const nx=bx/d, ny=by/d;
  ball.x=px+nx*min;
  ball.y=py+ny*min;
  const dot=ball.vx*nx+ball.vy*ny;
  if (dot < 0) {
    ball.vx -= (1+bounce)*dot*nx;
    ball.vy -= (1+bounce)*dot*ny;
    ball.vx*=0.985;
    ball.vy*=0.985;
    limitBallSpeed();
    onHit?.(nx,ny);
  }
  return true;
}

function flipperCollision(f) {
  const ex=f.px+Math.cos(f.angle)*f.len;
  const ey=f.py+Math.sin(f.angle)*f.len;
  const hit=segmentCollision(f.px,f.py,ex,ey,f.width/2,1.02,(nx)=>{
    if(f.pressed){
      ball.vy-=6.2;
      ball.vx+=nx*2.8;
      limitBallSpeed(10);
      addScore(20);
      emit(ball.x,ball.y,C.pink,5,3);
      tone(150,.035,"square",.025);
    }
  });
  return hit;
}


function update(dt) {
  if(paused) return;
  state.flash=Math.max(0,state.flash-dt*1.7);
  state.shake=Math.max(0,state.shake-dt*2.5);

  if(state.missionCompleteTimer>0){
    state.missionCompleteTimer-=dt;
    if(state.missionCompleteTimer<=0) nextMission();
  }

  if(state.comboTimer>0){
    state.comboTimer-=dt;
    if(state.comboTimer<=0){state.combo=0;updateUI()}
  }

  flippers[0].pressed=!!(keys.ArrowLeft||keys.KeyA);
  flippers[1].pressed=!!(keys.ArrowRight||keys.KeyD);
  flippers.forEach(f=>{
    const target=f.pressed?f.active:f.rest;
    f.angle+=(target-f.angle)*Math.min(1,dt*28);
  });

  if(state.charging&&state.ready){
    state.launchCharge=Math.min(1,state.launchCharge+dt*.7);
  }

  if(state.ready||state.gameOver){
    updateParticles(dt);
    return;
  }

  /*
    TWO-PHASE BALL MOTION

    PHASE 1 — SHOOTER TUNNEL
    The launcher moves the ball straight up inside the tunnel without
    gravity, drag, bumpers, or playfield walls interfering.

    PHASE 2 — PLAYFIELD
    After one clean handoff, normal gravity and collision physics begin.
  */
  if(!shooterTransferred){
    // Keep the ball centered in the one shooter tunnel.
    ball.x=800;

    // The launch velocity is set when SPACE is released.
    ball.y+=ball.vy;

    // Solid top/bottom protection inside the launcher.
    if(ball.y>965)ball.y=965;

    if(ball.y<=285){
      // Release into open space below the upper-right guides.
      ball.x=680;
      ball.y=325;
      ball.vx=-5.2;
      ball.vy=2.4;
      shooterTransferred=true;

      emit(ball.x,ball.y,C.cyan,10,4);
      setMessage("SHOOTER EXIT","BALL ENTERED PLAYFIELD");
      tone(720,.08,"sine",.035);
    }

    ball.trail.unshift({x:ball.x,y:ball.y});
    if(ball.trail.length>12)ball.trail.pop();

    updateParticles(dt);
    return;
  }

  // Normal playfield gravity and drag.
  ball.vy+=GRAVITY*dt;
  ball.vx*=Math.pow(AIR_DRAG,dt*120);
  ball.vy*=Math.pow(AIR_DRAG,dt*120);
  limitBallSpeed();

  // Small movement steps prevent the ball from passing through solid rails.
  const travel=Math.hypot(ball.vx,ball.vy);
  const substeps=Math.max(1,Math.ceil(travel/2.5));

  for(let step=0;step<substeps;step++){
    ball.x+=ball.vx/substeps;
    ball.y+=ball.vy/substeps;

    // Resolve every solid wall during every movement step.
    walls.forEach(w=>segmentCollision(...w,9,.58));

    // Solid cabinet containment after entering the playfield.
    if(ball.y<1010){
      if(ball.x-ball.r<44){
        ball.x=44+ball.r;
        ball.vx=Math.abs(ball.vx)*.68;
      }
      if(ball.x+ball.r>730){
        ball.x=730-ball.r;
        ball.vx=-Math.abs(ball.vx)*.68;
      }
      if(ball.y-ball.r<62){
        ball.y=62+ball.r;
        ball.vy=Math.abs(ball.vy)*.68;
      }
    }

    limitBallSpeed();
  }

  ball.trail.unshift({x:ball.x,y:ball.y});
  if(ball.trail.length>12)ball.trail.pop();

  // Bumpers.
  bumpers.forEach(b=>{
    circleCollision(b,1.7,(nx,ny)=>{
      const speed=clamp(Math.hypot(ball.vx,ball.vy)+1.1,5.5,8.8);
      ball.vx=nx*speed;
      ball.vy=ny*speed;
      limitBallSpeed(9);
      b.pulse=1;
      addScore(b.points,"target");
      state.shake=.35;
      emit(b.x,b.y,b.color,13,6);
      tone(250+b.points,.07,"sine",.045);
    });
    b.pulse=Math.max(0,b.pulse-dt*4);
  });

  // Reactor core.
  circleCollision(reactor,1.55,(nx,ny)=>{
    const speed=clamp(Math.hypot(ball.vx,ball.vy)+1,5,8);
    ball.vx=nx*speed;
    ball.vy=ny*speed;
    limitBallSpeed(9);
    reactor.pulse=1;
    reactor.hits++;
    addScore(400,"reactor");
    emit(reactor.x,reactor.y,C.purple,18,7);
    tone(520,.1,"sawtooth",.04);
  });
  reactor.pulse=Math.max(0,reactor.pulse-dt*3.5);

  posts.forEach(p=>circleCollision(p,1.15,()=>{addScore(25);tone(620,.025,"square",.015)}));

  // Rollover gates.
  rollovers.forEach(r=>{
    segmentCollision(r.x,r.y1,r.x,r.y2,5,.45);
    if(!r.on && Math.abs(ball.x-r.x)<15 && ball.y>r.y1 && ball.y<r.y2){
      r.on=true;
      addScore(200,"gate");
      emit(r.x,(r.y1+r.y2)/2,C.white,7,3);
      tone(900,.05,"sine",.025);
      if(rollovers.every(v=>v.on)){
        addScore(1200);
        state.multiplier=Math.min(5,state.multiplier+1);
        setMessage("DATA GATES COMPLETE",`MULTIPLIER ${state.multiplier}×`);
        setTimeout(()=>rollovers.forEach(v=>v.on=false),500);
      }
    }
  });

  // Solid stand-up targets with a short hit cooldown.
  targets.forEach(tg=>{
    tg.cooldown=Math.max(0,(tg.cooldown||0)-dt);

    if(tg.cooldown===0 &&
       ball.x+ball.r>tg.x && ball.x-ball.r<tg.x+tg.w &&
       ball.y+ball.r>tg.y && ball.y-ball.r<tg.y+tg.h){

      const cx=tg.x+tg.w/2;
      const cy=tg.y+tg.h/2;
      const dx=ball.x-cx;
      const dy=ball.y-cy;

      if(Math.abs(dx)>Math.abs(dy)){
        const side=dx<0?-1:1;
        ball.x=cx+side*(tg.w/2+ball.r+1);
        ball.vx=side*Math.max(3,Math.abs(ball.vx)*.75);
      }else{
        const side=dy<0?-1:1;
        ball.y=cy+side*(tg.h/2+ball.r+1);
        ball.vy=side*Math.max(3,Math.abs(ball.vy)*.75);
      }

      limitBallSpeed();
      tg.cooldown=.18;
      tg.on=true;
      addScore(300,"target");
      emit(cx,cy,C.pink,10,4);
      tone(760,.04,"square",.03);
      setTimeout(()=>tg.on=false,180);
    }
  });

  // Orbits.
  orbitSensors.forEach((o,i)=>{
    if(o.armed && ball.x>o.x && ball.x<o.x+o.w && ball.y>o.y && ball.y<o.y+o.h){
      o.armed=false;
      addScore(650,"orbit");
      setMessage(i?"RIGHT ORBIT":"LEFT ORBIT","+650 LINK BONUS");
      tone(1050,.09,"sine",.035);
    }
    if(ball.y>o.y+140)o.armed=true;
  });



  flippers.forEach(flipperCollision);


  // Final playfield safety.
  limitBallSpeed();
  if(Math.abs(ball.vx)<MIN_ROLL_SPEED)ball.vx=0;

  if(!Number.isFinite(ball.x)||!Number.isFinite(ball.y)||
     !Number.isFinite(ball.vx)||!Number.isFinite(ball.vy)){
    resetBall();
    setMessage("BALL RESET","PHYSICS SAFETY RECOVERY");
    return;
  }

  if(ball.y>H+30){
    state.balls--;
    updateUI();
    if(state.balls<=0){
      state.gameOver=true;
      setMessage("SYSTEM FAILURE",`FINAL SCORE ${Math.floor(state.score)}`);
      tone(95,.5,"sawtooth",.05);
    }else{
      setMessage("BALL LOST",`${state.balls} BALLS REMAINING`);
      resetBall();
    }
  }

  updateParticles(dt);
}

function updateParticles(dt){
  for(const p of state.sparks){
    p.x+=p.vx;
    p.y+=p.vy;
    p.vy+=.12;
    p.vx*=.98;
    p.vy*=.98;
    p.life-=dt*2.3;
  }
  state.sparks=state.sparks.filter(p=>p.life>0);
}

function neonLine(x1,y1,x2,y2,color,width=8){
  ctx.save();
  ctx.lineCap="round";
  ctx.strokeStyle=color;
  ctx.shadowColor=color;
  ctx.shadowBlur=15;
  ctx.lineWidth=width;
  ctx.beginPath();
  ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
  ctx.shadowBlur=0;
  ctx.strokeStyle="rgba(255,255,255,.6)";
  ctx.lineWidth=Math.max(1,width*.18);
  ctx.stroke();
  ctx.restore();
}

function neonCircle(x,y,r,color,width=7){
  ctx.save();
  ctx.strokeStyle=color;
  ctx.shadowColor=color;
  ctx.shadowBlur=24;
  ctx.lineWidth=width;
  ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();
  ctx.restore();
}

function drawBackground(){
  const g=ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,"#081329");
  g.addColorStop(.55,"#062d4d");
  g.addColorStop(1,"#061020");
  ctx.fillStyle=g;
  ctx.fillRect(0,0,W,H);

  ctx.save();
  ctx.globalAlpha=.18;
  ctx.strokeStyle=C.cyan;
  ctx.lineWidth=1;
  for(let i=0;i<18;i++){
    ctx.beginPath();
    ctx.moveTo(70+i*45,180);
    ctx.lineTo(40+i*48,940);
    ctx.stroke();
  }
  ctx.globalAlpha=.25;
  for(let i=0;i<45;i++){
    const y=(i*79+tick*.18)%900+100;
    const x=(i*137)%850+20;
    ctx.fillStyle=i%3?C.cyan:C.pink;
    ctx.fillRect(x,y,2,2);
  }
  ctx.restore();

  // Playfield center art.
  ctx.save();
  const rg=ctx.createRadialGradient(425,650,20,425,650,260);
  rg.addColorStop(0,"rgba(68,110,255,.25)");
  rg.addColorStop(1,"rgba(0,0,0,0)");
  ctx.fillStyle=rg;
  ctx.fillRect(120,340,610,560);

  ctx.globalAlpha=.23;
  ctx.fillStyle="#5cefff";
  ctx.beginPath();
  ctx.moveTo(425,555);ctx.lineTo(515,835);ctx.lineTo(425,790);ctx.lineTo(335,835);ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawShell(){
  ctx.save();
  ctx.lineJoin="round";
  ctx.strokeStyle="#15233d";
  ctx.lineWidth=26;
  ctx.beginPath();
  ctx.moveTo(44,1010);
  ctx.lineTo(44,170);
  ctx.lineTo(145,62);
  ctx.lineTo(665,62);
  ctx.lineTo(820,150);
  ctx.lineTo(820,1010);
  ctx.stroke();

  ctx.strokeStyle=C.cyan;
  ctx.shadowColor=C.cyan;
  ctx.shadowBlur=18;
  ctx.lineWidth=7;
  ctx.stroke();
  ctx.restore();

  // ONE tunnel: cabinet wall outside, one divider inside.
  neonLine(770,285,770,1010,C.cyan,8);

  // Clear top elbow into the playfield.
  neonLine(820,150,790,110,C.cyan,8);
  neonLine(790,110,745,102,C.cyan,8);
  neonLine(745,102,715,145,C.cyan,8);

  // Clean playfield rails.
  walls.slice(5).forEach((w,i)=>{
    const color=i<4?C.blue:(i<8?C.cyan:C.gold);
    neonLine(w[0],w[1],w[2],w[3],color,i<4?9:7);
  });
}

function drawRollovers(){
  rollovers.forEach((r,i)=>{
    const color=r.on?C.gold:C.white;
    neonLine(r.x,r.y1,r.x,r.y2,color,8);
    ctx.fillStyle=r.on?C.gold:"#6a7997";
    ctx.font="700 13px monospace";
    ctx.textAlign="center";
    ctx.fillText(String(i+1),r.x,r.y2+20);
  });
}

function drawBumpers(){
  bumpers.forEach(b=>{
    const r=b.r+b.pulse*8+Math.sin(tick*.045+b.x)*1.3;
    ctx.save();
    ctx.fillStyle="rgba(4,8,18,.92)";
    ctx.shadowColor=b.color;
    ctx.shadowBlur=26+b.pulse*20;
    ctx.beginPath();ctx.arc(b.x,b.y,r,0,Math.PI*2);ctx.fill();
    ctx.lineWidth=9;ctx.strokeStyle=b.color;ctx.stroke();
    ctx.lineWidth=2;ctx.strokeStyle="white";ctx.stroke();
    ctx.fillStyle=b.color;
    ctx.font="900 18px monospace";
    ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.fillText(b.label,b.x,b.y);
    ctx.restore();
  });
}

function drawReactor(){
  const pulse=reactor.pulse*9+Math.sin(tick*.04)*2;
  ctx.save();
  const glow=ctx.createRadialGradient(reactor.x,reactor.y,8,reactor.x,reactor.y,reactor.r+30);
  glow.addColorStop(0,"rgba(180,145,255,.7)");
  glow.addColorStop(.45,"rgba(75,67,255,.4)");
  glow.addColorStop(1,"rgba(0,0,0,0)");
  ctx.fillStyle=glow;
  ctx.beginPath();ctx.arc(reactor.x,reactor.y,reactor.r+30+pulse,0,Math.PI*2);ctx.fill();

  neonCircle(reactor.x,reactor.y,reactor.r+pulse,C.purple,9);
  neonCircle(reactor.x,reactor.y,reactor.r-18,C.cyan,4);
  for(let i=0;i<12;i++){
    const a=tick*.01+i*Math.PI/6;
    ctx.fillStyle=i%2?C.cyan:C.pink;
    ctx.beginPath();
    ctx.arc(reactor.x+Math.cos(a)*(reactor.r+15),reactor.y+Math.sin(a)*(reactor.r+15),5,0,Math.PI*2);
    ctx.fill();
  }
  ctx.fillStyle="white";
  ctx.font="900 18px monospace";
  ctx.textAlign="center";
  ctx.fillText("CORE",reactor.x,reactor.y+6);
  ctx.restore();
}

function drawTargets(){
  targets.forEach(tg=>{
    ctx.save();
    ctx.fillStyle=tg.on?C.white:C.pink;
    ctx.shadowColor=tg.on?C.white:C.pink;
    ctx.shadowBlur=tg.on?25:10;
    ctx.fillRect(tg.x,tg.y,tg.w,tg.h);
    ctx.restore();
  });
}


function drawPosts(){
  posts.forEach(p=>{
    ctx.save();
    ctx.fillStyle="#eaffff";
    ctx.shadowColor=C.cyan;
    ctx.shadowBlur=15;
    ctx.beginPath();
    ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
    ctx.fill();

    ctx.fillStyle="#17253b";
    ctx.beginPath();
    ctx.arc(p.x,p.y,p.r*.48,0,Math.PI*2);
    ctx.fill();
    ctx.restore();
  });
}

function drawFlippers(){
  flippers.forEach(f=>{
    const ex=f.px+Math.cos(f.angle)*f.len;
    const ey=f.py+Math.sin(f.angle)*f.len;

    ctx.save();
    ctx.lineCap="round";

    // Dark body gives each flipper a solid arcade-machine shape.
    ctx.strokeStyle="#2a1020";
    ctx.lineWidth=f.width+14;
    ctx.beginPath();
    ctx.moveTo(f.px,f.py);
    ctx.lineTo(ex,ey);
    ctx.stroke();

    neonLine(f.px,f.py,ex,ey,C.pink,f.width);

    ctx.fillStyle=C.white;
    ctx.shadowColor=C.white;
    ctx.shadowBlur=10;
    ctx.beginPath();
    ctx.arc(f.px,f.py,9,0,Math.PI*2);
    ctx.fill();
    ctx.restore();
  });
}

function drawSlings(){}

function drawBall(){
  ball.trail.forEach((p,i)=>{
    ctx.fillStyle=`rgba(53,241,255,${.14*(1-i/ball.trail.length)})`;
    ctx.beginPath();ctx.arc(p.x,p.y,ball.r*(1-i/ball.trail.length),0,Math.PI*2);ctx.fill();
  });
  const g=ctx.createRadialGradient(ball.x-4,ball.y-5,2,ball.x,ball.y,ball.r);
  g.addColorStop(0,"white");g.addColorStop(.35,"#e4faff");g.addColorStop(1,"#44708c");
  ctx.save();
  ctx.fillStyle=g;
  ctx.shadowColor="white";
  ctx.shadowBlur=18;
  ctx.beginPath();ctx.arc(ball.x,ball.y,ball.r,0,Math.PI*2);ctx.fill();
  ctx.restore();
}

function drawLauncher(){
  ctx.save();
  ctx.strokeStyle="#263c55";ctx.lineWidth=3;
  ctx.strokeRect(790,790,18,165);
  const h=state.ready?state.launchCharge*161:0;
  const g=ctx.createLinearGradient(0,951,0,780);
  g.addColorStop(0,C.lime);g.addColorStop(.6,C.gold);g.addColorStop(1,C.pink);
  ctx.fillStyle=g;ctx.fillRect(792,953-h,14,h);
  ctx.fillStyle=C.white;
  ctx.beginPath();ctx.arc(800,982,13,0,Math.PI*2);ctx.fill();
  ctx.restore();
}

function drawHUD(){
  ctx.save();
  ctx.textAlign="center";
  ctx.fillStyle=C.cyan;
  ctx.shadowColor=C.cyan;
  ctx.shadowBlur=12;
  ctx.font="900 34px system-ui";
  ctx.fillText("CYBORG CORE",425,113);
  ctx.shadowBlur=0;
  ctx.fillStyle=C.gold;
  ctx.font="800 17px monospace";
  if(state.combo>1)ctx.fillText(`COMBO ${state.combo}  //  ${1+(Math.min(state.combo,8)*.125)}× BONUS`,425,143);

  if(state.ready&&!state.gameOver){
    ctx.fillStyle=C.gold;
    ctx.font="900 17px system-ui";
    ctx.fillText(state.charging?"RELEASE SPACE TO LAUNCH":"HOLD SPACE TO CHARGE",425,1060);
  }
  ctx.restore();
}

function drawOverlays(){
  if(paused||state.gameOver){
    ctx.save();
    ctx.fillStyle="rgba(0,3,10,.78)";
    ctx.fillRect(0,0,W,H);
    ctx.textAlign="center";
    ctx.fillStyle=state.gameOver?C.pink:C.cyan;
    ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=24;
    ctx.font="900 58px system-ui";
    ctx.fillText(state.gameOver?"SYSTEM FAILURE":"PAUSED",W/2,H/2-20);
    ctx.shadowBlur=0;
    ctx.fillStyle="white";
    ctx.font="700 22px monospace";
    ctx.fillText(state.gameOver?"PRESS R TO REBOOT":"PRESS P TO RESUME",W/2,H/2+35);
    ctx.restore();
  }
  if(state.flash>0){
    ctx.fillStyle=`rgba(255,255,255,${state.flash*.25})`;
    ctx.fillRect(0,0,W,H);
  }
}

let tick=0;
function draw(){
  tick++;
  ctx.save();
  if(state.shake>0){
    ctx.translate((Math.random()-.5)*state.shake*10,(Math.random()-.5)*state.shake*10);
  }
  drawBackground();
  drawShell();
  drawRollovers();
  drawTargets();
  drawBumpers();
  drawReactor();
  drawSlings();
  drawPosts();
  drawFlippers();
  drawLauncher();
  drawBall();
  drawHUD();

  for(const p of state.sparks){
    ctx.globalAlpha=Math.max(0,p.life);
    ctx.fillStyle=p.color;
    ctx.fillRect(p.x,p.y,3,3);
  }
  ctx.globalAlpha=1;
  drawOverlays();
  ctx.restore();
}

function frame(now){
  const elapsed=Math.min(.05,(now-last)/1000);
  last=now;
  accumulator+=elapsed;
  while(accumulator>=STEP){
    update(STEP);
    accumulator-=STEP;
  }
  draw();
  requestAnimationFrame(frame);
}

function setKey(code,value){
  keys[code]=value;
}

window.addEventListener("keydown",e=>{
  if(["Space","ArrowLeft","ArrowRight"].includes(e.code))e.preventDefault();
  keys[e.code]=true;
  if(e.code==="Space"&&state.ready&&!state.charging){
    state.charging=true;
    state.launchCharge=.05;
    tone(120,.03,"sine",.015);
  }
  if(e.code==="KeyP"){
    paused=!paused;
    ui.pause.textContent=paused?"▶":"Ⅱ";
  }
  if(e.code==="KeyR")restartGame();
});

window.addEventListener("keyup",e=>{
  keys[e.code]=false;
  if(e.code==="Space"&&state.charging)launch();
});

function bindHold(el,code){
  const down=e=>{e.preventDefault();setKey(code,true)};
  const up=e=>{e.preventDefault();setKey(code,false)};
  el.addEventListener("pointerdown",down);
  el.addEventListener("pointerup",up);
  el.addEventListener("pointercancel",up);
  el.addEventListener("pointerleave",up);
}
bindHold(ui.leftTouch,"ArrowLeft");
bindHold(ui.rightTouch,"ArrowRight");

ui.launchTouch.addEventListener("pointerdown",e=>{
  e.preventDefault();
  if(state.ready){state.charging=true;state.launchCharge=.05}
});
ui.launchTouch.addEventListener("pointerup",e=>{
  e.preventDefault();
  if(state.charging)launch();
});
ui.pause.addEventListener("click",()=>{
  paused=!paused;
  ui.pause.textContent=paused?"▶":"Ⅱ";
});
ui.restart.addEventListener("click",restartGame);


window.__pinballDebug={
  getState:()=>({
    x:ball.x,y:ball.y,vx:ball.vx,vy:ball.vy,
    ready:state.ready,transferred:shooterTransferred,
    gameOver:state.gameOver,balls:state.balls
  }),
  launchNow:()=>{
    if(state.ready){
      state.launchCharge=1;
      launch();
    }
  }
};

updateUI();
setMessage("SYSTEM ONLINE","HOLD SPACE TO CHARGE");
resetBall();
requestAnimationFrame(frame);
})();
