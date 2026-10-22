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

  /* 3–5. Desktop story (Figma recording 11–25s): hero, intro and features share one pinned screen.
     The kiosk stays still while the chat changes around it, and only moves at set steps.
     Scrolling past a threshold plays the next step at its own speed (it never stops halfway);
     scrolling back plays it in reverse. Only transforms and opacity animate. */
  scenes.push(({ isDesktop }) => {
    if (!isDesktop) return;
    const story = $('.story');
    const introKiosk = $('#intro .kiosk-device');
    const featuresKiosk = $('#features .kiosk-device');
    const featuresHeader = $('#features .chat-section-header');
    const featuresStage = $('#features .feature-stage-wrap');
    const heroImg = $('img', hero.avatar);
    const intro = {
      question: $('#intro .msg-row--user'),
      headline: $('#intro .header-pill--ai'),
      rest: [$('#intro .bubble-lead'), $('#intro .intro-actions')]
    };
    const featuresHeadline = $('.header-pill--ai', featuresHeader);
    const left = $$('#features .left-col .feature-item');
    const right = $$('#features .right-col .feature-item');

    const header = $('.site-header');
    const setHeaderHeight = () => story.style.setProperty('--header-h', `${header.offsetHeight}px`);
    story.classList.add('is-staged');
    setHeaderHeight();

    const traveller = featuresKiosk.cloneNode(true);
    traveller.removeAttribute('data-anim');
    traveller.classList.add('kiosk-traveller');
    traveller.setAttribute('aria-hidden', 'true');
    story.appendChild(traveller);
    gsap.set(traveller, { autoAlpha: 0 });
    const fitTraveller = () => gsap.set(traveller, { width: featuresKiosk.offsetWidth });
    fitTraveller();

    // Positions inside the story, unaffected by scrolling or pinning
    const within = (el) => {
      const s = story.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      return { x: r.left - s.left, y: r.top - s.top, width: r.width, height: r.height };
    };
    // Kiosk resting on a slot (the slot kiosks stay hidden as layout guides)
    const onSlot = (slot, lift = () => 0) => {
      const box = () => within(slot);
      // The features slot rides on the rising stage; measure it as if the stage hadn't moved yet
      const stageShift = () => (featuresStage.contains(slot) ? gsap.getProperty(featuresStage, 'y') : 0);
      return {
        x: () => box().x,
        y: () => box().y - stageShift() - lift(),
        scale: () => box().width / traveller.offsetWidth
      };
    };
    // Kiosk screen covering the hero avatar, so the frame can form around it in place
    const avatarFit = () => {
      const img = within(heroImg);
      const scale = img.height / $('.kiosk-screen', traveller).offsetHeight;
      return { x: img.x + img.width / 2 - (traveller.offsetWidth * scale) / 2, y: img.y - 10 * scale, scale };
    };
    // Distance that lines one element up with another (ignoring its current transform)
    const shift = (el, target, axis) => () => {
      const from = el.getBoundingClientRect();
      const to = target.getBoundingClientRect();
      const current = gsap.getProperty(el, axis);
      return axis === 'x' ? to.right - (from.right - current) : to.top - (from.top - current);
    };
    // Header out: the feature stage and kiosk rise into its space (as in the recording)
    const rise = () => featuresHeader.offsetHeight + parseFloat(getComputedStyle(featuresHeader).marginBottom);
    const towardKiosk = (i, el) => {
      const k = featuresKiosk.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      return (k.left + k.width / 2 - (r.left + r.width / 2)) * 0.6;
    };
    const features = [...left, ...right];

    // Starting state of everything the story reveals. Set up front and animated with to() tweens:
    // fromTo() tweens that start later in a paused timeline don't restore themselves when it rewinds.
    // Re-applied on refresh (sizes and positions change with the window).
    const applyStart = () => {
      gsap.set(traveller, { autoAlpha: 0, ...avatarFit() });
      gsap.set([intro.question, intro.headline, ...intro.rest, featuresHeadline], { autoAlpha: 0, x: 0, y: 0 });
      gsap.set([intro.headline, featuresHeadline], { scale: 0.9, transformOrigin: 'left bottom', color: 'rgba(255, 255, 255, 0)' });
      gsap.set(intro.rest, { y: 16 });
      gsap.set(featuresStage, { y: 0 });
      gsap.set(features, { autoAlpha: 0, x: 0 });
      gsap.set(features, { x: towardKiosk });
    };
    applyStart();

    const bubbleIn = (tl, el, at) => tl
      .to(el, { autoAlpha: 1, scale: 1, duration: MOTION.base, ease: 'back.out(1.6)' }, at)
      .to(el, { color: '#FFFFFF', duration: MOTION.bubbleText, ease: 'none' }, '-=0.2');

    // Tweens start at 0.01 so resting on the first step never touches the hero the opening is building
    const tl = gsap.timeline({ paused: true, defaults: { ease: MOTION.ease } });
    tl.addLabel('hero', 0)

      // Step 1: the card dissolves; the avatar and both messages stay where they are
      .to(hero.surface, { '--hero-surface': 0, duration: 0.6, ease: 'none' }, 0.01)
      .to([hero.top, hero.composer], { autoAlpha: 0, duration: 0.5 }, 0.01)
      // Step 2: the kiosk frame forms around the avatar, in place
      .to(traveller, { autoAlpha: 1, ...onSlot(introKiosk), duration: MOTION.slow, ease: MOTION.easeInOut }, 0.5)
      .to(hero.avatar, { autoAlpha: 0, duration: 0.4 }, 0.5)
      .addLabel('kiosk')

      // Step 3: the greeting leaves, the question moves up to the intro, the intro answers
      .to(hero.greeting, { autoAlpha: 0, y: -40, duration: 0.4 }, 'kiosk')
      .to(hero.question, {
        x: shift(hero.question, intro.question, 'x'), y: shift(hero.question, intro.question, 'y'),
        duration: 0.6, ease: MOTION.easeInOut
      }, 'kiosk+=0.1')
      .set(intro.question, { autoAlpha: 1 }, 'kiosk+=0.7')
      .set(hero.question, { autoAlpha: 0 }, 'kiosk+=0.7');
    bubbleIn(tl, intro.headline, 'kiosk+=0.8')
      .to(intro.rest, { autoAlpha: 1, y: 0, duration: MOTION.base, stagger: 0.25 }, '-=0.1')
      .addLabel('intro')

      // Step 4: the intro moves out, the kiosk glides to the centre, the features headline appears
      .to([intro.question, intro.headline, ...intro.rest], { autoAlpha: 0, y: -50, duration: 0.4, stagger: 0.05, ease: 'power2.in' }, 'intro')
      .to(traveller, { ...onSlot(featuresKiosk), duration: MOTION.slow, ease: MOTION.easeInOut }, 'intro+=0.2');
    bubbleIn(tl, featuresHeadline, 'intro+=0.8')
      .addLabel('features')

      // Step 5: the headline moves off, everything rises, the features slide out from behind the kiosk
      .to(featuresHeadline, { y: -40, autoAlpha: 0, duration: 0.4, ease: 'power2.in' }, 'features')
      .to(featuresStage, { y: () => -rise(), duration: 0.6, ease: MOTION.easeInOut }, 'features+=0.1')
      .to(traveller, { ...onSlot(featuresKiosk, rise), duration: 0.6, ease: MOTION.easeInOut }, 'features+=0.1');
    left.forEach((el, i) => {
      tl.to([el, right[i]].filter(Boolean), { autoAlpha: 1, x: 0, duration: 0.7 }, `features+=${0.5 + i * MOTION.stagger}`);
    });
    tl.addLabel('fan');

    // Scroll thresholds (share of the pinned distance) at which each step starts playing
    const steps = [['hero', 0], ['kiosk', 0.05], ['intro', 0.25], ['features', 0.5], ['fan', 0.72]];
    const stepAt = (progress) => steps.reduce((found, [, at], i) => (progress >= at ? i : found), 0);
    let current = 0;
    let playhead;
    const goTo = (index, instant) => {
      if (index === current && !instant) return;
      current = index;
      const label = steps[index][0];
      playhead?.kill();
      if (instant) {
        tl.seek(label);
        return;
      }
      // Natural speed for one step; several steps at once (fast scrolling) are compressed
      const distance = Math.abs(tl.labels[label] - tl.time());
      playhead = tl.tweenTo(label, { duration: Math.min(distance, 1.8), ease: 'none' });
    };

    const pin = ScrollTrigger.create({
      trigger: story,
      start: () => `top ${header.offsetHeight}px`,
      end: '+=300%',
      pin: true,
      anticipatePin: 1,
      onUpdate: self => goTo(stepAt(self.progress)),
      onRefresh: self => {
        // Rewind with the old measurements, re-measure the starting state, then return to the step
        playhead?.kill();
        tl.seek(0);
        setHeaderHeight();
        fitTraveller();
        applyStart();
        tl.invalidate();
        goTo(stepAt(self.progress), true);
      }
    });

    // In-page links to the intro and features land on their step inside the pinned story
    const stepLinks = { '#intro': 2, '#features': 4 };
    const stepScroll = (index) => pin.start + (pin.end - pin.start) * (steps[index][1] + 0.04);
    const onStepLink = (e) => {
      const link = e.target.closest('a[href^="#"]');
      const index = link && stepLinks[link.getAttribute('href')];
      if (index === undefined) return;
      e.preventDefault();
      e.stopPropagation(); // capture phase: main.js's smooth scroll would aim at the layer instead
      scrollTo({ top: stepScroll(index), behavior: 'smooth' });
      history.replaceState(null, '', link.getAttribute('href'));
    };
    document.addEventListener('click', onStepLink, true);
    if (location.hash in stepLinks) requestAnimationFrame(() => scrollTo(0, stepScroll(stepLinks[location.hash])));

    return () => {
      document.removeEventListener('click', onStepLink, true);
      traveller.remove();
      story.classList.remove('is-staged');
    };
  });

  // Phones: no pinned story; each kiosk rises in place, the chats play and the features appear in turn
  scenes.push(({ isMobile }) => {
    if (!isMobile) return;
    chatThread($('#intro .intro-thread'), { start: 'top 70%' });
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
