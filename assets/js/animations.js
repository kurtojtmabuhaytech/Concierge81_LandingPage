// Landing page motion (GSAP + ScrollTrigger, Flip, MorphSVG). Loaded on index.html only.
// Choreography follows the Figma motion recording. Sections that GSAP animates carry data-motion;
// main.js leaves those out of its simple scroll reveal. Elements marked data-anim start hidden
// (see _animations.scss) until a scene reveals them with autoAlpha.
(() => {
  const root = document.documentElement;

  // GSAP failed to load: show everything and let the page work without motion
  if (!window.gsap || !window.ScrollTrigger) {
    root.classList.remove('js-motion');
    document.querySelector('.splash')?.remove();
    return;
  }

  gsap.registerPlugin(ScrollTrigger, Flip, MorphSVGPlugin);

  // Shared timing, read from the Figma motion recording (±0.25s)
  const MOTION = {
    ease: 'power3.out',
    easeInOut: 'power2.inOut',
    fast: 0.3,           // chips, small UI
    base: 0.5,           // bubbles, cards fading in
    slow: 0.8,           // kiosk moves, section morphs
    stagger: 0.18,       // features, list items
    typing: 1.2,         // "concierge is typing…" before a reply
    bubbleText: 0.4      // text fading in after a bubble shape has grown
  };

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Element box in page coordinates, so it doesn't change while scrolling
  const pageBox = (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height };
  };

  // Chat thread: visitor bubble → concierge bubble (shape grows first, then its text) → everything else
  const chatThread = (scope, { trigger = scope, start = 'top 75%' } = {}) => {
    const items = $$('[data-anim]', scope);
    const user = items.filter(el => el.matches('.msg-row--user, .chat-header-row.right'));
    const reply = items.find(el => el.matches('.header-pill--ai'));
    const rest = items.filter(el => !user.includes(el) && el !== reply);
    const tl = gsap.timeline({ scrollTrigger: { trigger, start, once: true } });

    if (user.length) {
      tl.fromTo(user, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: MOTION.base, ease: MOTION.ease });
    }
    if (reply) {
      tl.fromTo(reply, { autoAlpha: 0, scale: 0.9, transformOrigin: 'left bottom' },
        { autoAlpha: 1, scale: 1, duration: MOTION.base, ease: 'back.out(1.6)' }, user.length ? '+=0.15' : 0)
        .fromTo(reply, { color: 'rgba(255, 255, 255, 0)' }, { color: '#FFFFFF', duration: MOTION.bubbleText, ease: 'none' }, '-=0.2');
    }
    if (rest.length) {
      tl.fromTo(rest, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: MOTION.base, ease: MOTION.ease, stagger: 0.15 }, '-=0.1');
    }
    return tl;
  };

  const hero = {
    surface: $('.hero-card'),
    top: $('.hero-card-top'),
    avatar: $('.hero-avatar'),
    greeting: $('#hero .msg-row--ai'),
    question: $('#hero .msg-row--user'),
    composer: $('#hero .chat-composer'),
    controls: $$('#hero .chat-composer [data-anim]')
  };
  const heroParts = [hero.top, hero.avatar, hero.greeting, hero.question, hero.composer, ...hero.controls];

  /* ---- 0–2. Opening screen → hero ---------------------------------------------------------
     Plays on every visit. Runs once, outside matchMedia, so resizing never replays it.
     Scroll, tap or a key skips to the end; a #section link skips it entirely. */
  const runOpening = () => {
    const splash = $('.splash');
    const skipEvents = ['wheel', 'touchstart', 'keydown', 'pointerdown'];
    let done = false;
    let tl;
    let dotsLoop;

    const finish = () => {
      if (done) return;
      done = true;
      skipEvents.forEach(type => removeEventListener(type, finish));
      tl?.kill();
      dotsLoop?.kill();
      splash?.remove();
      gsap.set(heroParts, { autoAlpha: 1, clearProps: 'transform' });
      gsap.set(hero.surface, { '--hero-surface': 1 });
    };

    if (!splash || prefersReducedMotion || location.hash) {
      finish();
      return;
    }

    // Every visit starts at the top with the opening
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    scrollTo(0, 0);
    skipEvents.forEach(type => addEventListener(type, finish, { once: true, passive: true }));

    const msg = $('.splash-msg', splash);
    const bubble = $('.splash-bubble', splash);
    const dots = $('.splash-dots', splash);
    const text = $('.splash-text', splash);
    const caption = $('.splash-caption', splash);
    const heroBubble = $('.bubble', hero.greeting);

    // Bubble sizes: the full greeting, and the small one-line "•••" bubble it grows from
    const style = getComputedStyle(bubble);
    const full = { width: bubble.offsetWidth, height: bubble.offsetHeight };
    const typing = {
      width: dots.offsetWidth + 2 * parseFloat(style.paddingLeft),
      height: parseFloat(style.lineHeight) + 2 * parseFloat(style.paddingTop)
    };
    gsap.set(bubble, typing);
    gsap.set(text, { autoAlpha: 0 });
    dotsLoop = gsap.to($$('i', dots), {
      y: -3, opacity: 0.4, duration: 0.35, ease: 'sine.inOut',
      stagger: { each: 0.12, repeat: -1, yoyo: true }
    });

    tl = gsap.timeline({ onComplete: finish })
      .from(bubble, { autoAlpha: 0, scale: 0.6, transformOrigin: 'left bottom', duration: MOTION.fast, ease: 'back.out(2)' })
      .from(caption, { autoAlpha: 0, duration: MOTION.fast }, '<0.1')
      // typing… then the bubble grows into the greeting
      .to(dots, { autoAlpha: 0, duration: 0.15 }, `+=${MOTION.typing}`)
      .to(bubble, { ...full, duration: MOTION.base, ease: MOTION.easeInOut }, '<')
      .to(caption, { autoAlpha: 0, duration: 0.15 }, '<')
      .call(() => { caption.textContent = 'concierge · 9:12 AM'; })
      .to(caption, { autoAlpha: 1, duration: 0.2 })
      .to(text, { autoAlpha: 1, duration: MOTION.bubbleText }, '<-0.1')
      // hold, then hand the greeting to the hero while the card builds around it
      .addLabel('handoff', '+=0.8')
      .to(splash, { backgroundColor: 'rgba(255, 255, 255, 0)', duration: MOTION.slow, ease: 'none' }, 'handoff')
      .to(msg, {
        x: () => heroBubble.getBoundingClientRect().left - bubble.getBoundingClientRect().left,
        y: () => heroBubble.getBoundingClientRect().top - bubble.getBoundingClientRect().top,
        duration: MOTION.slow, ease: MOTION.easeInOut
      }, 'handoff')
      .fromTo(hero.surface, { '--hero-surface': 0 }, { '--hero-surface': 1, duration: MOTION.slow }, 'handoff')
      .fromTo(hero.avatar, { autoAlpha: 0, scale: 1.04, transformOrigin: '50% 100%' },
        { autoAlpha: 1, scale: 1, duration: MOTION.slow, ease: MOTION.ease }, 'handoff+=0.2')
      .fromTo(hero.top, { autoAlpha: 0 }, { autoAlpha: 1, duration: MOTION.base }, 'handoff+=0.3')
      // the greeting lands: the real hero bubble takes over from the splash copy
      .set(hero.greeting, { autoAlpha: 1 }, `handoff+=${MOTION.slow}`)
      .set(msg, { autoAlpha: 0 }, `handoff+=${MOTION.slow}`)
      .fromTo(hero.composer, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: MOTION.base, ease: MOTION.ease })
      .fromTo(hero.controls, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: MOTION.fast, ease: MOTION.ease, stagger: 0.12 })
      // the visitor "sends" the suggested question
      .fromTo(hero.question, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: MOTION.base, ease: MOTION.ease }, '+=0.3');
  };

  /* ---- Scenes: each is ({ isDesktop, isMobile }) => cleanup?, rebuilt when the breakpoint changes ---- */
  const scenes = [];

  // 3–6. Desktop: one kiosk travels hero avatar → intro kiosk → features kiosk while scrolling
  scenes.push(({ isDesktop }) => {
    if (!isDesktop) return;
    const introKiosk = $('#intro .kiosk-device');
    const featuresKiosk = $('#features .kiosk-device');
    const heroImg = $('img', hero.avatar);

    const traveller = introKiosk.cloneNode(true);
    traveller.removeAttribute('data-anim');
    traveller.classList.add('kiosk-traveller');
    traveller.setAttribute('aria-hidden', 'true');
    document.body.appendChild(traveller);
    gsap.set(traveller, { autoAlpha: 0 });
    const screen = $('.kiosk-screen', traveller);
    const base = $('.kiosk-base', traveller);
    const logo = $('.kiosk-logo', traveller);

    // Where the kiosk sits at each stop; the hero stop has no frame, so it matches the hero image
    const heroStop = () => ({ ...pageBox(heroImg), screen: heroImg.offsetHeight, base: 0, pad: 0 });
    const kioskStop = (kiosk) => () => ({
      ...pageBox(kiosk),
      screen: $('.kiosk-screen', kiosk).offsetHeight,
      base: $('.kiosk-base', kiosk).offsetHeight,
      pad: 10
    });
    const introStop = kioskStop(introKiosk);
    const featuresStop = kioskStop(featuresKiosk);

    const frame = (stop, framed) => ({
      x: () => stop().x, y: () => stop().y, width: () => stop().width,
      paddingTop: () => stop().pad, paddingLeft: () => stop().pad, paddingRight: () => stop().pad,
      backgroundColor: framed ? '#0E1013' : 'rgba(14, 16, 19, 0)',
      borderRadius: framed ? '28px 28px 6px 6px' : '0px 0px 0px 0px',
      boxShadow: `0 30px 60px rgba(11, 12, 14, ${framed ? 0.18 : 0})`
    });
    const parts = (stop, framed) => [
      [screen, { height: () => stop().screen, borderRadius: framed ? 18 : 0 }],
      [base, { height: () => stop().base }]
    ];
    const move = (tl, from, to) => {
      const step = { duration: 1, ease: 'none', immediateRender: false };
      tl.fromTo(traveller, frame(...from), { ...frame(...to), ...step }, 0);
      parts(...from).forEach(([el, vars], i) => tl.fromTo(el, vars, { ...parts(...to)[i][1], ...step }, 0));
      return tl;
    };

    // Hero → intro: the card dissolves and the avatar shrinks into a kiosk frame
    const toIntro = gsap.timeline({
      scrollTrigger: { trigger: '#hero', start: 'top top', endTrigger: introKiosk, end: 'center center', scrub: 0.6, invalidateOnRefresh: true }
    });
    move(toIntro, [heroStop, false], [introStop, true])
      .fromTo(traveller, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.1, immediateRender: false }, 0)
      .fromTo(hero.avatar, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.1, immediateRender: false }, 0)
      .fromTo([hero.composer, hero.top], { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.3, immediateRender: false }, 0)
      .fromTo(hero.surface, { '--hero-surface': 1 }, { '--hero-surface': 0, duration: 0.3, immediateRender: false }, 0)
      .fromTo(logo, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2, immediateRender: false }, 0.8);

    // Intro → features: the kiosk slides to the centre of the feature stage
    move(gsap.timeline({
      scrollTrigger: { trigger: introKiosk, start: 'center center', endTrigger: featuresKiosk, end: 'center center', scrub: 0.6, invalidateOnRefresh: true }
    }), [introStop, true], [featuresStop, true]);

    // Once the kiosk has nearly arrived: the features headline, then the features slide out from
    // behind the kiosk, row by row (left column left, right column right)
    chatThread($('#features .chat-section-header'), { trigger: featuresKiosk, start: 'center 60%' });
    const kioskCentre = () => {
      const r = featuresKiosk.getBoundingClientRect();
      return r.left + r.width / 2;
    };
    const towardKiosk = (i, el) => {
      const r = el.getBoundingClientRect();
      return (kioskCentre() - (r.left + r.width / 2)) * 0.6;
    };
    const fan = gsap.timeline({
      scrollTrigger: { trigger: featuresKiosk, start: 'center 55%', toggleActions: 'play none none reverse', invalidateOnRefresh: true }
    });
    const left = $$('#features .left-col .feature-item');
    const right = $$('#features .right-col .feature-item');
    left.forEach((el, i) => {
      fan.fromTo([el, right[i]].filter(Boolean), { autoAlpha: 0, x: towardKiosk },
        { autoAlpha: 1, x: 0, duration: 0.7, ease: MOTION.ease }, i * MOTION.stagger);
    });

    return () => traveller.remove();
  });

  // Phones: no travelling kiosk; each kiosk rises in place and the features appear in turn
  scenes.push(({ isMobile }) => {
    if (!isMobile) return;
    chatThread($('#features .chat-section-header'));
    $$('#intro .kiosk-device, #features .kiosk-device').forEach(kiosk => {
      gsap.fromTo(kiosk, { autoAlpha: 0, y: 40 }, {
        autoAlpha: 1, y: 0, duration: MOTION.slow, ease: MOTION.ease,
        scrollTrigger: { trigger: kiosk, start: 'top 85%', once: true }
      });
    });
    ScrollTrigger.batch('#features .feature-item', {
      start: 'top 90%',
      once: true,
      onEnter: batch => gsap.fromTo(batch, { autoAlpha: 0, y: 20 },
        { autoAlpha: 1, y: 0, duration: MOTION.base, ease: MOTION.ease, stagger: 0.1 })
    });
  });

  // Intro chat thread (all widths)
  scenes.push(() => {
    chatThread($('#intro .intro-thread'), { start: 'top 70%' });
  });

  runOpening();

  const mm = gsap.matchMedia();
  mm.add(
    {
      isDesktop: '(min-width: 901px) and (prefers-reduced-motion: no-preference)',
      isMobile: '(max-width: 900px) and (prefers-reduced-motion: no-preference)',
      reduceMotion: '(prefers-reduced-motion: reduce)'
    },
    (context) => {
      if (context.conditions.reduceMotion) {
        // No movement: everything visible in its final state
        gsap.set('[data-anim]', { autoAlpha: 1 });
        return;
      }
      const cleanups = scenes.map(scene => scene(context.conditions)).filter(Boolean);
      return () => cleanups.forEach(cleanup => cleanup());
    }
  );

  // Recalculate trigger positions once images (avatar, photos) have their real size
  addEventListener('load', () => ScrollTrigger.refresh());
})();
