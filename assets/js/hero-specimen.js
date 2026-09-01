const canvas   = document.getElementById('scene');
const poster   = document.getElementById('poster');
const hudCount = document.getElementById('hudCount');
const hudGlyph = document.getElementById('hudGlyph');
const hudState = document.getElementById('hudState');
const autoBtn  = document.getElementById('autoBtn');
const heroHint = document.getElementById('heroHint');
const btns     = [...document.querySelectorAll('.glyph-btn[data-g]')];
const reduce   = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const GLYPHS = ['C','S','✦','@'];

function fallback(){
  if(canvas) canvas.style.display = 'none';
  if(poster) poster.style.display = 'grid';
  if(heroHint) heroHint.style.display = 'none';
}

let THREE;
try{ THREE = await import('three'); }
catch(e){ fallback(); throw e; }

let renderer;
try{
  renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true });
  if(!renderer.getContext()) throw new Error('no gl');
}catch(e){ fallback(); throw e; }

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);

const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
camera.position.set(0, 0, 26);

/* paleta do sistema */
const PALETTE = {
  azure:  new THREE.Color('#4C7EF3'),
  light:  new THREE.Color('#A8C4FF'),
  paper:  new THREE.Color('#F6F5F3'),
  bordo:  new THREE.Color('#C25A70'),
  slate:  new THREE.Color('#5C6B82'),
};

/* ---------- amostragem do glifo ---------- */
const SAMPLE_W = 320, SAMPLE_H = 320, PLANE_W = 20;
const off  = document.createElement('canvas');
off.width = SAMPLE_W; off.height = SAMPLE_H;
const octx = off.getContext('2d', { willReadFrequently:true });

function sampleGlyph(ch){
  octx.clearRect(0,0,SAMPLE_W,SAMPLE_H);
  octx.fillStyle = '#000';
  octx.textAlign = 'center';
  octx.textBaseline = 'middle';
  /* ✦ não existe na Fraunces: precisa de uma pilha com fonte de símbolos e,
     por ser dingbat (ocupa menos da caixa em), de um corpo maior            */
  const isStar = ch === '✦';
  const size  = isStar ? 0.98 : (ch === '@' || ch === '&') ? 0.72 : 0.82;
  const stack = isStar
    ? '"Segoe UI Symbol","Apple Symbols","Noto Sans Symbols 2",sans-serif'
    : '"Fraunces", Georgia, serif';
  octx.font = '900 ' + Math.round(SAMPLE_H * size) + 'px ' + stack;
  octx.fillText(ch, SAMPLE_W/2, SAMPLE_H/2 + (isStar ? 0 : SAMPLE_H*0.02));

  const data = octx.getImageData(0,0,SAMPLE_W,SAMPLE_H).data;
  const pts = [];
  const step = 2;
  for(let y=0; y<SAMPLE_H; y+=step){
    for(let x=0; x<SAMPLE_W; x+=step){
      if(data[(y*SAMPLE_W + x)*4 + 3] > 128){
        const jx = x + (Math.random()-0.5)*step;
        const jy = y + (Math.random()-0.5)*step;
        pts.push((jx/SAMPLE_W - 0.5)*PLANE_W, -(jy/SAMPLE_H - 0.5)*PLANE_W);
      }
    }
  }
  return pts;
}

/* ---------- sistema de partículas ---------- */
let PARTICLES = window.innerWidth < 700 ? 22000 : 42000;
const positions  = new Float32Array(PARTICLES*3);
const targets    = new Float32Array(PARTICLES*3);
const homeZ      = new Float32Array(PARTICLES);
const velocities = new Float32Array(PARTICLES*3);
const colors     = new Float32Array(PARTICLES*3);
const seeds      = new Float32Array(PARTICLES);

for(let i=0; i<PARTICLES; i++){
  const r = 14 + Math.random()*10, th = Math.random()*Math.PI*2;
  positions[i*3]   = Math.cos(th)*r;
  positions[i*3+1] = (Math.random()-0.5)*24;
  positions[i*3+2] = (Math.random()-0.5)*8;
  homeZ[i] = (Math.random()-0.5)*1.0;
  seeds[i] = Math.random();
  /* 6% bordô · 10% paper · 26% azure claro · resto azure */
  const roll = Math.random();
  const c = roll < 0.06 ? PALETTE.bordo
          : roll < 0.16 ? PALETTE.paper
          : roll < 0.42 ? PALETTE.light
          : roll < 0.94 ? PALETTE.azure
          : PALETTE.slate;
  colors[i*3] = c.r; colors[i*3+1] = c.g; colors[i*3+2] = c.b;
}

const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));

function dotTexture(){
  const s = 64, c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);
  grad.addColorStop(0,   'rgba(255,255,255,1)');
  grad.addColorStop(0.45,'rgba(255,255,255,0.8)');
  grad.addColorStop(1,   'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.beginPath(); g.arc(s/2,s/2,s/2,0,Math.PI*2); g.fill();
  return new THREE.CanvasTexture(c);
}

const mat = new THREE.PointsMaterial({
  size: 0.125,
  map: dotTexture(),
  vertexColors: true,
  transparent: true,
  opacity: 0.95,
  depthWrite: false,
  sizeAttenuation: true,
  blending: THREE.AdditiveBlending,   /* luz sobre o void — o oposto da tinta sobre papel */
});

const points = new THREE.Points(geo, mat);
scene.add(points);

let morphStart = 0, morphing = false;
const MORPH_MS = 1400;

function setTargets(ch){
  const pts = sampleGlyph(ch);
  const n = pts.length/2;
  if(!n) return;
  /* glifos sólidos como o ✦ geram mais amostras que partículas; sem um passo
     de distribuição as amostras finais ficariam órfãs e a base do glifo sumiria */
  const stride = n > PARTICLES ? n / PARTICLES : 1;
  for(let i=0; i<PARTICLES; i++){
    const s = (stride === 1 ? (i % n) : Math.floor(i * stride) % n)*2;
    targets[i*3]   = pts[s];
    targets[i*3+1] = pts[s+1];
    targets[i*3+2] = homeZ[i];
  }
  hudGlyph.textContent = ch;
  hudState.textContent = 'fundindo';
  morphStart = performance.now();
  morphing = true;
}

/* ---------- cursor como repulsor 3D ---------- */
const pointer = new THREE.Vector2(-10,-10);
let pointerActive = false;
const ndc = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const glyphPlane = new THREE.Plane(new THREE.Vector3(0,0,1), 0);
const cursorWorld = new THREE.Vector3(999,999,0);
const REPEL_R = 3.0, REPEL_STR = 2.6;

function updateCursorWorld(){
  const rect = canvas.getBoundingClientRect();
  ndc.x =  ((pointer.x - rect.left)/rect.width)*2 - 1;
  ndc.y = -((pointer.y - rect.top)/rect.height)*2 + 1;
  raycaster.setFromCamera(ndc, camera);
  raycaster.ray.intersectPlane(glyphPlane, cursorWorld);
}
canvas.addEventListener('pointermove', e=>{ pointer.set(e.clientX, e.clientY); pointerActive = true; });
canvas.addEventListener('pointerleave', ()=>{ pointerActive = false; cursorWorld.set(999,999,0); });

let pulse = 0;
const pulseCenter = new THREE.Vector3();
canvas.addEventListener('click', ()=>{
  updateCursorWorld();
  pulseCenter.copy(cursorWorld);
  pulse = 1;
  advance();
});

/* ---------- seleção + auto-fundição ---------- */
let idx = 0, auto = !reduce, autoTimer = 0;
const AUTO_MS = 4600;

function selectGlyph(i){
  idx = (i + GLYPHS.length) % GLYPHS.length;
  setTargets(GLYPHS[idx]);
  btns.forEach((b,k)=>b.classList.toggle('is-active', k === idx));
  autoTimer = performance.now();
}
function advance(){ selectGlyph(idx + 1); }
btns.forEach((b,k)=>b.addEventListener('click', ()=>selectGlyph(k)));
autoBtn.addEventListener('click', ()=>{
  auto = !auto;
  autoBtn.setAttribute('aria-pressed', String(auto));
  autoTimer = performance.now();
});

/* ---------- resize ---------- */
function resize(){
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(rect.width,1), h = Math.max(rect.height,1);
  renderer.setSize(w, h, false);
  camera.aspect = w/h;
  const vFov = (camera.fov*Math.PI)/180;
  const needed = (PLANE_W*0.62)/Math.tan(vFov/2);
  camera.position.z = Math.max(needed, needed*(w < h ? 1.0 : 0.86));
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const easeInOut = t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3)/2;

hudCount.textContent = PARTICLES.toLocaleString('pt-BR');
selectGlyph(0);

let last = performance.now(), idleRot = 0;

function tick(now){
  requestAnimationFrame(tick);
  if(document.hidden){ last = now; return; }
  const dt = Math.min((now-last)/1000, 0.05);
  last = now;

  if(pointerActive) updateCursorWorld();

  const gp = morphing ? Math.min((now-morphStart)/MORPH_MS, 1) : 1;
  if(morphing && gp >= 1){ morphing = false; hudState.textContent = pointerActive ? 'esculpindo' : 'fundido'; }

  const pos = geo.attributes.position.array;
  const cx = cursorWorld.x, cy = cursorWorld.y;
  const withinCursor = pointerActive && Math.abs(cx) < 40;
  let carving = false;

  for(let i=0; i<PARTICLES; i++){
    const ix = i*3;
    let lp = 1;
    if(morphing){
      const start = seeds[i]*0.42;
      lp = easeInOut(THREE.MathUtils.clamp((gp-start)/(1-0.42), 0, 1));
    }

    const dx = targets[ix]   - pos[ix];
    const dy = targets[ix+1] - pos[ix+1];
    const dz = targets[ix+2] - pos[ix+2];

    const pull = morphing ? (0.06 + 0.22*lp) : 0.20;
    velocities[ix]   += dx*pull;
    velocities[ix+1] += dy*pull;
    velocities[ix+2] += dz*pull;

    if(withinCursor){
      const rx = pos[ix] - cx, ry = pos[ix+1] - cy;
      const d2 = rx*rx + ry*ry;
      if(d2 < REPEL_R*REPEL_R){
        const d = Math.sqrt(d2) + 0.0001;
        const f = 1 - d/REPEL_R;
        velocities[ix]   += (rx/d)*f*REPEL_STR;
        velocities[ix+1] += (ry/d)*f*REPEL_STR;
        velocities[ix+2] += f*f*REPEL_STR*1.8*(seeds[i] > 0.5 ? 1 : -1);
        carving = true;
      }
    }

    if(pulse > 0.01){
      const rx = pos[ix] - pulseCenter.x, ry = pos[ix+1] - pulseCenter.y;
      const d = Math.sqrt(rx*rx + ry*ry) + 0.0001;
      if(d < 8){
        const f = pulse*(1 - d/8)*0.9;
        velocities[ix]   += (rx/d)*f;
        velocities[ix+1] += (ry/d)*f;
        velocities[ix+2] += (Math.random()-0.5)*f*1.4;
      }
    }

    const damp = morphing ? 0.80 : 0.68;
    velocities[ix]   *= damp;
    velocities[ix+1] *= damp;
    velocities[ix+2] *= damp*0.96;
    pos[ix]   += velocities[ix];
    pos[ix+1] += velocities[ix+1];
    pos[ix+2] += velocities[ix+2];
  }

  geo.attributes.position.needsUpdate = true;
  if(pulse > 0.01) pulse *= 0.86;
  if(!morphing) hudState.textContent = carving ? 'esculpindo' : 'fundido';

  if(!reduce){
    idleRot += dt*0.06;
    points.rotation.y = Math.sin(idleRot)*0.05;
    points.rotation.x = Math.cos(idleRot*0.7)*0.02;
  }

  if(auto && now - autoTimer > AUTO_MS && !morphing) advance();

  renderer.render(scene, camera);
}

/* espera a webfont para que o primeiro raster já seja a Fraunces real */
if(document.fonts && document.fonts.ready){
  document.fonts.load('900 100px "Fraunces"').then(()=>selectGlyph(idx)).catch(()=>{});
}

requestAnimationFrame(tick);

/* esconde a dica após a primeira interação */
let hinted = false;
['pointermove','click'].forEach(ev=>{
  canvas.addEventListener(ev, ()=>{
    if(!hinted && heroHint){
      hinted = true;
      heroHint.style.transition = 'opacity .8s';
      heroHint.style.opacity = '0';
    }
  });
});
