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

  // Concierge bubble inside a stepped timeline: the blue shape grows, then its text fades in
  // (starting state set by the scene: autoAlpha 0, scale 0.9, transparent text)
  const bubbleIn = (tl, el, at) => tl
    .to(el, { autoAlpha: 1, scale: 1, duration: MOTION.base, ease: 'back.out(1.6)' }, at)
    .to(el, { color: '#FFFFFF', duration: MOTION.bubbleText, ease: 'none' }, '-=0.2');

  // Pinned scenes sit right under the sticky header (--header-h feeds --stage-h in the CSS)
  const siteHeader = $('.site-header');
  const setHeaderHeight = () => root.style.setProperty('--header-h', `${siteHeader.offsetHeight}px`);

  /* Scroll scene: pins `trigger` under the header and ties `tl` to the scroll. The scene moves
     only while the visitor scrolls (with a short, smooth catch-up), stops the moment they stop
     and runs backwards when they scroll up; nothing plays on its own. Each second of the
     timeline takes PACE of a screen to scroll through, so one wheel notch moves it a little.
     The scene never unpins before its last moment has played; `tail` keeps it pinned after that
     (the next section can slide up over it). `beforeMove` runs before the timeline first moves
     (the story finishes the opening there, so the two never overlap); `onUpdate` gets the
     timeline's time as it changes. An optional `exit` timeline plays over the tail, also with
     the scroll, as the scene leaves. */
  const PACE = 0.65; // screen heights of scrolling per second of animation
  const scrollScene = ({ trigger, tl, exit, tail = () => 0, beforeMove = () => {}, onUpdate = () => {}, onRefresh = () => {} }) => {
    const span = () => tl.duration() * innerHeight * PACE;
    let pin;
    pin = ScrollTrigger.create({
      trigger,
      start: () => `top ${siteHeader.offsetHeight}px`,
      end: () => `+=${span() + tail()}`,
      pin: true,
      anticipatePin: 1,
      onRefresh: (self) => { pin = self; } // the first refresh runs before create() returns
    });
    // Measured from the pin (refreshed first): measuring the pinned element itself would count its pin spacing
    const scrub = ScrollTrigger.create({
      trigger,
      start: () => pin.start,
      end: () => pin.start + span(),
      animation: tl,
      scrub: 0.5,
      onUpdate: (self) => {
        if (self.progress > 0) beforeMove();
      },
      onRefresh: (self) => {
        // Rewind with the old measurements (the exit first: it ran last), re-measure the starting
        // state, then return to the scroll position
        exit?.progress(0);
        tl.progress(0);
        setHeaderHeight();
        onRefresh();
        tl.invalidate();
        if (self.progress > 0) beforeMove();
        tl.progress(self.progress);
        exit?.invalidate();
      }
    });
    tl.eventCallback('onUpdate', () => onUpdate(tl.time()));
    // The exit runs over the tail. It starts from wherever things are when the visitor gets there
    // (questions may have been moved by hand), so it re-measures each time it is entered from above.
    if (exit) {
      ScrollTrigger.create({
        trigger,
        start: () => pin.start + span(),
        end: () => pin.start + span() + tail(),
        animation: exit,
        scrub: 0.5,
        onEnter: () => exit.invalidate(),
        onRefresh: (self) => exit.progress(self.progress)
      });
    }
    return { pin, scrub };
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
  let finishOpening = () => {};

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
      finishOpening = () => {};
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
    finishOpening = finish;

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
     The timeline moves with the scroll (scrollScene) and stops when the scroll stops.
     Only transforms and opacity animate. */
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

    // The inbox section slides up over the pinned story once its last step has played
    const next = $('#problem');
    story.classList.add('is-staged');
    next.classList.add('slides-over');
    setHeaderHeight();

    const traveller = featuresKiosk.cloneNode(true);
    traveller.removeAttribute('data-anim');
    traveller.classList.add('kiosk-traveller');
    traveller.setAttribute('aria-hidden', 'true');
    story.appendChild(traveller);
    gsap.set(traveller, { autoAlpha: 0 });

    // Copy of the card surface (with its 1px edge) that shrinks into the kiosk screen; first in the
    // story so it paints under the avatar and messages
    const morphEdge = Object.assign(document.createElement('div'), { className: 'story-morph story-morph--edge' });
    const morph = Object.assign(document.createElement('div'), { className: 'story-morph' });
    story.prepend(morphEdge, morph);
    const kioskBody = {
      screen: $('.kiosk-screen', traveller),
      avatar: $('.kiosk-avatar', traveller),
      base: $('.kiosk-base', traveller),
      logo: $('.kiosk-logo', traveller)
    };
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
    // Clip variables for a rounded box, inset from the story's edges (grow = the 1px edge layer)
    const clipTo = (box, radius, grow = 0) => {
      const s = story.getBoundingClientRect();
      return {
        '--clip-top': `${box.y - grow}px`,
        '--clip-right': `${s.width - (box.x + box.width) - grow}px`,
        '--clip-bottom': `${s.height - (box.y + box.height) - grow}px`,
        '--clip-left': `${box.x - grow}px`,
        '--clip-radius': `${radius + grow}px`
      };
    };
    // Same, measured when the tween starts (function-based values, re-measured on refresh)
    const clipToLater = (boxFn, radius, grow) => Object.fromEntries(
      Object.keys(clipTo({ x: 0, y: 0, width: 0, height: 0 }, 0)).map(key => [key, () => clipTo(boxFn(), radius, grow)[key]])
    );
    const cardBox = () => within(hero.surface);
    const screenBox = () => within($('.kiosk-screen', introKiosk));
    // Hero avatar scaled onto the exact pixels the kiosk shows, so the hand-over can't be seen.
    // Frame 174.png (kiosk) is Avatar.png (hero) scaled by 0.2520 and offset (-6.5, 59.5) px,
    // measured by matching the two files; re-measure if either artwork changes.
    const HERO_ART = { width: 1672, height: 2495 };
    const KIOSK_ART = { width: 414, height: 639, scale: 0.2520, x: -6.5, y: 59.5 };
    const avatarFit = () => {
      const img = within(heroImg);
      const box = within(kioskBody.avatar); // the moving kiosk's own avatar, resting on the intro slot
      // Both images use object-fit: cover with object-position: 50% 0
      const heroScale = Math.max(img.width / HERO_ART.width, img.height / HERO_ART.height);
      const heroLeft = img.x + (img.width - HERO_ART.width * heroScale) / 2;
      const kioskScale = Math.max(box.width / KIOSK_ART.width, box.height / KIOSK_ART.height);
      const artLeft = box.x + (box.width - KIOSK_ART.width * kioskScale) / 2 + KIOSK_ART.x * kioskScale;
      const artTop = box.y + KIOSK_ART.y * kioskScale;
      const scale = (KIOSK_ART.scale * kioskScale) / heroScale;
      // The hero image runs further down than the kiosk shows: clip it at the screen's bottom edge
      const shownRows = (box.height / kioskScale - KIOSK_ART.y) / KIOSK_ART.scale;
      return {
        x: artLeft - img.x - (heroLeft - img.x) * scale,
        y: artTop - img.y,
        scale,
        clip: Math.max(0, img.height - shownRows * heroScale)
      };
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
      const card = cardBox();
      gsap.set(traveller, { autoAlpha: 0, x: onSlot(introKiosk).x(), y: onSlot(introKiosk).y(), scale: onSlot(introKiosk).scale() });
      gsap.set(morph, {
        autoAlpha: 0, ...clipTo(card, 28),
        backgroundSize: `${card.width}px ${card.height}px`, backgroundPosition: `${card.x}px ${card.y}px`
      });
      gsap.set(morphEdge, { autoAlpha: 0, ...clipTo(card, 28, 1) });
      gsap.set(heroImg, { '--avatar-clip-bottom': '0px' });
      // The kiosk body forms around the morphed screen: frame, stand and logo fade in over it
      gsap.set(traveller, { backgroundColor: 'rgba(14, 16, 19, 0)', boxShadow: '0 30px 60px rgba(11, 12, 14, 0)' });
      gsap.set(kioskBody.screen, { backgroundImage: 'none' });
      gsap.set([kioskBody.avatar, kioskBody.base, kioskBody.logo], { opacity: 0 });
      gsap.set([intro.question, intro.headline, ...intro.rest, featuresHeadline], { autoAlpha: 0, x: 0, y: 0 });
      gsap.set([intro.headline, featuresHeadline], { scale: 0.9, transformOrigin: 'left bottom', color: 'rgba(255, 255, 255, 0)' });
      gsap.set(intro.rest, { y: 16 });
      gsap.set(featuresStage, { y: 0 });
      gsap.set(features, { autoAlpha: 0, x: 0 });
      gsap.set(features, { x: towardKiosk });
    };
    applyStart();

    // Tweens start at 0.01 so resting on the first step never touches the hero the opening is building
    const tl = gsap.timeline({ paused: true, defaults: { ease: MOTION.ease } });
    tl.addLabel('hero', 0)

      // Step 1: the composer and top bar go; the card surface swaps to its morph copy (same look)
      .to([hero.top, hero.composer], { autoAlpha: 0, duration: 0.35 }, 0.01)
      .to([morph, morphEdge], { autoAlpha: 1, duration: 0.01 }, 0.01)
      .to(hero.surface, { '--hero-surface': 0, duration: 0.01 }, 0.02)
      // Step 2: the card compresses into the kiosk screen and the avatar shrinks with it;
      // the messages stay put. Then the kiosk body forms around the screen (grey → black).
      .to(morph, { ...clipToLater(screenBox, 18, 0), duration: MOTION.slow, ease: MOTION.easeInOut }, 0.15)
      .to(morphEdge, { ...clipToLater(screenBox, 18, 1), duration: MOTION.slow, ease: MOTION.easeInOut }, 0.15)
      .to(heroImg, {
        x: () => avatarFit().x, y: () => avatarFit().y, scale: () => avatarFit().scale,
        '--avatar-clip-bottom': () => `${avatarFit().clip}px`,
        transformOrigin: '0 0', duration: MOTION.slow, ease: MOTION.easeInOut
      }, 0.15)
      .to(hero.avatar, { '--avatar-glow': 0, duration: 0.4, ease: 'none' }, 0.15)
      // the two avatar images cross-fade inside the screen
      .set(traveller, { autoAlpha: 1 }, 0.85)
      .to(kioskBody.avatar, { opacity: 1, duration: 0.15, ease: 'none' }, 0.9)
      .to(hero.avatar, { autoAlpha: 0, duration: 0.15, ease: 'none' }, 0.9)
      // the kiosk screen takes over from the morph copy (same box, same tint)...
      .set(kioskBody.screen, { backgroundImage: 'linear-gradient(180deg, #F5F7FF 0%, #ECEFFB 100%)' }, 1.1)
      .set([morph, morphEdge], { autoAlpha: 0 }, 1.1)
      // ...and the frame, stand and logo form around it (grey → black)
      .to(traveller, { backgroundColor: '#0E1013', boxShadow: '0 30px 60px rgba(11, 12, 14, 0.18)', duration: 0.5, ease: 'power1.inOut' }, 1.1)
      .to(kioskBody.base, { opacity: 1, duration: 0.5, ease: 'power1.inOut' }, 1.1)
      .to(kioskBody.logo, { opacity: 1, duration: 0.3 }, 1.3)
      .addLabel('kiosk')

      // Step 2 (recording 13.5–17s): the greeting leaves, the question moves up to the intro, then
      // the answer grows, the sub-bubble and the buttons follow one at a time
      .to(hero.greeting, { autoAlpha: 0, y: -40, duration: 0.4 }, 'kiosk')
      .to(hero.question, {
        x: shift(hero.question, intro.question, 'x'), y: shift(hero.question, intro.question, 'y'),
        duration: 0.6, ease: MOTION.easeInOut
      }, 'kiosk+=0.1')
      .set(intro.question, { autoAlpha: 1 }, 'kiosk+=0.7')
      .set(hero.question, { autoAlpha: 0 }, 'kiosk+=0.7');
    bubbleIn(tl, intro.headline, 'kiosk+=0.75')
      .to(intro.rest[0], { autoAlpha: 1, y: 0, duration: MOTION.base }, '-=0.1')
      .to(intro.rest[1], { autoAlpha: 1, y: 0, duration: MOTION.base }, '-=0.25')
      .addLabel('intro')

      // Step 3 (18–20s): the intro moves out before the kiosk glides to the centre (so scrolling
      // back never slides the kiosk over the text), then the headline grows
      .to([intro.question, intro.headline, ...intro.rest], { autoAlpha: 0, y: -50, duration: 0.4, stagger: 0.05, ease: 'power2.in' }, 'intro')
      .to(traveller, { ...onSlot(featuresKiosk), duration: MOTION.slow, ease: MOTION.easeInOut }, 'intro+=0.5');
    bubbleIn(tl, featuresHeadline, 'intro+=1.2')
      .addLabel('features')

      // Step 4 (21–23.5s): the headline moves off, everything rises, the features slide out from
      // behind the kiosk row by row
      .to(featuresHeadline, { y: -40, autoAlpha: 0, duration: 0.4, ease: 'power2.in' }, 'features')
      .to(featuresStage, { y: () => -rise(), duration: 0.6, ease: MOTION.easeInOut }, 'features+=0.1')
      .to(traveller, { ...onSlot(featuresKiosk, rise), duration: 0.6, ease: MOTION.easeInOut }, 'features+=0.1');
    left.forEach((el, i) => {
      tl.to([el, right[i]].filter(Boolean), { autoAlpha: 1, x: 0, duration: 0.6 }, `features+=${0.5 + i * 0.25}`);
    });
    tl.addLabel('fan');

    const scene = scrollScene({
      trigger: story,
      tl,
      tail: () => story.offsetHeight, // the inbox section slides up over the finished story
      beforeMove: () => finishOpening(), // scrolling (or a reload restoring the scroll position) ends the opening first
      onRefresh: () => {
        fitTraveller();
        applyStart();
      }
    });

    // In-page links to the intro and features land on their step inside the pinned story
    const stepLinks = { '#intro': 'intro', '#features': 'fan' };
    const onStepLink = (e) => {
      const link = e.target.closest('a[href^="#"]');
      const label = link ? stepLinks[link.getAttribute('href')] : undefined;
      if (label === undefined) return; // not one of the story's links: leave the click alone
      e.preventDefault();
      e.stopPropagation(); // capture phase: main.js's smooth scroll would aim at the layer instead
      scrollTo({ top: scene.scrub.labelToScroll(label), behavior: 'smooth' });
      history.replaceState(null, '', link.getAttribute('href'));
    };
    document.addEventListener('click', onStepLink, true);
    if (location.hash in stepLinks) requestAnimationFrame(() => scrollTo(0, scene.scrub.labelToScroll(stepLinks[location.hash])));

    return () => {
      document.removeEventListener('click', onStepLink, true);
      traveller.remove();
      morph.remove();
      morphEdge.remove();
      story.classList.remove('is-staged');
      next.classList.remove('slides-over');
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
