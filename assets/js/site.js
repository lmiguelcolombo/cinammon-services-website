/* ============================================================
   CINNAMON SERVICES — COMPORTAMENTO DE PÁGINA
   Depende de cinnamon.js (design system), que já expõe
   reduceMotion, scrollToTarget, toggleSelect e pickOption.
   ============================================================ */

/* ---------- menu mobile ----------
   O DS esconde .topnav abaixo de 1024px; o drawer é o substituto.
   Trava o scroll do body porque o Lenis continua rodando por baixo. */
(function mobileNav(){
  const toggle = document.getElementById('navToggle');
  const drawer = document.getElementById('navDrawer');
  if(!toggle || !drawer) return;

  function setOpen(open){
    drawer.classList.toggle('open', open);
    document.body.classList.toggle('nav-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    drawer.setAttribute('aria-hidden', String(!open));
    toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    toggle.innerHTML = '<i data-lucide="' + (open ? 'x' : 'menu') + '" class="w-5 h-5"></i>';
    lucide.createIcons({ attrs:{ 'stroke-width':1.5 } });
    /* lenis é `let` de escopo de script: existe como binding, não em window */
    if(typeof lenis !== 'undefined' && lenis) open ? lenis.stop() : lenis.start();
  }

  toggle.addEventListener('click', ()=> setOpen(!drawer.classList.contains('open')));
  const closeBtn = drawer.querySelector('.drawer-close');
  if(closeBtn) closeBtn.addEventListener('click', ()=> setOpen(false));
  drawer.querySelectorAll('a').forEach(a=> a.addEventListener('click', ()=> setOpen(false)));
  document.addEventListener('keydown', e=>{
    if(e.key === 'Escape' && drawer.classList.contains('open')) setOpen(false);
  });
  /* volta ao desktop com o drawer aberto → fecha, senão o body fica travado */
  matchMedia('(min-width:1025px)').addEventListener('change', e=>{ if(e.matches) setOpen(false); });
})();

/* ---------- FAQ ----------
   Anima altura em px (height:auto não é animável) e devolve para
   auto no fim, para o item acompanhar reflow de fonte ou resize. */
(function faq(){
  const items = [...document.querySelectorAll('.faq-item')];
  if(!items.length) return;

  function close(item){
    const a = item.querySelector('.faq-a');
    a.style.height = a.scrollHeight + 'px';
    requestAnimationFrame(()=>{ a.style.height = '0px'; });
    item.classList.remove('open');
    item.querySelector('.faq-q').setAttribute('aria-expanded','false');
  }

  function open(item){
    const a = item.querySelector('.faq-a');
    a.style.height = a.scrollHeight + 'px';
    item.classList.add('open');
    item.querySelector('.faq-q').setAttribute('aria-expanded','true');
    a.addEventListener('transitionend', function done(e){
      if(e.propertyName !== 'height') return;
      if(item.classList.contains('open')) a.style.height = 'auto';
      a.removeEventListener('transitionend', done);
    });
  }

  items.forEach(item=>{
    item.querySelector('.faq-q').addEventListener('click', ()=>{
      const isOpen = item.classList.contains('open');
      items.forEach(o=>{ if(o !== item && o.classList.contains('open')) close(o); });
      isOpen ? close(item) : open(item);
    });
  });
})();

/* ---------- formulário ----------
   Validação no envio (o novalidate desliga o balão nativo, que ignora
   a tipografia do sistema). O envio de verdade ainda precisa de endpoint. */
(function contact(){
  const form   = document.getElementById('contactForm');
  const status = document.getElementById('formStatus');
  if(!form) return;

  const required = [...form.querySelectorAll('[required]')];

  required.forEach(f=>{
    f.addEventListener('input', ()=>{
      f.classList.remove('is-error');
      if(status) status.textContent = '';
    });
  });

  function valid(f){
    if(!f.value.trim()) return false;
    if(f.type === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.value.trim());
    if(f.type === 'tel')   return f.value.replace(/\D/g,'').length >= 10;
    return true;
  }

  form.addEventListener('submit', e=>{
    e.preventDefault();
    const bad = required.filter(f=>!valid(f));
    required.forEach(f=> f.classList.toggle('is-error', bad.includes(f)));

    if(bad.length){
      if(status){
        status.style.color = 'var(--danger)';
        status.textContent = bad.length === 1
          ? 'falta preencher um campo'
          : 'faltam ' + bad.length + ' campos';
      }
      bad[0].focus();
      return;
    }

    /* TODO (integração): trocar por um POST para o endpoint escolhido.
       Os dados já saem prontos em payload.                              */
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.frente = form.querySelector('#csFrente .cs-value')?.textContent.trim() || '';
    console.info('[cinnamon] contato pronto para envio', payload);

    form.querySelectorAll('.field').forEach(f=> f.classList.add('is-success'));
    if(status){
      status.style.color = 'var(--success)';
      status.textContent = 'recebido — retornamos pelo WhatsApp';
    }
  });
})();

/* ---------- máscara leve de telefone ---------- */
(function phoneMask(){
  const el = document.getElementById('f-whats');
  if(!el) return;
  el.addEventListener('input', ()=>{
    const d = el.value.replace(/\D/g,'').slice(0,11);
    el.value = d.length <= 2  ? d
             : d.length <= 6  ? '(' + d.slice(0,2) + ') ' + d.slice(2)
             : d.length <= 10 ? '(' + d.slice(0,2) + ') ' + d.slice(2,6) + '-' + d.slice(6)
                              : '(' + d.slice(0,2) + ') ' + d.slice(2,7) + '-' + d.slice(7);
  });
})();

/* ---------- parallax leve nas faixas de seção ----------
   Só o suficiente para a página ter profundidade; o grão e a aurora
   já fazem o trabalho pesado. */
if(window.gsap && window.ScrollTrigger && !reduceMotion){
  gsap.utils.toArray('.sec .dotgrid').forEach(el=>{
    gsap.to(el, {
      yPercent: 12, ease: 'none',
      scrollTrigger:{ trigger: el.closest('.sec'), start:'top bottom', end:'bottom top', scrub: true }
    });
  });
}
