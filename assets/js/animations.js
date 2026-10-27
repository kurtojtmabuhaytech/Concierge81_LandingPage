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

  // A refresh always starts over: back to the top with the opening. The browser (and
  // ScrollTrigger) would otherwise restore the old scroll position, and an in-page link may have
  // left a #section in the address bar. Arriving from another page with a #section link (e.g.
  // the blog's "Contact") still goes straight to that section.
  const reloaded = performance.getEntriesByType?.('navigation')[0]?.type === 'reload';
  if (reloaded && location.hash) history.replaceState(null, '', location.pathname + location.search);
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  ScrollTrigger.clearScrollMemory('manual');
  if (!location.hash) scrollTo(0, 0);

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

  // Chat thread (phones): visitor bubble → concierge bubble (shape grows first, then its text) →
  // everything else, moving with the scroll as the thread passes from `start` to `end`
  const chatThread = (scope, { trigger = scope, start = 'top 80%', end = 'top 40%' } = {}) => {
    const items = $$('[data-anim]', scope);
    const user = items.filter(el => el.matches('.msg-row--user, .chat-header-row.right'));
    const reply = items.find(el => el.matches('.header-pill--ai'));
    const rest = items.filter(el => !user.includes(el) && el !== reply);
    const tl = gsap.timeline({ scrollTrigger: { trigger, start, end, scrub: 0.5 } });

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

  // Phones: `targets` move from `from` to their resting state with the scroll as `trigger` passes
  // through the lower part of the screen (one after another when there are several)
  const scrollReveal = (targets, trigger, from, { start = 'top 90%', end = 'top 55%', stagger = 0.15 } = {}) =>
    gsap.fromTo(targets, from, {
      autoAlpha: 1, x: 0, y: 0, ease: 'power2.out', stagger,
      scrollTrigger: { trigger, start, end, scrub: 0.5 }
    });

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
     (the story finishes the opening there, so the two never overlap); `top` is where it pins
     (the story under the site header; the later scenes, after the header has slid away, at the
     very top of the screen); `onUpdate` gets the
     timeline's time as it changes. An optional `exit` timeline plays over the tail, also with
     the scroll, as the scene leaves. */
  const PACE = 0.65; // screen heights of scrolling per second of animation
  const scrollScene = ({ trigger, tl, exit, top = () => 0, tail = () => 0, beforeMove = () => {}, onUpdate = () => {}, onRefresh = () => {} }) => {
    const span = () => tl.duration() * innerHeight * PACE;
    let pin;
    pin = ScrollTrigger.create({
      trigger,
      start: () => `top ${top()}px`,
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
    // One avatar at one size: the moving kiosk shows the hero artwork, and the intro kiosk's
    // screen is sized to the hero avatar (--hero-avatar-w, see _animations.scss), so the avatar
    // only moves during the morph; the kiosk then scales down a little as it glides to the features
    kioskBody.avatar.src = heroImg.currentSrc || heroImg.src;
    kioskBody.avatar.removeAttribute('loading');
    const fitTraveller = () => {
      story.style.setProperty('--hero-avatar-w', `${heroImg.offsetWidth}px`);
      gsap.set(traveller, { width: introKiosk.offsetWidth });
    };
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
    // The hero avatar moves onto the kiosk's own avatar: same artwork, same framing and (the
    // intro kiosk being sized to it) the same size, so the hand-over can't be seen
    const avatarFit = () => {
      const img = within(heroImg);
      const box = within(kioskBody.avatar); // the moving kiosk's own avatar, resting on the intro slot
      const scale = box.width / img.width; // 1, give or take a rounding pixel
      return {
        x: box.x - img.x,
        y: box.y - img.y,
        scale,
        clip: Math.max(0, img.height - box.height / scale) // trimmed at the screen's bottom edge
      };
    };
    // Distance that lines one element up with another (ignoring its current transform)
    const shift = (el, target, axis) => () => {
      const from = el.getBoundingClientRect();
      const to = target.getBoundingClientRect();
      const current = gsap.getProperty(el, axis);
      return axis === 'x' ? to.right - (from.right - current) : to.top - (from.top - current);
    };
    // Features step: with the site header gone, the feature stage and kiosk rise until the kiosk is
    // centred in the whole screen (as in the recording; the story sits under the header's height).
    // A kiosk taller than the screen keeps its top in view and runs off the bottom edge instead.
    const centreLift = () => {
      const slot = within(featuresKiosk);
      const top = siteHeader.offsetHeight + slot.y - gsap.getProperty(featuresStage, 'y');
      return Math.max(0, Math.min(top - (innerHeight - slot.height) / 2, top - innerHeight * 0.04));
    };
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

      // Step 4 (21–24s): the site header slides up off the screen and everything moves up into its
      // space: the headline rides up to the top edge, and the kiosk and features rise to show the
      // whole kiosk; once the kiosk is in place the features slide out from behind it row by row
      .to(siteHeader, { yPercent: -100, duration: 0.6, ease: MOTION.easeInOut }, 'features')
      .to(featuresHeadline, { y: () => -(siteHeader.offsetHeight + featuresHeadline.offsetHeight * 0.45), duration: 0.6, ease: MOTION.easeInOut }, 'features')
      .to(featuresStage, { y: () => -centreLift(), duration: 0.6, ease: MOTION.easeInOut }, 'features+=0.1')
      .to(traveller, { ...onSlot(featuresKiosk, centreLift), duration: 0.6, ease: MOTION.easeInOut }, 'features+=0.1')
      .addLabel('popOut', 'features+=0.7');
    left.forEach((el, i) => {
      tl.to([el, right[i]].filter(Boolean), { autoAlpha: 1, x: 0, duration: 0.7 }, `popOut+=${i * 0.3}`);
    });
    tl.addLabel('fan');

    // The site header stays away for the rest of the page; it comes back only when the visitor
    // scrolls back up to the features step (the header tween above runs back)
    const scene = scrollScene({
      trigger: story,
      tl,
      top: () => siteHeader.offsetHeight,
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
      gsap.set(siteHeader, { clearProps: 'transform' });
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
    chatThread($('#intro .intro-thread'), { start: 'top 75%', end: 'top 35%' });
    chatThread($('#features .chat-section-header'));
    $$('#intro .kiosk-device, #features .kiosk-device').forEach(kiosk => scrollReveal(kiosk, kiosk, { autoAlpha: 0, y: 40 }));
    $$('#features .feature-item').forEach(item => scrollReveal(item, item, { autoAlpha: 0, y: 20 }, { start: 'top 95%', end: 'top 80%' }));
  });

  /* 6–8. Team inbox (Figma recording 24–37s). Desktop: a scroll scene that slides up over the hero
     story. The visitor asks, the concierge answers; the inbox card darkens in and the questions
     rain into a pile; two are lifted out and dropped back (drag demo); then the view moves down
     and "Let me handle the repeats." answers. The questions move by GSAP transforms (smoother
     than CSS variables) and can be picked up and dropped (setupPile). */
  const inbox = {
    section: $('#problem'),
    content: $('#problem > .container'),
    headers: $$('#problem .chat-section-header'),
    card: $('#problem .inbox-card'),
    head: $('#problem .inbox-head'),
    pile: $('#problem .q-pile'),
    tags: $$('#problem .q-tag')
  };
  inbox.float = $('.q-tag--float', inbox.pile);
  inbox.floatCursor = $('svg', inbox.float);
  inbox.open = inbox.tags.find(tag => tag.textContent.trim() === 'What time do you open?');
  // Each question's resting tilt in the pile (degrees, from the CSS)
  inbox.tilt = inbox.tags.map(tag => parseFloat(getComputedStyle(tag).getPropertyValue('--r')) || 0);
  // Where a question rests. The desktop scene drops the floating "Where is the restroom?" into the
  // pile (the demo lifts it out); elsewhere it floats above the pile with its cursor, as designed.
  inbox.floatRest = () => ({ y: 0, rotation: inbox.tilt[inbox.tags.indexOf(inbox.float)] });
  inbox.rest = tag => (tag === inbox.float ? inbox.floatRest() : { y: 0, rotation: inbox.tilt[inbox.tags.indexOf(tag)] });

  /* Inbox questions can be picked up and dropped: let go and a question falls straight down, as
     with gravity, and lands on the question below it (or the bottom of the pile), drifting a
     little in the direction it was thrown and settling with a small bounce. It stays where it
     lands. With reduced motion it simply stays where it is dropped. Runs once, outside matchMedia. */
  inbox.moved = new Set();   // questions resting somewhere other than their place in the pile
  inbox.tosses = new Map();  // a question's running pick-up or fall
  // Puts moved questions back in their places at once (before the scroll animates them again)
  inbox.putBack = (which = inbox.tags) => which.forEach(tag => {
    if (!inbox.moved.has(tag)) return;
    inbox.tosses.get(tag)?.kill();
    tag.classList.remove('is-dragging');
    const rest = inbox.rest(tag);
    gsap.set(tag, { x: 0, y: rest.y, rotation: rest.rotation, scale: 1 });
    inbox.moved.delete(tag);
  });

  const setupPile = () => {
    const { pile, tags } = inbox;
    let topZ = 30;
    gsap.set(tags, { xPercent: -50, x: 0, y: i => inbox.rest(tags[i]).y, rotation: i => inbox.rest(tags[i]).rotation });

    // How far a question falls from where it is let go (shifted sideways by `drift`): onto the
    // highest question underneath it, resting a little into it like the pile does, or onto the
    // bottom of the pile when nothing is underneath
    const fallDistance = (tag, drift) => {
      const box = tag.getBoundingClientRect();
      const left = box.left + drift;
      const right = box.right + drift;
      const tops = tags
        .filter(other => other !== tag && getComputedStyle(other).visibility !== 'hidden')
        .map(other => other.getBoundingClientRect())
        .filter(r => r.right > left + 12 && r.left < right - 12 && r.top >= box.bottom - 8)
        .map(r => r.top + r.height * 0.35);
      const landing = Math.min(pile.getBoundingClientRect().bottom, ...tops);
      return Math.max(0, landing - box.bottom);
    };
    // Sideways drift that keeps the question's centre over the pile
    const driftWithin = (tag, wanted) => {
      const box = tag.getBoundingClientRect();
      const area = pile.getBoundingClientRect();
      const centre = box.left + box.width / 2;
      return gsap.utils.clamp(area.left + box.width * 0.3 - centre, area.right - box.width * 0.3 - centre, wanted);
    };

    tags.forEach(tag => {
      let grab = null;
      let trail = [];

      tag.addEventListener('pointerdown', (e) => {
        if (pile.classList.contains('is-busy')) return; // the scroll is still moving the questions
        inbox.tosses.get(tag)?.kill();
        tag.setPointerCapture(e.pointerId);
        grab = { x: e.clientX, y: e.clientY, tx: gsap.getProperty(tag, 'x'), ty: gsap.getProperty(tag, 'y') };
        trail = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
        tag.classList.add('is-dragging');
        inbox.moved.add(tag);
        gsap.set(tag, { zIndex: ++topZ });
        inbox.tosses.set(tag, gsap.to(tag, { scale: 1.06, duration: 0.2, ease: 'power2.out' })); // picked up
      });

      tag.addEventListener('pointermove', (e) => {
        if (!grab || !tag.hasPointerCapture(e.pointerId)) return;
        gsap.set(tag, { x: grab.tx + e.clientX - grab.x, y: grab.ty + e.clientY - grab.y });
        const now = performance.now();
        trail.push({ x: e.clientX, y: e.clientY, t: now });
        trail = trail.filter(p => now - p.t < 100); // the last 0.1s sets the throw
      });

      const letGo = (e) => {
        if (!grab) return;
        if (tag.hasPointerCapture(e.pointerId)) tag.releasePointerCapture(e.pointerId);
        tag.classList.remove('is-dragging');
        grab = null;
        inbox.tosses.get(tag)?.kill();
        if (prefersReducedMotion) {
          gsap.set(tag, { scale: 1 });
          return;
        }
        const first = trail[0];
        const lastPoint = trail[trail.length - 1];
        const seconds = Math.max(0.016, (lastPoint.t - first.t) / 1000);
        const vx = (lastPoint.x - first.x) / seconds;
        const drift = driftWithin(tag, gsap.utils.clamp(-160, 160, vx * 0.12));
        const drop = fallDistance(tag, drift);
        const fall = gsap.utils.clamp(0.25, 0.8, Math.sqrt(drop / 1600)); // gravity: longer drops take longer, accelerating
        const tilt = gsap.utils.clamp(-8, 8, gsap.getProperty(tag, 'rotation') * 0.4 + vx * 0.004);
        inbox.tosses.set(tag, gsap.timeline()
          .to(tag, { x: `+=${drift}`, duration: fall + 0.2, ease: 'power1.out' }, 0)
          .to(tag, { scale: 1, rotation: tilt, duration: fall + 0.2, ease: 'power2.out' }, 0)
          .to(tag, { y: `+=${drop}`, duration: fall, ease: 'power2.in' }, 0)
          // a small bounce as it lands
          .to(tag, { y: `-=${Math.min(10, drop * 0.08)}`, duration: 0.12, ease: 'power2.out' })
          .to(tag, { y: `+=${Math.min(10, drop * 0.08)}`, duration: 0.14, ease: 'power2.in' }));
      };
      tag.addEventListener('pointerup', letGo);
      tag.addEventListener('pointercancel', letGo);
    });
  };

  scenes.push(({ isDesktop }) => {
    if (!isDesktop) return;
    const { section, content, card, head, pile, tags, float, floatCursor, open } = inbox;
    const [ask, closing] = inbox.headers;
    const askUser = $('.chat-header-row.right', ask);
    const askPill = $('.header-pill--user', askUser);
    const askReply = $('.header-pill--ai', ask);
    const askSub = $('.sub-pill-text', ask);
    const closingReply = $('.header-pill--ai', closing);
    const closingSub = $('.sub-pill-text', closing);
    section.classList.add('is-staged');

    // The floating "Where is the restroom?" rests down in the pile until the demo lifts it out
    const floatInPile = () => pile.offsetHeight * 0.55;
    inbox.floatRest = () => ({ y: floatInPile(), rotation: -6 });
    const openRest = inbox.rest(open);
    // Questions fall from above the card, each from its own height, with a slight spin, all within
    // about 0.6s of each other (recording 28–29.5s)
    const dropFrom = i => -(pile.offsetHeight + 80 + (i % 6) * 45);
    const spinFrom = i => ((i * 37) % 30) - 15;
    // The pile builds from the bottom up: the lowest questions land first and the rest heap on top
    // of them, a little irregularly (rank by resting height, plus a small shuffle)
    const restHeight = tags.map(tag => parseFloat(getComputedStyle(tag).getPropertyValue('--y')) || 0);
    const heightRank = tags.map((_, i) => restHeight.filter(h => h < restHeight[i]).length);
    const fallDelay = i => (heightRank[i] / tags.length) * 0.5 + ((i * 7) % 5) * 0.03;

    // The pinned screen shows part of the content; moving it works like scrolling
    const offsetIn = el => el.getBoundingClientRect().top - content.getBoundingClientRect().top;
    const showCard = () => -gsap.utils.clamp(0, offsetIn(card) - 16, offsetIn(card) + card.offsetHeight + 24 - innerHeight);
    const showClosing = () => -Math.max(0, content.offsetHeight - innerHeight); // down to the section's end

    const applyStart = () => {
      gsap.set(content, { y: 0 });
      gsap.set(askUser, { autoAlpha: 0, y: 12 });
      gsap.set(askPill, { backgroundColor: '#A8A49A' });
      gsap.set([askReply, closingReply], { autoAlpha: 0, scale: 0.9, transformOrigin: 'left bottom', color: 'rgba(255, 255, 255, 0)' });
      gsap.set([askSub, closingSub], { autoAlpha: 0, y: 16 });
      gsap.set(card, { autoAlpha: 0, backgroundColor: '#CFCBC0' });
      gsap.set(head, { autoAlpha: 0 });
      gsap.set(pile, { '--pile-glow': 0 });
      inbox.tosses.forEach(toss => toss.kill());
      inbox.moved.clear();
      tags.forEach((tag, i) => gsap.set(tag, { autoAlpha: 0, zIndex: '', x: 0, y: dropFrom(i), rotation: spinFrom(i), scale: 1 }));
      gsap.set(floatCursor, { opacity: 0 });
    };
    applyStart();

    // The rain: once the whole card is in view, the questions fall into the pile from the bottom
    // up as the visitor scrolls, and the glow rises under it (nested in the scene's timeline below)
    const rain = gsap.timeline()
      .to(pile, { '--pile-glow': 1, duration: 1.8, ease: 'none' }, 0);
    tags.forEach((tag, i) => {
      const at = fallDelay(i) * 2;
      const rest = inbox.rest(tag);
      rain.to(tag, { autoAlpha: 1, duration: 0.2, ease: 'none' }, at)
        .to(tag, { y: rest.y, duration: 1.4, ease: 'bounce.out' }, at)
        .to(tag, { rotation: rest.rotation, duration: 1.4, ease: 'back.out(1.7)' }, at);
    });

    const tl = gsap.timeline({ paused: true, defaults: { ease: MOTION.ease } });
    tl.addLabel('enter', 0)

      // Step 1 (26–28s): the visitor asks (grey → black), the concierge bubble grows, then the sub-bubble
      .to(askUser, { autoAlpha: 1, y: 0, duration: MOTION.base }, 0.01)
      .to(askPill, { backgroundColor: '#0E1013', duration: 0.4, ease: 'none' }, 0.3);
    bubbleIn(tl, askReply, 0.6)
      .to(askSub, { autoAlpha: 1, y: 0, duration: MOTION.base }, '-=0.1')
      .addLabel('ask')

      // Step 2 (28–30s): the view moves to the inbox and the card darkens in; once the whole card
      // is in view the questions rain into the pile
      .to(content, { y: showCard, duration: MOTION.slow, ease: MOTION.easeInOut }, 'ask')
      .to(card, { autoAlpha: 1, duration: 0.3, ease: 'none' }, 'ask+=0.1')
      .to(card, { backgroundColor: '#0E1013', duration: 0.6, ease: 'none' }, 'ask+=0.25')
      .to(head, { autoAlpha: 1, duration: 0.4 }, 'ask+=0.55')
      .addLabel('rain', 'ask+=0.95')
      .add(rain, 'rain')
      .addLabel('inbox')

      // Step 3 (30.5–34s): drag demo. "Where is the restroom?" is lifted out with the cursor,
      // hovers, and drops back; then "What time do you open?" does the same.
      .set(float, { zIndex: 20 }, 'inbox')
      .fromTo(float, { y: floatInPile, rotation: -6 }, { y: 0, rotation: 4, duration: 0.6, ease: MOTION.easeInOut, immediateRender: false }, 'inbox')
      .to(floatCursor, { opacity: 1, duration: 0.2 }, 'inbox')
      .to(float, { y: -10, rotation: 2, duration: 0.4, ease: 'sine.inOut' }, 'inbox+=0.6')
      .to(float, { y: floatInPile, rotation: -6, duration: 0.9, ease: 'bounce.out' }, 'inbox+=1.0')
      .to(floatCursor, { opacity: 0, duration: 0.2 }, 'inbox+=1.0')
      .set(open, { zIndex: 20 }, 'inbox+=1.6')
      .fromTo(open, { x: 0, y: openRest.y, rotation: openRest.rotation }, { x: 40, y: -120, rotation: -14, duration: 0.5, ease: MOTION.easeInOut, immediateRender: false }, 'inbox+=1.6')
      .to(open, { y: -132, rotation: -11, duration: 0.4, ease: 'sine.inOut' }, 'inbox+=2.1')
      .to(open, { x: 0, y: openRest.y, rotation: openRest.rotation, duration: 0.9, ease: 'bounce.out' }, 'inbox+=2.5')
      .addLabel('demo')

      // Step 4 (34.5–36s): the view moves down; "Let me handle the repeats." grows, then the sub-bubble
      .to(content, { y: showClosing, duration: MOTION.slow, ease: MOTION.easeInOut }, 'demo');
    bubbleIn(tl, closingReply, 'demo+=0.6')
      .to(closingSub, { autoAlpha: 1, y: 0, duration: MOTION.base }, '-=0.1')
      .addLabel('repeats');

    // Leaving, as the How section slides up over the inbox (the tail): the questions rise back up
    // out of the card (the fall in reverse) from wherever they rest and fade away with the glow,
    // then the card and messages fade out. All with the scroll; the exit re-measures where the
    // questions rest each time it is entered from above (some may have been moved by hand).
    const riseDelay = i => (((i * 7) % tags.length) / tags.length) * 1.0;
    const exit = gsap.timeline({ paused: true })
      .to(tags, {
        y: i => `-=${pile.offsetHeight + 160 + (i % 6) * 45}`, rotation: i => `+=${((i * 37) % 30) - 15}`,
        duration: 2.0, ease: 'power2.in', stagger: riseDelay
      }, 0)
      .to(tags, { autoAlpha: 0, duration: 0.7, ease: 'none', stagger: riseDelay }, 1.3)
      .to(pile, { '--pile-glow': 0, duration: 2.0, ease: 'none' }, 0.4)
      .to(content, { autoAlpha: 0, y: '-=40', duration: 1.2, ease: 'power1.in' }, 1.6);
    const next = $('#how');
    next.classList.add('slides-over');

    // The questions can be picked up once the demo is over, until the exit starts. Scrolling back
    // into the demo or the rain puts moved questions back in their places first (the demo
    // animates its two, the rain all of them), so the scroll and a drop never fight over one.
    const updatePile = () => {
      const time = tl.time();
      pile.classList.toggle('is-busy', time < tl.labels.demo || exit.progress() > 0);
      if (time < tl.labels.inbox) inbox.putBack();
      else if (time < tl.labels.demo) inbox.putBack([float, open]);
    };
    exit.eventCallback('onUpdate', updatePile);

    scrollScene({
      trigger: section,
      tl,
      exit,
      tail: () => section.offsetHeight, // the How section slides up over the inbox
      onUpdate: updatePile,
      onRefresh: applyStart
    });

    return () => {
      pile.classList.remove('is-busy');
      inbox.putBack();
      next.classList.remove('slides-over');
      section.classList.remove('is-staged');
      inbox.floatRest = () => ({ y: 0, rotation: inbox.tilt[tags.indexOf(float)] });
    };
  });

  // Phones: the chats play, the card fades in and the questions fall into the pile as it scrolls in
  scenes.push(({ isMobile }) => {
    if (!isMobile) return;
    inbox.headers.forEach(header => chatThread(header));
    scrollReveal(inbox.card, inbox.card, { autoAlpha: 0, y: 30 }, { start: 'top 90%', end: 'top 65%' });
    gsap.fromTo(inbox.tags, { autoAlpha: 0, y: -240 }, {
      autoAlpha: 1, y: i => inbox.rest(inbox.tags[i]).y, ease: 'bounce.out',
      stagger: { each: 0.04, from: 'random' },
      scrollTrigger: { trigger: inbox.card, start: 'top 65%', end: 'top 15%', scrub: 0.5 }
    });
  });

  // Moving the content inside a pinned screen works like scrolling: the shift that brings an
  // element (or everything from `el` down to `last`) fully into view, top first if it is taller
  // than the screen
  const showInStage = (section, content, el, last = el) => () => {
    const top = el.getBoundingClientRect().top - content.getBoundingClientRect().top;
    const bottom = last.getBoundingClientRect().bottom - content.getBoundingClientRect().top;
    const stageH = innerHeight; // the pinned screen (the section can measure taller while ScrollTrigger re-measures)
    return -gsap.utils.clamp(0, top - 16, bottom + 24 - stageH);
  };

  /* 9. How it works (Figma recording 37–50s). Desktop: a scroll scene that slides up over the
     inbox. The visitor asks and the concierge answers with the scroll; once the view reaches the
     steps they build: dot 1 lights up and card 1 rises in, the line draws on to dot 2 (card 2's
     dial turns), then to dot 3 (card 3's chat bubble turns into a check, and back and forth once
     more, as in the preview); every dot settles back to neutral. All with the scroll. As the next
     section slides up over it, the content fades out. */
  const how = {
    section: $('#how'),
    content: $('#how > .container'),
    header: $('#how .chat-section-header'),
    wrap: $('#how .how-wrap'),
    stepper: $('#how .stepper'),
    dots: $$('#how .step-dot'),
    cards: $$('#how .process-card')
  };
  how.answer = $('.how-mark', how.cards[2]);
  how.check = how.answer.getAttribute('d');
  how.bubble = 'M62 80c6 4 12 6 18 6s12-2 18-6'; // card 3's reply starts as a small "typing" curve

  scenes.push(({ isDesktop }) => {
    if (!isDesktop) return;
    const { section, content, header, wrap, stepper, dots, cards, answer } = how;
    const user = $('.chat-header-row.right', header);
    const pill = $('.header-pill--user', user);
    const reply = $('.header-pill--ai', header);
    const sub = $('.sub-pill-text', header);
    const icons = cards.map(card => $('.process-icon', card));
    const texts = cards.map(card => $$('.process-label, h3, p', card));
    const dial = $('.process-glyph--round', cards[1]); // its tick ring turns with --dial
    const pillColor = getComputedStyle(pill).backgroundColor;
    const pillText = getComputedStyle(pill).color;
    const next = $('#interaction');
    section.classList.add('is-staged');
    next.classList.add('slides-over');

    const applyStart = () => {
      gsap.set(content, { y: 0, autoAlpha: 1 });
      gsap.set(user, { autoAlpha: 0, y: 12 });
      gsap.set(pill, { backgroundColor: '#5B5F66', color: 'rgba(255, 255, 255, 0.7)' });
      gsap.set(reply, { autoAlpha: 0, scale: 0.9, transformOrigin: 'left bottom', color: 'rgba(255, 255, 255, 0)' });
      gsap.set(sub, { autoAlpha: 0, y: 16 });
      gsap.set(stepper, { '--line': 0 });
      gsap.set(dots, { autoAlpha: 0, scale: 0.6, '--on': 0 });
      gsap.set(cards, { autoAlpha: 0, y: 24 });
      gsap.set(icons, { scale: 0.85 });
      gsap.set(texts.flat(), { opacity: 0.25 });
      gsap.set(dial, { '--dial': '0deg' });
      gsap.set(answer, { morphSVG: how.bubble });
    };
    applyStart();

    // A card rises in with its icon, then its text turns from pale to solid
    const cardIn = (i, at) => steps
      .to(cards[i], { autoAlpha: 1, y: 0, duration: MOTION.base }, at)
      .to(icons[i], { scale: 1, duration: MOTION.base, ease: 'back.out(1.7)' }, '<')
      .to(texts[i], { opacity: 1, duration: 0.4, stagger: 0.1 }, '<0.25');

    const tl = gsap.timeline({ paused: true, defaults: { ease: MOTION.ease } });
    tl.addLabel('enter', 0)

      // Step 1 (37–40s): the visitor asks, the concierge bubble grows, then the sub-bubble
      .to(user, { autoAlpha: 1, y: 0, duration: MOTION.base }, 0.01)
      .to(pill, { backgroundColor: pillColor, color: pillText, duration: 0.4, ease: 'none' }, 0.3);
    bubbleIn(tl, reply, 0.6)
      .to(sub, { autoAlpha: 1, y: 0, duration: MOTION.base }, '-=0.1')
      .addLabel('ask')

      // The view moves to the steps; then they build (steps, below)
      .to(content, { y: showInStage(section, content, wrap), duration: MOTION.slow, ease: MOTION.easeInOut }, 'ask')
      .addLabel('steps', 'ask+=0.4');

    const steps = gsap.timeline({ defaults: { ease: MOTION.ease } })
      // Step 2 (40–42s): dot 1 lights up and card 1 rises in
      .addLabel('start', 0)
      .to(dots[0], { autoAlpha: 1, scale: 1, '--on': 1, duration: 0.4 }, 'start');
    cardIn(0, 'start+=0.15')
      .addLabel('step1')

      // Step 3 (42–43.5s): the line draws on to dot 2, which takes the light; card 2's dial turns
      .to(stepper, { '--line': 0.5, duration: 0.6, ease: 'power1.inOut' }, 'step1')
      .to(dots[1], { autoAlpha: 1, scale: 1, duration: 0.3 }, 'step1+=0.4')
      .to(dots[0], { '--on': 0, duration: 0.3 }, 'step1+=0.5')
      .to(dots[1], { '--on': 1, duration: 0.3 }, 'step1+=0.5');
    cardIn(1, 'step1+=0.6')
      .to(dial, { '--dial': '180deg', duration: 1.2, ease: 'none' }, 'step1+=0.6')
      .addLabel('step2')

      // Step 4 (43.5–45s): on to dot 3; card 3 rises in and its chat bubble turns into a check
      .to(stepper, { '--line': 1, duration: 0.6, ease: 'power1.inOut' }, 'step2')
      .to(dots[2], { autoAlpha: 1, scale: 1, duration: 0.3 }, 'step2+=0.4')
      .to(dots[1], { '--on': 0, duration: 0.3 }, 'step2+=0.5')
      .to(dots[2], { '--on': 1, duration: 0.3 }, 'step2+=0.5');
    cardIn(2, 'step2+=0.6')
      .to(answer, { morphSVG: how.check, duration: 0.5, ease: MOTION.easeInOut }, 'step2+=1.1')
      .addLabel('step3')

      // Step 5 (45–50s): the steps settle, every dot back to neutral; card 3's icon switches back
      // to the bubble and to the check once more
      .to(dots, { '--on': 0, duration: 0.4 }, 'step3+=0.2')
      .to(answer, { morphSVG: how.bubble, duration: 0.5, ease: MOTION.easeInOut }, 'step3+=0.9')
      .to(answer, { morphSVG: how.check, duration: 0.5, ease: MOTION.easeInOut }, 'step3+=1.9');
    tl.add(steps, 'steps').addLabel('built');

    // Leaving, as the next section slides up over it: the content fades out
    const exit = gsap.timeline({ paused: true })
      .to(content, { autoAlpha: 0, y: '-=40', duration: 0.85, ease: 'power1.in' }, 0.1)
      .set({}, {}, 1);

    scrollScene({ trigger: section, tl, exit, tail: () => section.offsetHeight, onRefresh: applyStart });

    return () => {
      next.classList.remove('slides-over');
      section.classList.remove('is-staged');
    };
  });

  /* 10. Type or talk (Figma recording 50–63s). Desktop: a scroll scene that slides up over How it
     works. The visitor asks and the concierge answers; once the view reaches the cards, with the
     scroll: the chat card fades in, its heading
     and then its description word by word, and the mini chat window rises; the voice card shows
     as a pale placeholder, turns dark, and the glow grows under the mic; then the mini chat plays
     message by message, the chips appear and the voice card starts "Listening…". */
  const modes = {
    section: $('#interaction'),
    content: $('#interaction > .container'),
    header: $('#interaction .chat-section-header'),
    grid: $('#interaction .mode-grid'),
    chat: $('#interaction .mode-card--chat'),
    voice: $('#interaction .mode-card--voice')
  };
  // Each card description, word by word (split once, so resizing never splits it again)
  [modes.chat, modes.voice].forEach(card => {
    const p = $('.mode-header p', card);
    const words = p.textContent.trim().split(/\s+/);
    p.textContent = '';
    words.forEach((word, i) => {
      const span = document.createElement('span');
      span.className = 'word';
      span.textContent = word;
      p.append(span, i < words.length - 1 ? ' ' : '');
    });
  });

  scenes.push(({ isDesktop }) => {
    if (!isDesktop) return;
    const { section, content, header, grid, chat, voice } = modes;
    const user = $('.chat-header-row.right', header);
    const pill = $('.header-pill--user', user);
    const reply = $('.header-pill--ai', header);
    const sub = $('.sub-pill-text', header);
    const titles = [chat, voice].map(card => $$('.mode-tag, h3', card));
    const words = [chat, voice].map(card => $$('.word', card));
    const mini = $('.mini-chat', chat);
    const messages = $$('.msg-row', mini);
    const question = $('.bubble', messages[0]);
    const chips = $$('.chip', mini);
    const stage = $('.voice-stage', voice);
    const listening = $('.listening', voice);
    const pillColor = getComputedStyle(pill).backgroundColor;
    const questionColor = getComputedStyle(question).backgroundColor;
    const voiceColor = getComputedStyle(voice).backgroundColor;
    section.classList.add('is-staged');

    const applyStart = () => {
      gsap.set(content, { y: 0 });
      gsap.set(user, { autoAlpha: 0, y: 12 });
      gsap.set(pill, { backgroundColor: '#A8A49A' });
      gsap.set(reply, { autoAlpha: 0, scale: 0.9, transformOrigin: 'left bottom', color: 'rgba(255, 255, 255, 0)' });
      gsap.set(sub, { autoAlpha: 0, y: 16 });
      gsap.set([chat, voice], { autoAlpha: 0, y: 24 });
      gsap.set(voice, { backgroundColor: '#5B5D61' });
      gsap.set(titles.flat(), { opacity: 0 });
      gsap.set(words.flat(), { opacity: 0 });
      gsap.set(mini, { autoAlpha: 0, y: 40 });
      gsap.set(messages, { autoAlpha: 0, y: 10 });
      gsap.set(question, { backgroundColor: '#C9C6BE' });
      gsap.set(chips, { autoAlpha: 0, y: 8 });
      gsap.set(stage, { autoAlpha: 0, scale: 0.8 });
      gsap.set(listening, { autoAlpha: 0 });
    };
    applyStart();

    // A card's heading appears, then its description word by word
    const headingIn = (i, at) => cards
      .to(titles[i], { opacity: 1, duration: 0.4, stagger: 0.1 }, at)
      .to(words[i], { opacity: 1, duration: 0.25, stagger: 0.05 }, '<0.3');

    const tl = gsap.timeline({ paused: true, defaults: { ease: MOTION.ease } });
    tl.addLabel('enter', 0)

      // Step 1 (50–53s): the visitor asks (grey → black), the concierge bubble grows, then the sub-bubble
      .to(user, { autoAlpha: 1, y: 0, duration: MOTION.base }, 0.01)
      .to(pill, { backgroundColor: pillColor, duration: 0.4, ease: 'none' }, 0.3);
    bubbleIn(tl, reply, 0.6)
      .to(sub, { autoAlpha: 1, y: 0, duration: MOTION.base }, '-=0.1')
      .addLabel('ask')

      // The view moves to the cards; then they play (cards, below)
      .to(content, { y: showInStage(section, content, grid), duration: MOTION.slow, ease: MOTION.easeInOut }, 'ask')
      .addLabel('cards', 'ask+=0.4');

    const cards = gsap.timeline({ defaults: { ease: MOTION.ease } })
      // Step 2 (53–55s): the chat card fades in, its heading and description, then the mini chat window rises
      .addLabel('start', 0)
      .to(chat, { autoAlpha: 1, y: 0, duration: MOTION.base }, 'start');
    headingIn(0, 'start+=0.2')
      .to(mini, { autoAlpha: 1, y: 0, duration: MOTION.base }, '-=0.2')
      .addLabel('chat')

      // Step 3 (55–57s): the voice card shows as a pale placeholder and turns dark; its heading
      // and description; the glow grows under the mic
      .to(voice, { autoAlpha: 1, y: 0, duration: MOTION.base }, 'chat')
      .to(voice, { backgroundColor: voiceColor, duration: 0.6, ease: 'none' }, 'chat+=0.3');
    headingIn(1, 'chat+=0.6')
      .to(stage, { autoAlpha: 1, scale: 1, duration: 0.9 }, 'chat+=0.7')
      .addLabel('voice')

      // Step 4 (57–60s): the mini chat plays: the question (grey → black), the answer, the
      // follow-up, then the chips; the voice card starts listening
      .to(messages[0], { autoAlpha: 1, y: 0, duration: 0.4 }, 'voice')
      .to(question, { backgroundColor: questionColor, duration: 0.3, ease: 'none' }, 'voice+=0.25')
      .to(listening, { autoAlpha: 1, duration: 0.4 }, 'voice+=0.3')
      .to(messages[1], { autoAlpha: 1, y: 0, duration: 0.4 }, 'voice+=0.6')
      .to(messages[2], { autoAlpha: 1, y: 0, duration: 0.4 }, 'voice+=1.0')
      .to(chips, { autoAlpha: 1, y: 0, duration: 0.3, stagger: 0.12 }, 'voice+=1.4');
    // (the rings around the mic keep their own gentle CSS pulse, so "Listening…" looks alive)
    tl.add(cards, 'cards').addLabel('played');
    const next = $('#industries');
    next.classList.add('slides-over');

    // Leaving, as the industries section slides up over it: the content fades out
    const exit = gsap.timeline({ paused: true })
      .to(content, { autoAlpha: 0, y: '-=40', duration: 0.8, ease: 'power1.in' }, 0.15)
      .set({}, {}, 1);

    scrollScene({ trigger: section, tl, exit, tail: () => section.offsetHeight, onRefresh: applyStart });

    return () => {
      next.classList.remove('slides-over');
      section.classList.remove('is-staged');
    };
  });

  /* 11. Industries (Figma recording 1:02–1:15). Desktop: a scroll scene that slides up over Type
     or talk. The visitor asks and the concierge answers with the scroll; once the view reaches the
     gallery the cards come in (the first fades in, the rest slide in from the right), then the
     row moves along until "Built for yours, too." reaches the right edge. All with the scroll; the
     arrows, dots, sideways swipes and drags move it one card at a time too. */
  const industries = {
    section: $('#industries'),
    content: $('#industries > .container'),
    header: $('#industries .chat-section-header'),
    gallery: $('#industryGallery'),
    cards: $$('#industries .industry-card'),
    controls: $('#industries .gallery-controls')
  };

  scenes.push(({ isDesktop }) => {
    if (!isDesktop) return;
    const { section, content, header, gallery, cards, controls } = industries;
    const user = $('.chat-header-row.right', header);
    const pill = $('.header-pill--user', user);
    const reply = $('.header-pill--ai', header);
    const sub = $('.sub-pill-text', header);
    const pillColor = getComputedStyle(pill).backgroundColor;
    section.classList.add('is-staged');

    // Desktop carousel: the cards sit on a track that moves one card per step until "Built for
    // yours, too." reaches the right edge (the last step may be shorter), so the row always stays
    // full. There is one dot per position (the extra dots hide), and the arrows dim at the ends.
    // Arrows, dots, horizontal swipes and drags step it.
    const dots = $$('.gallery-dots span', controls);
    const [prevBtn, nextBtn] = $$('[data-gallery]', controls);
    const track = document.createElement('div');
    track.className = 'industry-track';
    cards.forEach(card => track.appendChild(card));
    gallery.appendChild(track);
    const all = cards;

    let index = 0; // the position (cards moved out on the left)
    let last = 0;  // the last position
    let slide;
    const step = () => cards[1].offsetLeft - cards[0].offsetLeft;
    // How far the track can move: until the last card's right edge meets the gallery's
    const maxShift = () => {
      const end = cards[cards.length - 1].offsetLeft + cards[cards.length - 1].offsetWidth;
      return Math.max(0, end - (gallery.clientWidth - parseFloat(getComputedStyle(gallery).paddingRight)));
    };
    const shiftAt = i => Math.min(i * step(), maxShift());
    const showDot = () => {
      dots.forEach((dot, i) => {
        dot.hidden = i > last;
        dot.classList.toggle('is-active', i === index);
      });
      prevBtn.disabled = index === 0;
      nextBtn.disabled = index === last;
    };
    const measure = () => {
      last = Math.min(dots.length - 1, Math.ceil(maxShift() / step() - 0.05));
      index = Math.min(index, last);
      showDot();
    };
    const showDotFirst = () => {
      dots.forEach((dot, i) => { dot.hidden = false; dot.classList.toggle('is-active', i === 0); });
      prevBtn.disabled = false;
      nextBtn.disabled = false;
    };
    const goTo = (i) => {
      index = gsap.utils.clamp(0, last, i);
      showDot();
      slide?.kill();
      slide = gsap.to(track, { x: -shiftAt(index), duration: index === i ? 0.8 : 0.4, ease: MOTION.easeInOut });
    };
    const go = dir => goTo(index + dir);

    // Arrows and dots step the carousel (capture phase: main.js would scroll the gallery instead)
    const onControls = (e) => {
      const arrow = e.target.closest('[data-gallery]');
      const dot = e.target.closest('.gallery-dots span');
      if (!arrow && !dot) return;
      e.stopPropagation();
      if (arrow) go(arrow.dataset.gallery === 'next' ? 1 : -1);
      else goTo(dots.indexOf(dot));
    };
    controls.addEventListener('click', onControls, true);
    // Horizontal wheel/trackpad swipes step it; vertical scrolling over it scrolls the page as usual
    let wheelX = 0;
    let wheelAt = 0;
    const onWheel = (e) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      const now = performance.now();
      if (now - wheelAt > 300) wheelX = 0;
      wheelAt = now;
      wheelX += e.deltaX;
      if (Math.abs(wheelX) > 60 && !slide?.isActive()) { go(wheelX > 0 ? 1 : -1); wheelX = 0; }
    };
    gallery.addEventListener('wheel', onWheel, { passive: false });
    // Dragging: the track follows the pointer, then settles one card along (or back)
    let drag = null;
    const onDown = (e) => {
      if (e.button !== 0) return;
      drag = { x: e.clientX, start: gsap.getProperty(track, 'x'), moved: false, id: e.pointerId };
    };
    const onMove = (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) > 6) { drag.moved = true; slide?.kill(); gallery.setPointerCapture(drag.id); gallery.classList.add('is-dragging'); }
      if (drag.moved) gsap.set(track, { x: drag.start + dx });
    };
    const onUp = (e) => {
      if (!drag) return;
      const { moved, x } = drag;
      drag = null;
      gallery.classList.remove('is-dragging');
      if (!moved) return; // a click on a card's button or link
      const dx = e.clientX - x;
      go(dx < -50 ? 1 : dx > 50 ? -1 : 0);
    };
    gallery.addEventListener('pointerdown', onDown);
    gallery.addEventListener('pointermove', onMove);
    gallery.addEventListener('pointerup', onUp);
    gallery.addEventListener('pointercancel', onUp);
    // The dots and arrows follow the row as the scroll moves it
    const syncDots = () => {
      const pos = -gsap.getProperty(track, 'x');
      index = pos >= maxShift() - 2 && pos > 0 ? last : gsap.utils.clamp(0, last, Math.round(pos / step()));
      showDot();
    };

    const applyStart = () => {
      slide?.kill();
      index = 0;
      measure();
      gsap.set(track, { x: 0 });
      gsap.set(content, { y: 0, autoAlpha: 1 });
      gsap.set(user, { autoAlpha: 0, y: 12 });
      gsap.set(pill, { backgroundColor: '#A8A49A' });
      gsap.set(reply, { autoAlpha: 0, scale: 0.9, transformOrigin: 'left bottom', color: 'rgba(255, 255, 255, 0)' });
      gsap.set(sub, { autoAlpha: 0, y: 16 });
      gsap.set(all, { autoAlpha: 0, x: 0 });
      gsap.set(all.slice(1), { x: () => innerWidth * 0.35 });
      gsap.set(controls, { autoAlpha: 0 });
    };
    applyStart();

    const tl = gsap.timeline({ paused: true, defaults: { ease: MOTION.ease } });
    tl.addLabel('enter', 0)

      // Step 1 (1:02–1:05): the visitor asks (grey → black), the answer grows, then the sub-bubble
      .to(user, { autoAlpha: 1, y: 0, duration: MOTION.base }, 0.01)
      .to(pill, { backgroundColor: pillColor, duration: 0.4, ease: 'none' }, 0.3);
    bubbleIn(tl, reply, 0.6)
      .to(sub, { autoAlpha: 1, y: 0, duration: MOTION.base }, '-=0.1')
      .addLabel('ask')

      // The view moves to the gallery; once it has settled on the gallery and its controls:
      .to(content, { y: showInStage(section, content, gallery, controls), duration: MOTION.slow, ease: MOTION.easeInOut }, 'ask')
      .addLabel('cards', 'ask+=0.8')

      // Step 2 (1:05–1:07): the first card fades in, the rest slide in from the right one by one
      .to(all[0], { autoAlpha: 1, duration: MOTION.base }, 'cards')
      .to(all.slice(1), { autoAlpha: 1, x: 0, duration: 0.9, ease: 'power3.out', stagger: 0.12 }, 'cards+=0.25')
      .to(controls, { autoAlpha: 1, duration: 0.4 }, 'cards+=0.9')
      .addLabel('shown')

      // Step 3 (1:07–1:14): the row moves along until "Built for yours, too." reaches the right edge
      .to(track, { x: () => -maxShift(), duration: 2.4, ease: 'none', onUpdate: syncDots }, 'shown+=0.3')
      .addLabel('moved');

    // Leaving: the content fades out
    const exit = gsap.timeline({ paused: true })
      .to(content, { autoAlpha: 0, y: '-=40', duration: 0.8, ease: 'power1.in' }, 0.15)
      .set({}, {}, 1);

    scrollScene({ trigger: section, tl, exit, tail: () => innerHeight * 0.5, onRefresh: applyStart });

    return () => {
      slide?.kill();
      controls.removeEventListener('click', onControls, true);
      gallery.removeEventListener('wheel', onWheel);
      gallery.removeEventListener('pointerdown', onDown);
      gallery.removeEventListener('pointermove', onMove);
      gallery.removeEventListener('pointerup', onUp);
      gallery.removeEventListener('pointercancel', onUp);
      // Back to the plain scrolling gallery (phones, reduced motion)
      cards.forEach(card => gallery.appendChild(card));
      track.remove();
      gsap.set(cards, { clearProps: 'transform' });
      showDotFirst();
      section.classList.remove('is-staged');
    };
  });

  /* 12. Why concierge81? (Figma recording 1:15–1:37). Desktop: a scroll scene. The visitor asks
     and the concierge answers; the view moves down the bento one row at a time and each card's
     graphic plays as it arrives: the 24/7 dot travels the day past "Answered at 2:14 AM" and the
     hand-off line draws to your team (row 1); the business info branches out to kiosk, web and
     app, the language tab moves to JP and back as Hello. turns into こんにちは。, and the places
     spread out from the hub (row 2); Parking appears and the week's bars grow, then the demo card
     rises in (row 3). All with the scroll. As the deployment section slides up over it, the content
     fades out. */
  const values = {
    section: $('#values'),
    content: $('#values > .container'),
    header: $('#values .chat-section-header'),
    rows: $$('#values .bento-row'),
    cards: $$('#values .bento-card')
  };

  scenes.push(({ isDesktop }) => {
    if (!isDesktop) return;
    const { section, content, header, rows, cards } = values;
    const user = $('.chat-header-row.right', header);
    const pill = $('.header-pill--user', user);
    const reply = $('.header-pill--ai', header);
    const sub = $('.sub-pill-text', header);
    const pillColor = getComputedStyle(pill).backgroundColor;
    const part = selector => $(selector, section);
    const parts = selector => $$(selector, section);
    const timeline = part('.timeline');
    const tip = part('.timeline-tip');
    const fill = part('.timeline-fill');
    const marks = parts('.timeline-sun, .timeline-moon');
    const lines = parts('.handoff-line');
    const handoffPill = part('.handoff-pill');
    const team = part('.handoff-team');
    const infoBox = part('.info-box');
    const branches = parts('.info-branches path');
    const nodes = parts('.info-nodes > div');
    const langPill = part('.lang-pill');
    const tabs = parts('.lang-tabs span');
    const hello = part('.hello-en');
    const konnichiwa = part('.hello-jp');
    const network = parts('.network-lines path');
    const places = parts('.network-node');
    const tags = parts('.network-tag');
    const hub = parts('.network-glow, .network-hub, .network-home');
    const word = parts('.insight-copy > *');
    const bars = parts('.bar');
    const demo = part('.bento-card--cta');
    branches.forEach(path => path.setAttribute('pathLength', '1'));
    // The places start on the hub and move out along their lines
    const fromHub = (el) => {
      const c = $('circle', el);
      return { x: 180 - +c.getAttribute('cx'), y: 112 - +c.getAttribute('cy') };
    };
    const tabShift = () => tabs[1].offsetLeft - tabs[0].offsetLeft;
    const next = $('#deployment');
    section.classList.add('is-staged');
    next.classList.add('slides-over');

    const applyStart = () => {
      gsap.set(content, { y: 0, autoAlpha: 1 });
      gsap.set(user, { autoAlpha: 0, y: 12 });
      gsap.set(pill, { backgroundColor: '#5B5F66' });
      gsap.set(reply, { autoAlpha: 0, scale: 0.9, transformOrigin: 'left bottom', color: 'rgba(255, 255, 255, 0)' });
      gsap.set(sub, { autoAlpha: 0, y: 16 });
      gsap.set(cards, { autoAlpha: 0, y: 30 });
      gsap.set(timeline, { '--at': '0%' });
      gsap.set(fill, { scaleX: 0 });
      gsap.set([tip, ...marks], { autoAlpha: 0, y: 6 });
      gsap.set(lines, { scaleX: 0 });
      gsap.set(handoffPill, { autoAlpha: 0, scale: 0.8 });
      gsap.set(team, { opacity: 0.35 });
      gsap.set(infoBox, { autoAlpha: 0, y: 14 });
      gsap.set(branches, { strokeDasharray: 1, strokeDashoffset: 1 });
      gsap.set(nodes, { autoAlpha: 0, scale: 0.7 });
      gsap.set(langPill, { x: 0 });
      gsap.set(tabs, { color: '' });
      gsap.set(konnichiwa, { autoAlpha: 0, y: 10 });
      gsap.set(hello, { autoAlpha: 1 });
      gsap.set(network, { opacity: 0 });
      gsap.set(places, { autoAlpha: 0, x: i => fromHub(places[i]).x, y: i => fromHub(places[i]).y });
      gsap.set(tags, { autoAlpha: 0, y: 6 });
      gsap.set(hub, { autoAlpha: 0, scale: 0.6, transformOrigin: '50% 50%' });
      gsap.set(word, { autoAlpha: 0, y: 12 });
      gsap.set(bars, { '--grow': 0 });
      gsap.set(demo, { y: 60 });
    };
    applyStart();

    const tl = gsap.timeline({ paused: true, defaults: { ease: MOTION.ease } });
    tl.addLabel('enter', 0)

      // Step 1 (1:15–1:19): the visitor asks (grey → white), the concierge bubble grows, then the sub-bubble
      .to(user, { autoAlpha: 1, y: 0, duration: MOTION.base }, 0.01)
      .to(pill, { backgroundColor: pillColor, duration: 0.4, ease: 'none' }, 0.3);
    bubbleIn(tl, reply, 0.6)
      .to(sub, { autoAlpha: 1, y: 0, duration: MOTION.base }, '-=0.1')
      .addLabel('ask')

      // Step 2 (1:19–1:25): the view moves to row 1; its two cards rise in. The dot travels the day,
      // the answer label appears as it passes 2:14 AM; the hand-off line draws to the team
      .to(content, { y: showInStage(section, content, rows[0]), duration: MOTION.slow, ease: MOTION.easeInOut }, 'ask')
      .to(rows[0].children, { autoAlpha: 1, y: 0, duration: MOTION.base, stagger: 0.2 }, 'ask+=0.4')
      .addLabel('row1', 'ask+=0.9')
      .to(timeline, { '--at': '9.3%', duration: 0.5, ease: 'power1.inOut' }, 'row1')
      .to(fill, { scaleX: 0.093, duration: 0.5, ease: 'power1.inOut' }, 'row1')
      .to(tip, { autoAlpha: 1, y: 0, duration: 0.3 }, 'row1+=0.4')
      .to(marks, { autoAlpha: 1, y: 0, duration: 0.3, stagger: 0.25 }, 'row1+=0.6')
      .to(timeline, { '--at': '100%', duration: 1.6, ease: 'power1.inOut' }, 'row1+=0.9')
      .to(fill, { scaleX: 1, duration: 1.6, ease: 'power1.inOut' }, 'row1+=0.9')
      .to(lines[0], { scaleX: 1, duration: 0.5, ease: 'power1.inOut' }, 'row1+=0.3')
      .to(handoffPill, { autoAlpha: 1, scale: 1, duration: 0.35, ease: 'back.out(1.7)' }, 'row1+=0.7')
      .to(lines[1], { scaleX: 1, duration: 0.5, ease: 'power1.inOut' }, 'row1+=0.95')
      .to(team, { opacity: 1, duration: 0.3 }, 'row1+=1.35')
      .addLabel('row1Done', 'row1+=2.6')

      // Step 3 (1:25–1:32): on to row 2. The business info card branches out to kiosk, web and
      // app; the tab slides to JP as Hello. gives way to こんにちは。, then back to EN; the places
      // spread out from the hub along their lines and get their names
      .to(content, { y: showInStage(section, content, rows[1]), duration: MOTION.slow, ease: MOTION.easeInOut }, 'row1Done')
      .to(rows[1].children, { autoAlpha: 1, y: 0, duration: MOTION.base, stagger: 0.2 }, 'row1Done+=0.3')
      .addLabel('row2', 'row1Done+=0.9')
      .to(infoBox, { autoAlpha: 1, y: 0, duration: 0.4 }, 'row2')
      .to(branches, { strokeDashoffset: 0, duration: 0.6, ease: 'power1.inOut', stagger: 0.1 }, 'row2+=0.4')
      .to(nodes, { autoAlpha: 1, scale: 1, duration: 0.35, ease: 'back.out(1.7)', stagger: 0.15 }, 'row2+=0.8')
      .to(langPill, { x: tabShift, duration: 0.45, ease: MOTION.easeInOut }, 'row2+=0.5')
      .to(hello, { autoAlpha: 0.2, duration: 0.3 }, 'row2+=0.6')
      .to(konnichiwa, { autoAlpha: 1, y: 0, duration: 0.4 }, 'row2+=0.75')
      .to(langPill, { x: 0, duration: 0.45, ease: MOTION.easeInOut }, 'row2+=1.7')
      .to(hello, { autoAlpha: 1, duration: 0.3 }, 'row2+=1.85')
      .to(hub, { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'back.out(1.7)', stagger: 0.08 }, 'row2+=0.4')
      .to(network, { opacity: 1, duration: 0.4, stagger: 0.1 }, 'row2+=0.8')
      .to(places, { autoAlpha: 1, x: 0, y: 0, duration: 0.6, ease: MOTION.easeInOut, stagger: 0.12 }, 'row2+=0.8')
      .to(tags, { autoAlpha: 1, y: 0, duration: 0.3, stagger: 0.12 }, 'row2+=1.3')
      .addLabel('row2Done', 'row2+=2.4')

      // Step 4 (1:32–1:37): on to row 3. Parking and its quote appear, the week's bars grow (the
      // last, today, lit), then the demo card rises in
      .to(content, { y: showInStage(section, content, rows[2]), duration: MOTION.slow, ease: MOTION.easeInOut }, 'row2Done')
      .to(rows[2].children[0], { autoAlpha: 1, y: 0, duration: MOTION.base }, 'row2Done+=0.3')
      .addLabel('row3', 'row2Done+=0.7')
      .to(word, { autoAlpha: 1, y: 0, duration: 0.35, stagger: 0.12 }, 'row3')
      .to(bars, { '--grow': 1, duration: 0.5, ease: 'power2.out', stagger: 0.1 }, 'row3+=0.3')
      .to(demo, { autoAlpha: 1, y: 0, duration: 0.6 }, 'row3+=0.6')
      .addLabel('built', 'row3+=1.6');

    // Leaving, as the deployment section slides up over it: the content fades out
    const exit = gsap.timeline({ paused: true })
      .to(content, { autoAlpha: 0, y: '-=40', duration: 0.85, ease: 'power1.in' }, 0.1)
      .set({}, {}, 1);

    scrollScene({ trigger: section, tl, exit, tail: () => section.offsetHeight, onRefresh: applyStart });

    return () => {
      next.classList.remove('slides-over');
      section.classList.remove('is-staged');
    };
  });

  // Phones: the chats, then the step, mode and industry cards come in with the scroll
  scenes.push(({ isMobile }) => {
    if (!isMobile) return;
    [how.header, modes.header, industries.header, values.header].forEach(header => chatThread(header));
    values.cards.forEach(card => scrollReveal(card, card, { autoAlpha: 0, y: 30 }));
    scrollReveal([...industries.cards, industries.controls], industries.gallery, { autoAlpha: 0, x: 40 }, { stagger: 0.1 });
    $$('#how .process-card, #interaction .mode-card').forEach(card => scrollReveal(card, card, { autoAlpha: 0, y: 30 }));
  });

  setupPile();

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
