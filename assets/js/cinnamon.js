const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Lucide ---------- */
lucide.createIcons({ attrs:{ 'stroke-width':1.5 } });

/* ---------- preloader (Parallax) ---------- */
(function loader(){
  const el = document.getElementById('loader');
  const bar = document.getElementById('loaderBar');
  if(!el) return;
  if(reduceMotion){ el.style.display='none'; return; }
  let p = 0;
  const t = setInterval(()=>{
    p = Math.min(p + Math.random()*18, 100);
    bar.style.width = p + '%';
    if(p >= 100){
      clearInterval(t);
      setTimeout(()=>{
        el.style.transition = 'transform .9s cubic-bezier(.7,0,.3,1), opacity .6s ease';
        el.style.transform = 'translateY(-100%)';
        el.style.opacity = '0';
        setTimeout(()=>el.remove(), 950);
      }, 200);
    }
  }, 130);
})();

/* ---------- Lenis + GSAP ----------
   Modo lerp em vez de duration: o scroll persegue o alvo a cada frame
   em vez de animar por um tempo fixo, então responde na hora.
   lerp  → quanto maior, mais imediato (.1 = padrão Lenis, 1 = sem suavização)
   *Multiplier → distância percorrida por gesto                                */
let lenis = null;
if(window.Lenis && !reduceMotion){
  lenis = new Lenis({
    lerp: 0.14,
    wheelMultiplier: 1.5,
    touchMultiplier: 2,
    smoothWheel: true,
  });
  /* o Lenis assume o controle — o smooth nativo do CSS brigaria com ele */
  document.documentElement.style.scrollBehavior = 'auto';

  if(window.gsap){
    gsap.ticker.add((time)=>lenis.raf(time*1000));
    gsap.ticker.lagSmoothing(0);
    if(window.ScrollTrigger) lenis.on('scroll', ScrollTrigger.update);
  } else {
    const raf = (t)=>{ lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }
}

/* ---------- navegação por âncora ----------
   Passa pelo Lenis quando ele existe; sem isso o scrollIntoView nativo
   disputa o scroll com ele e o salto fica arrastado.                        */
function scrollToTarget(target, offset = 0){
  if(lenis){ lenis.scrollTo(target, { offset, duration: 0.7 }); return; }
  if(typeof target === 'number'){ window.scrollTo({ top:target, behavior:'smooth' }); return; }
  const el = document.querySelector(target);
  if(el) el.scrollIntoView({ behavior:'smooth' });
}
document.addEventListener('click', e=>{
  const a = e.target.closest('a[href^="#"]');
  if(!a) return;
  const id = a.getAttribute('href');
  if(id.length < 2 || !document.querySelector(id)) return;   /* href="#" puro */
  e.preventDefault();
  scrollToTarget(id, -70);                                    /* desconta a navbar fixa */
});

/* ---------- surgimento em scroll ---------- */
(function(){
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('animate'); io.unobserve(e.target); } });
  },{ threshold:.15, rootMargin:'0px 0px -8% 0px' });
  document.querySelectorAll('.animate-on-scroll').forEach(el=>io.observe(el));

  /* .col-anim só anima ao entrar na viewport */
  const io2 = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      if(e.isIntersecting){ e.target.style.animationPlayState='running'; io2.unobserve(e.target); }
    });
  },{ threshold:.12 });
  document.querySelectorAll('.col-anim').forEach(el=>{ el.style.animationPlayState='paused'; io2.observe(el); });
})();

/* ---------- word reveal (Parallax + GSAP) ---------- */
function splitWords(el){
  const words = el.innerText.split(' ');
  el.innerHTML = '';
  words.forEach(w=>{
    const wrap = document.createElement('span');
    wrap.className = 'word-wrap';
    wrap.innerHTML = '<span class="word-inner">' + w + '&nbsp;</span>';
    el.appendChild(wrap);
  });
}
document.querySelectorAll('.split-animate').forEach(splitWords);

if(window.gsap && window.ScrollTrigger){
  gsap.registerPlugin(ScrollTrigger);
  document.querySelectorAll('.split-animate').forEach(el=>{
    gsap.to(el.querySelectorAll('.word-inner'), {
      y:'0%', duration:1, ease:'power3.out', stagger:.04,
      scrollTrigger:{ trigger:el, start:'top 88%', toggleActions:'play none none reverse' }
    });
  });
} else {
  document.querySelectorAll('.word-inner').forEach(w=>w.style.transform='translateY(0)');
}

/* ---------- navbar sticky + scrollspy + progresso + float ---------- */
(function(){
  const bar = document.getElementById('topbar');
  const prog = document.getElementById('progress');
  const float = document.getElementById('floatTop');
  const links = [...document.querySelectorAll('[data-nav]')];
  const sections = links.map(a=>document.querySelector(a.getAttribute('href'))).filter(Boolean);

  function onScroll(){
    const y = window.scrollY;
    bar.classList.toggle('is-stuck', y > 40);
    float.classList.toggle('show', y > 700);
    const h = document.documentElement.scrollHeight - window.innerHeight;
    prog.style.width = (h > 0 ? (y/h)*100 : 0) + '%';

    /* pela posição da seção, não pela ordem do menu — os dois não
       precisam coincidir, e coincidir por acidente esconde o bug     */
    let currentLink = null, nearest = -Infinity;
    const limit = window.innerHeight*0.35;
    sections.forEach((s,i)=>{
      const top = s.getBoundingClientRect().top;
      if(top <= limit && top > nearest){ nearest = top; currentLink = links[i]; }
    });
    links.forEach(a=>a.classList.toggle('is-current', a === currentLink));
  }
  window.addEventListener('scroll', onScroll, { passive:true });
  onScroll();
})();

/* ---------- spotlight do cursor ---------- */
(function(){
  const sp = document.getElementById('spotlight');
  if(!sp || reduceMotion) return;
  let tx=0, ty=0, cx=0, cy=0;
  window.addEventListener('pointermove', e=>{ tx=e.clientX; ty=e.clientY; }, { passive:true });
  (function tick(){
    cx += (tx-cx)*.09; cy += (ty-cy)*.09;
    sp.style.setProperty('--mx', cx+'px');
    sp.style.setProperty('--my', cy+'px');
    requestAnimationFrame(tick);
  })();
})();

/* ---------- copiar cor / nome ---------- */
function copyText(txt){
  const show = ()=>{
    const t = document.getElementById('toast');
    t.textContent = txt + ' copiado';
    t.style.opacity='1'; t.style.transform='translateX(-50%) translateY(0)';
    clearTimeout(window.__toastT);
    window.__toastT = setTimeout(()=>{ t.style.opacity='0'; t.style.transform='translateX(-50%) translateY(20px)'; }, 1600);
  };
  if(navigator.clipboard && window.isSecureContext){ navigator.clipboard.writeText(txt).then(show).catch(show); }
  else{
    const ta=document.createElement('textarea'); ta.value=txt; ta.style.position='fixed'; ta.style.opacity='0';
    document.body.appendChild(ta); ta.select();
    try{ document.execCommand('copy'); }catch(e){}
    ta.remove(); show();
  }
}
document.querySelectorAll('[data-copy]').forEach(el=>{
  el.addEventListener('click',()=>copyText(el.dataset.copy));
});

/* ---------- select customizado ---------- */
function toggleSelect(btn){
  const cs = btn.closest('.cs');
  const willOpen = !cs.classList.contains('open');
  document.querySelectorAll('.cs.open').forEach(o=>{
    o.classList.remove('open');
    o.querySelector('.cs-trigger').setAttribute('aria-expanded','false');
  });
  if(willOpen){ cs.classList.add('open'); btn.setAttribute('aria-expanded','true'); }
}
function pickOption(opt){
  const cs = opt.closest('.cs');
  cs.querySelectorAll('.cs-option').forEach(o=>o.setAttribute('aria-selected','false'));
  opt.setAttribute('aria-selected','true');
  cs.querySelector('.cs-value').textContent = opt.dataset.value;
  cs.classList.remove('open');
  cs.querySelector('.cs-trigger').setAttribute('aria-expanded','false');
}
document.addEventListener('click', e=>{
  document.querySelectorAll('.cs.open').forEach(cs=>{
    if(!cs.contains(e.target)){
      cs.classList.remove('open');
      cs.querySelector('.cs-trigger').setAttribute('aria-expanded','false');
    }
  });
});

/* ---------- switch / check / radio ---------- */
function toggleSwitch(el){
  const on = el.classList.toggle('on');
  el.setAttribute('aria-checked', String(on));
}
function toggleCheck(el){ if(el) el.classList.toggle('on'); }
function pickRadio(label){
  const group = label.closest('[data-radio-group]');
  group.querySelectorAll('.radio').forEach(r=>r.classList.remove('on'));
  label.querySelector('.radio').classList.add('on');
}

/* ---------- modal ---------- */
let lastFocus = null;
function openModal(){
  lastFocus = document.activeElement;
  const m = document.getElementById('modal');
  if(!m) return;                       /* nem toda página monta o modal */
  m.style.display = 'flex';
  requestAnimationFrame(()=>{
    m.querySelector('.modal-backdrop').style.opacity = '1';
    const p = m.querySelector('.modal-panel');
    p.style.opacity = '1'; p.style.transform = 'scale(1)';
    p.querySelector('button').focus();
  });
}
function closeModal(){
  const m = document.getElementById('modal');
  if(!m || m.style.display !== 'flex') return;
  m.querySelector('.modal-backdrop').style.opacity = '0';
  const p = m.querySelector('.modal-panel');
  p.style.opacity = '0'; p.style.transform = 'scale(.95)';
  setTimeout(()=>{ m.style.display = 'none'; if(lastFocus) lastFocus.focus(); }, 420);
}
document.addEventListener('keydown', e=>{ if(e.key === 'Escape') closeModal(); });
