/* =====================================================
   Autopilot Channels — interactions and motion
   Lenis (smooth scroll) + GSAP + ScrollTrigger
   ===================================================== */

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

gsap.registerPlugin(ScrollTrigger);

/* 1. Smooth scroll with Lenis, wired into the GSAP ticker */
const lenis = new Lenis({
  duration: 1.1,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: !prefersReducedMotion,
});
function raf(time) {
  lenis.raf(time);
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);
lenis.on('scroll', ScrollTrigger.update);


/* 2. Hero particles canvas — blue tinted to match theme */
(function initParticles() {
  if (prefersReducedMotion) return;
  const canvas = document.getElementById('particles');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let w, h, particles = [];
  function resize() {
    w = canvas.width  = canvas.offsetWidth  * devicePixelRatio;
    h = canvas.height = canvas.offsetHeight * devicePixelRatio;
  }
  function create() {
    particles = [];
    const count = Math.floor((canvas.offsetWidth * canvas.offsetHeight) / 12000);
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: (Math.random() * 1.4 + 0.4) * devicePixelRatio,
        vx: (Math.random() - 0.5) * 0.15 * devicePixelRatio,
        vy: (Math.random() - 0.5) * 0.15 * devicePixelRatio,
        phase: Math.random() * Math.PI * 2,
        // small chance to be a brighter blue accent particle
        accent: Math.random() < 0.18,
      });
    }
  }
  function draw() {
    ctx.clearRect(0, 0, w, h);
    const t = performance.now() / 1000;
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = w; else if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h; else if (p.y > h) p.y = 0;
      const alpha = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 1.5 + p.phase));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      if (p.accent) {
        // electric blue accent particles
        ctx.fillStyle = `rgba(122, 185, 255, ${alpha * 0.85})`;
        ctx.shadowColor = 'rgba(79, 158, 255, 0.6)';
        ctx.shadowBlur  = 6 * devicePixelRatio;
      } else {
        ctx.fillStyle = `rgba(200, 220, 255, ${alpha * 0.55})`;
        ctx.shadowBlur = 0;
      }
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    requestAnimationFrame(draw);
  }
  resize(); create(); draw();
  window.addEventListener('resize', () => { resize(); create(); });
})();


/* 3. Hero entry animation — translateY + scale + opacity */
if (!prefersReducedMotion) {
  gsap.set('[data-anim="rise"]', { y: 80, opacity: 0, scale: 0.94 });
  gsap.to('[data-anim="rise"]', {
    y: 0, opacity: 1, scale: 1,
    duration: 1.1,
    ease: 'power3.out',
    stagger: 0.12,
    delay: 0.2,
  });
} else {
  // make sure hero content shows even with FOUC guard active
  document.querySelectorAll('[data-anim="rise"]').forEach((el) => {
    el.style.opacity = 1;
    el.style.transform = 'none';
  });
}


/* 4. Generic fade-in for sections coming into view */
gsap.utils.toArray(
  '.problem-card, .story-text p, .stack-item, ' +
  '.proof-card, .for-col, ' +
  '.problem h2, .story h2, .testimonials h2, ' +
  '.stack h2, .for-who h2, .faq h2, .final-cta h2'
).forEach((el) => {
  gsap.from(el, {
    y: prefersReducedMotion ? 0 : 40,
    opacity: 0,
    duration: prefersReducedMotion ? 0.3 : 0.9,
    ease: 'power2.out',
    scrollTrigger: { trigger: el, start: 'top 88%' }
  });
});


/* 7. FAQ — refresh ScrollTrigger when an item opens or closes */
document.querySelectorAll('.faq-item').forEach((item) => {
  item.addEventListener('toggle', () => ScrollTrigger.refresh());
});


/* 8. Smooth anchor links via Lenis */
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const el = document.querySelector(id);
    if (!el) return;
    e.preventDefault();
    lenis.scrollTo(el, { offset: -40, duration: prefersReducedMotion ? 0 : 1.2 });
  });
});


/* 9. VSL — visual feedback on play (placeholder until real video is embedded) */
(function vslHandler() {
  const vsl = document.getElementById('vsl');
  if (!vsl) return;
  const playBtn = vsl.querySelector('.vsl-play');
  const overlay = vsl.querySelector('.vsl-overlay');
  if (!playBtn) return;
  vsl.addEventListener('click', () => {
    vsl.classList.add('playing');
    if (overlay) overlay.textContent = 'Embed your YouTube/Vimeo iframe here.';
    playBtn.style.opacity = '0.4';
    playBtn.style.pointerEvents = 'none';
  });
})();


/* 10. Countdown timer — persists across reloads via localStorage so each
       visitor gets a real 48h window from their first visit */
(function countdown() {
  const HOURS = 48;
  const KEY = 'fe_deadline';

  const h = document.getElementById('cd-h');
  const m = document.getElementById('cd-m');
  const s = document.getElementById('cd-s');
  if (!h || !m || !s) return;

  let deadline;
  try {
    const stored = parseInt(localStorage.getItem(KEY), 10);
    if (stored && stored > Date.now()) {
      deadline = stored;
    } else {
      deadline = Date.now() + HOURS * 3600 * 1000;
      localStorage.setItem(KEY, String(deadline));
    }
  } catch (e) {
    // private mode / storage blocked — fall back to in-memory
    deadline = Date.now() + HOURS * 3600 * 1000;
  }

  function tick() {
    let diff = deadline - Date.now();
    // evergreen reset — never let the timer show 00:00:00
    if (diff <= 1000) {
      deadline = Date.now() + HOURS * 3600 * 1000;
      try { localStorage.setItem(KEY, String(deadline)); } catch (e) {}
      diff = deadline - Date.now();
    }
    const hh = Math.floor(diff / 3600000);
    const mm = Math.floor((diff % 3600000) / 60000);
    const ss = Math.floor((diff % 60000) / 1000);
    h.textContent = String(hh).padStart(2, '0');
    m.textContent = String(mm).padStart(2, '0');
    s.textContent = String(ss).padStart(2, '0');
  }
  tick();
  setInterval(tick, 1000);
})();


/* 11b. Proof lightbox — click any screenshot to view full size */
(function proofLightbox() {
  const lb = document.getElementById('proofLightbox');
  if (!lb) return;
  const lbImg = document.getElementById('proofLightboxImg');
  const closeBtn = lb.querySelector('.close');

  document.querySelectorAll('.proof-card').forEach((card) => {
    card.addEventListener('click', () => {
      const img = card.querySelector('img');
      if (!img) return;
      lbImg.src = img.src;
      lbImg.alt = img.alt || '';
      lb.classList.add('open');
      lb.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    });
  });

  function close() {
    lb.classList.remove('open');
    lb.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    lbImg.src = '';
  }
  lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
  closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && lb.classList.contains('open')) close(); });
})();


/* 11. Header dynamic shadow — subtle elevation on the urgency bar when scrolled */
(function urgencyShadow() {
  const bar = document.querySelector('.urgency-bar');
  if (!bar) return;
  let last = 0;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    if (y > 4 && last <= 4) bar.classList.add('scrolled');
    else if (y <= 4 && last > 4) bar.classList.remove('scrolled');
    last = y;
  }, { passive: true });
})();
