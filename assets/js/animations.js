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

  gsap.registerPlugin(ScrollTrigger, Flip, MorphSVGPlugin, ...(window.ScrollSmoother ? [ScrollSmoother] : []));

  /* Once per browser session (sessionStorage):
     - the opening plays on the first open, and not again on a refresh;
     - a refresh comes back to where the visitor was (restored by us, after the scenes have
       measured the page);
     - once they have reached "Why would a business need this?" the intro story counts as done:
       on later loads in the session it is shown finished, as a plain stack, and never replays. */
  const session = {
    get: key => { try { return sessionStorage.getItem(`c81:${key}`); } catch (e) { return null; } },
    set: (key, value) => { try { sessionStorage.setItem(`c81:${key}`, value); } catch (e) { /* storage blocked */ } }
  };
  const introSeen = session.get('introSeen') === '1';
  const introDone = session.get('introDone') === '1';
  const reloaded = performance.getEntriesByType?.('navigation')[0]?.type === 'reload';
  if (reloaded && location.hash) history.replaceState(null, '', location.pathname + location.search);
  const savedPlace = (() => {
    if (!introSeen || location.hash) return null;
    try { return JSON.parse(session.get('place')); } catch (e) { return null; }
  })();
  // The page's sections, top to bottom, as places to come back to
  const places = ['.story', '#problem', '#how', '#interaction', '#industries', '#values', '#deployment', '#pricing', '#faq', '#cta', '#contact'];
  // Scenes that load as plain sections, finished: those the visitor has already scrolled back up
  // into this session, and on a return to a place further down every scene above it (they have
  // been seen; nothing replays)
  const plainSaved = (() => { try { return JSON.parse(session.get('plain')) || []; } catch (e) { return []; } })();
  const startsPlain = (el) => {
    const at = places.indexOf(`#${el.id}`);
    return plainSaved.includes(`#${el.id}`) || (!!savedPlace && at >= 0 && at < places.indexOf(savedPlace.id));
  };
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  ScrollTrigger.clearScrollMemory('manual');
  if (!location.hash) scrollTo(0, 0);

  // Smooth scrolling (desktop, created in the matchMedia below); a scroll helper for both cases
  let smoother = null;
  const scrollToY = (y, smooth = true) => {
    if (smooth) glide();
    return smoother ? smoother.scrollTo(y, smooth) : scrollTo({ top: y, behavior: smooth ? 'smooth' : 'auto' });
  };
  // While a link glides the page, the scenes it passes are shown finished instead of holding it
  const glide = () => {
    jumping = true;
    const done = () => { jumping = false; ScrollTrigger.removeEventListener('scrollEnd', done); };
    ScrollTrigger.addEventListener('scrollEnd', done);
  };

  // Shared timing, read from the Figma motion recording (±0.25s)
  const MOTION = {
    ease: 'power3.out',
    easeInOut: 'power2.inOut',
    fast: 0.3,           // chips, small UI
    base: 0.5,           // bubbles, cards fading in
    slow: 0.8,           // kiosk moves, section morphs
    stagger: 0.18,       // features, list items
    typing: 1.4,         // "concierge is typing…" before a reply
    bubbleText: 0.4,     // text fading in after a bubble shape has grown
    pop: 0.32            // a message popping in whole
  };

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Played once the scroll reaches them, at their own pace; they stay shown when the visitor scrolls back
  const PLAY = 'play none none none';

  // Chat thread (phones): visitor bubble → concierge bubble (pops in whole) → everything else,
  // played when the thread scrolls into view
  const chatThread = (scope, { trigger = scope, start = 'top 80%' } = {}) => {
    const items = $$('[data-anim]', scope);
    const user = items.filter(el => el.matches('.msg-row--user, .chat-header-row.right'));
    const reply = items.find(el => el.matches('.header-pill--ai'));
    const rest = items.filter(el => !user.includes(el) && el !== reply);
    const tl = gsap.timeline({ scrollTrigger: { trigger, start, toggleActions: PLAY } });

    if (user.length) {
      tl.fromTo(user, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: MOTION.base, ease: MOTION.ease });
    }
    if (reply) {
      tl.fromTo(reply, { autoAlpha: 0, scale: 0.85, transformOrigin: 'left bottom' },
        { autoAlpha: 1, scale: 1, duration: MOTION.pop, ease: 'back.out(1.8)' }, user.length ? '+=0.15' : 0);
    }
    if (rest.length) {
      tl.fromTo(rest, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: MOTION.base, ease: MOTION.ease, stagger: 0.15 }, '-=0.1');
    }
    return tl;
  };

  // Phones: `targets` move from `from` to their resting state once `trigger` scrolls into the lower
  // part of the screen (one after another when there are several)
  const scrollReveal = (targets, trigger, from, { start = 'top 88%', stagger = 0.12 } = {}) =>
    gsap.fromTo(targets, from, {
      autoAlpha: 1, x: 0, y: 0, duration: MOTION.base, ease: 'power2.out', stagger,
      scrollTrigger: { trigger, start, toggleActions: PLAY }
    });

  // Concierge bubble inside a stepped timeline: it pops in whole, its text already there
  // (starting state set by the scene: autoAlpha 0, scale 0.9, transparent text)
  const bubbleIn = (tl, el, at) => tl
    .set(el, { color: '#FFFFFF' }, at)
    .to(el, { autoAlpha: 1, scale: 1, duration: MOTION.pop, ease: 'back.out(1.8)' }, at);

  // Pinned scenes sit right under the sticky header (--header-h feeds --stage-h in the CSS)
  const siteHeader = $('.site-header');
  const setHeaderHeight = () => root.style.setProperty('--header-h', `${siteHeader.offsetHeight}px`);

  /* Scroll scene: pins `trigger` and plays `tl` as the visitor scrolls. The steps are the
     timeline's labels. The page always moves the moment the visitor scrolls (nothing holds it).
     - Down, into steps not seen yet: they play in order at their own speed; scrolling fast makes
       them catch up quicker, so none is skipped and the scene never lags far behind.
     - Back up: nothing rewinds and nothing is cut short. The first upward scroll into a scene
       turns it into a plain section for good (becomePlain): laid out in full, no pin, scrolling
       like the rest of the page, while whatever was still to play finishes in place. The story
       (its frames are layers of one screen) is the one exception: until it has been seen to the
       end it rewinds smoothly, step by step (`followBack`); after that it turns plain through
       its own `onBack`.
     New steps only ever play on the way down, the first time. Each second of the timeline gets PACE of a screen of
     scrolling; `tail` keeps the scene pinned after its last step (the next section can slide up
     over it). `seen` starts the scene as already watched (the intro, after a refresh past it);
     `startShown` says its first frame is already a full page (the story's hero). `beforeMove` runs
     before the timeline first moves (the story finishes the opening there); `top` is where it pins;
     `onUpdate` gets the timeline's time as it changes. An optional `exit` follows the scroll over
     the tail. `onBack` replaces becomePlain for the way back (the story's own plain sections). */
  const PACE = 0.25; // screen heights of scrolling per second of animation
  const STEP_SPEED = 1.15; // new steps play a little quicker than the timeline, still easy to read
  const CATCH_UP = 1.2; // seconds: further behind than this, new steps speed up to keep up
  let jumping = false; // an in-page link is gliding past scenes: show them finished
  const plainOnStart = []; // scenes to show as plain sections once all are set up
  // A scene is turning plain: the page re-measures while the scroll is still where it was in the
  // old, longer page, so the scenes below must not take that as the visitor reaching them
  let settling = false;
  const settle = (move) => {
    settling = true;
    try { move(); } finally { settling = false; }
  };
  /* The scroll follows the animation (desktop): the visitor can scroll down as far as the end of
     the step that is playing (or, once it has finished, of the next one, which starts as they
     scroll into it), and no further, so a section is never left half built while the next one
     slides in. Each scene says how far it allows (`limits`); the smallest applies. Wheel, trackpad
     and keys stop there, a dragged scrollbar is held there; in-page links glide past freely. */
  const limits = new Set();
  const scrollLimit = () => Math.min(Infinity, ...[...limits].map(limit => limit()));
  const downKeys = ['ArrowDown', 'PageDown', 'End', ' '];
  const atLimit = () => !jumping && scrollY >= scrollLimit() - 1;
  const onLimitWheel = (e) => { if (e.deltaY > 0 && atLimit()) e.preventDefault(); };
  const onLimitKey = (e) => {
    if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
    if (downKeys.includes(e.key) && !(e.key === ' ' && e.shiftKey) && atLimit()) e.preventDefault();
  };
  // When the page puts itself back at the limit, that small move up is not the visitor scrolling
  // back up (it must not turn a finished section plain, see scrollScene)
  let clampedAt = -1e4;
  const pulledBack = () => performance.now() - clampedAt < 400;
  const onLimitScroll = () => {
    if (measuring || settling || jumping) return;
    const max = scrollLimit();
    if (scrollY > max + 1) {
      clampedAt = performance.now();
      scrollToY(max, false);
    }
  };
  const limitScroll = () => {
    addEventListener('wheel', onLimitWheel, { capture: true, passive: false });
    addEventListener('keydown', onLimitKey, { capture: true });
    addEventListener('scroll', onLimitScroll, { passive: true });
    return () => {
      removeEventListener('wheel', onLimitWheel, { capture: true });
      removeEventListener('keydown', onLimitKey, { capture: true });
      removeEventListener('scroll', onLimitScroll);
      limits.clear();
    };
  };

  // The page is re-measuring (a resize): scroll updates then are not the visitor's
  let measuring = false;
  ScrollTrigger.addEventListener('refreshInit', () => { measuring = true; });
  ScrollTrigger.addEventListener('refresh', () => { requestAnimationFrame(() => { measuring = false; }); });
  const scrollScene = ({ trigger, tl, exit, seen: seenAll = false, startShown = false, followBack = false, content = trigger.querySelector(':scope > .container'), top = () => 0, tail = () => 0, beforeMove = () => {}, onUpdate = () => {}, onRefresh = () => {}, onBack = null, hold = () => false, runs = () => [] }) => {
    const span = () => tl.duration() * innerHeight * PACE;
    tl.pause();
    const stops = () => [...new Set([0, ...Object.values(tl.labels), tl.duration()])].sort((x, y) => x - y);
    const stepAfter = time => stops().find(t => t >= time - 0.001) ?? tl.duration();
    // The scene's first moment worth showing: its start when that is already a full page (the story
    // opens on the hero), otherwise its first step (before it, most scenes are still empty)
    const firstStep = () => (startShown ? 0 : stops()[1] ?? tl.duration());
    let seen = seenAll ? Infinity : 0; // the furthest point the visitor has watched
    let playing = null; // new steps under way
    let playingTo = 0;
    let follow = null;  // the scene easing after the scroll over what was seen
    let followTo = -1;
    let viewMove = null; // the view easing after the scroll (other scenes, over what was seen)
    let pin;

    // The view inside the pinned screen at each point the visitor has watched (time → y), so going
    // back retraces it
    const views = [[0, 0]];
    const noteView = (time) => {
      if (!content) return;
      const y = gsap.getProperty(content, 'y');
      const i = views.findIndex(([t]) => Math.abs(t - time) < 0.001);
      if (i >= 0) views[i][1] = y; else views.push([time, y]);
      views.sort((a, c) => a[0] - c[0]);
    };
    const viewAt = (time) => {
      let i = views.findIndex(([t]) => t >= time);
      if (i < 0) return views.at(-1)[1];
      if (i === 0) return views[0][1];
      const [t0, y0] = views[i - 1];
      const [t1, y1] = views[i];
      return y0 + (y1 - y0) * ((time - t0) / Math.max(0.001, t1 - t0));
    };

    // .is-playing: new steps are under way (hover loops and card lifts wait for the step to finish)
    const resting = () => trigger.classList.remove('is-playing');
    const stopAll = () => {
      playing?.kill();
      playing = null;
      resting();
      follow?.kill();
      follow = null;
      viewMove?.kill();
      viewMove = null;
    };
    // Show a step's finished frame straight away (no animation)
    const show = (time) => {
      stopAll();
      tl.time(time);
      noteView(time);
    };
    // Built = everything seen so far is on screen (the other scenes, over what was seen)
    let builtAt = -1;
    const build = () => {
      const built = Math.min(seen, tl.duration());
      if (Math.abs(builtAt - built) < 0.001 && Math.abs(tl.time() - built) < 0.001) return;
      viewMove?.kill();
      tl.time(built);
      builtAt = built;
    };
    // Over what was seen: follow the scroll
    const followSeen = (time, direction = 1) => {
      playing?.kill();
      playing = null;
      resting();
      if (followBack) {
        // Only ever rests on a finished step: moves to the step at this scroll position with a
        // short, smooth transition (never stops on a half-faded frame in between)
        const step = stops().filter(t => t <= time + 0.001).at(-1) ?? 0;
        const goal = direction < 0 ? step : stepAfter(time);
        if (Math.abs(goal - followTo) < 0.001 && (follow?.isActive() || Math.abs(tl.time() - goal) < 0.001)) return;
        follow?.kill();
        followTo = goal;
        follow = tl.tweenTo(goal, { duration: Math.min(0.9, 0.25 + Math.abs(goal - tl.time()) * 0.35), ease: 'power2.inOut' });
        return;
      }
      build();
      if (!content) return;
      viewMove?.kill();
      viewMove = gsap.to(content, { y: viewAt(time), duration: 0.35, ease: 'power2.out', overwrite: false });
    };
    // New steps: play on from what was seen up to `target`, in order, catching up if far behind
    const playOn = (target) => {
      if (playing && Math.abs(target - playingTo) < 0.001) return;
      follow?.kill();
      follow = null;
      viewMove?.kill();
      viewMove = null;
      const from = Math.min(seen, tl.duration());
      if (!playing) {
        if (!followBack) {
          build();
          if (content) gsap.set(content, { y: viewAt(from) }); // the view where the seen part ended
        }
        else if (Math.abs(tl.time() - from) > 0.001) tl.time(from);
      }
      playing?.kill();
      playingTo = target;
      const distance = target - tl.time();
      if (distance <= 0) { playing = null; resting(); return; }
      trigger.classList.add('is-playing');
      const natural = distance / STEP_SPEED;
      const duration = natural <= CATCH_UP ? natural : CATCH_UP + (natural - CATCH_UP) * 0.35;
      const passed = stops().filter(t => t > tl.time() + 0.001 && t <= target + 0.001);
      playing = tl.tweenTo(target, {
        duration,
        ease: 'none',
        onUpdate: () => {
          // each step reached counts as seen, with the view it had
          while (passed.length && tl.time() >= passed[0] - 0.001) {
            seen = Math.max(seen, passed[0]);
            noteView(passed.shift());
          }
        },
        onComplete: () => {
          playing = null;
          resting();
          seen = Math.max(seen, target);
          noteView(target);
          builtAt = Math.min(seen, tl.duration());
        }
      });
    };

    pin = ScrollTrigger.create({
      trigger,
      start: () => `top ${top()}px`,
      end: () => `+=${span() + tail()}`,
      pin: true,
      anticipatePin: 1,
      onRefresh: (self) => { pin = self; } // the first refresh runs before create() returns
    });
    // Measured from the pin (refreshed first): measuring the pinned element itself would count its pin spacing
    const steps = ScrollTrigger.create({
      trigger,
      start: () => pin.start,
      end: () => pin.start + span(),
      onUpdate: (self) => {
        if (self.progress > 0) beforeMove();
        // (a jump past the scroll limit, e.g. a dragged scrollbar, counts as being at the limit:
        // nothing ahead of it plays while the page is put back there; a scene below it waits)
        if (!jumping && scrollLimit() < self.start + 1) return;
        const allowed = jumping ? 1 : gsap.utils.clamp(0, 1, (scrollLimit() - self.start) / Math.max(1, self.end - self.start));
        const at = Math.min(self.progress, allowed) * tl.duration();
        const want = Math.max(firstStep(), stepAfter(at)); // the step at this scroll position
        if (jumping) { // gliding past (a link): everything on the way counts as seen
          seen = Math.max(seen, want);
          show(want);
          return;
        }
        if (self.direction < 0 && tl.time() > 0.001 && !measuring && !pulledBack()) {
          // Back up: a scene seen to its end turns plain (becomePlain; the story through onBack).
          // One not finished yet stays as it is: its step carries on while it is in view and
          // pauses once the visitor has scrolled away from it (watchView), and what is left still
          // plays on the way down. The story can't be scrolled back before it has been seen to the
          // end (its one-way lock); a link back into it rewinds it step by step (followSeen below).
          if (tl.progress() > 0.999 && !playing && (self.isActive || (onBack && self.progress === 0))) {
            (onBack || becomePlain)();
            return;
          }
          if (followBack && !jumping) return;
        }
        const watched = Math.min(seen, tl.duration());
        if (self.direction > 0 && want > watched + 0.001) {
          playOn(want);
          return;
        }
        if (playing) return; // a step under way plays on (never cut short)
        followSeen(Math.max(startShown ? 0 : firstStep(), Math.min(at, watched)), self.direction);
      },
      onRefresh: (self) => {
        // Rewind with the old measurements (the exit first: it ran last), re-measure the starting
        // state, then show (no replay) the finished step at the scroll position. While another
        // scene turns plain (settle), a step under way here carries on from where it was.
        const resume = settling && playing ? { at: tl.time(), to: playingTo } : null;
        stopAll();
        builtAt = -1;
        views.length = 0;
        views.push([0, 0]);
        exit?.progress(0);
        tl.progress(0);
        setHeaderHeight();
        onRefresh();
        tl.invalidate();
        if (self.progress > 0) beforeMove();
        const want = self.progress > 0 ? Math.max(firstStep(), stepAfter(self.progress * tl.duration())) : 0;
        if (!settling) seen = Math.max(seen === Infinity ? Infinity : seen, want); // (see settle)
        // the views seen, re-measured at each step (going back over the seen part retraces them)
        stops().filter(t => t > 0 && t <= Math.min(seen, tl.duration()) + 0.001).forEach((t) => { tl.time(t); noteView(t); });
        tl.time(Math.min(seen, want));
        noteView(tl.time());
        exit?.invalidate();
        if (resume) {
          tl.time(resume.at);
          playingTo = resume.to;
          trigger.classList.add('is-playing');
          playing = tl.tweenTo(resume.to, {
            duration: Math.max(0.05, (resume.to - resume.at) / STEP_SPEED),
            ease: 'none',
            onComplete: () => {
              playing = null;
              resting();
              seen = Math.max(seen, resume.to);
              noteView(resume.to);
              builtAt = Math.min(seen, tl.duration());
            }
          });
        }
      }
    });
    // .is-built: the scene has played to its end (e.g. the device list can be picked from)
    tl.eventCallback('onUpdate', () => {
      onUpdate(tl.time());
      trigger.classList.toggle('is-built', tl.progress() > 0.999);
    });
    // The exit runs over the tail. It starts from wherever things are when the visitor gets there
    // (questions may have been moved by hand), so it re-measures each time it is entered from above.
    let exitTrigger = null;
    if (exit) {
      exitTrigger = ScrollTrigger.create({
        trigger,
        start: () => pin.start + span(),
        end: () => pin.start + span() + tail(),
        animation: exit,
        scrub: 0.6,
        onUpdate: (self) => {
          // scrolling back up while the next section is sliding over it
          if (!onBack && self.direction < 0 && self.isActive && !measuring && !pulledBack() && !playing && tl.progress() > 0.999) becomePlain();
        },
        onEnter: (self) => {
          if (!jumping && scrollY > scrollLimit() + 1) return; // a jump past the limit (it is put back)
          // reaching the tail: whatever is left plays on to the end at its own pace (never cut
          // short) as the next section slides over
          if (tl.progress() < 0.999) playOn(tl.duration());
          else { seen = Infinity; noteView(tl.duration()); }
          exit.invalidate();
        },
        onRefresh: (self) => exit.progress(self.progress)
      });
    }
    // Scroll position of a step (in-page links to a step)
    const toScroll = time => pin.start + (time / tl.duration()) * span(); // where a moment of the timeline is
    const labelToScroll = label => toScroll(tl.labels[label]);
    /* Back up, once the scene has been seen to its end: it becomes a plain section for good,
       laid out in full and scrolling like the rest of the page; the view stays on what the
       visitor was looking at (the section sliding over it, or the part of it nearest the top of
       the screen). Nothing replays later, on the way up or down again. */
    let plain = false;
    const nextOver = () => $$('.slides-over').find(el => trigger.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
    const makePlain = (next = nextOver()) => {
      plain = true;
      seen = Infinity;
      kill();
      // the view moves belonged to the pinned screen; a plain section scrolls by itself
      if (content) {
        tl.getTweensOf(content).forEach(tween => tween.kill());
        gsap.set(content, { y: 0 });
      }
      trigger.classList.add('is-plain');
      next?.classList.remove('slides-over');
      resting();
      tl.progress(1);
    };

    // How far down the visitor may scroll (see `limits`): to the end of the step under way, or of
    // the next one once it has finished; held at the current one while the scene's own animation
    // runs (`hold`: the inbox's rain and demo); no limit once the scene has been seen to its end
    limits.add(() => {
      if (plain || !pin) return Infinity;
      const done = Math.min(seen, tl.duration());
      if (done >= tl.duration() - 0.001 && !playing && !hold()) return Infinity;
      const next = playing ? playingTo : (hold() ? done : (stops().find(t => t > done + 0.001) ?? tl.duration()));
      return toScroll(Math.max(next, firstStep()));
    });
    // What is playing pauses while the scene is out of view (the visitor has scrolled up away from
    // it) and carries on when they come back, so they see all of it
    const watchView = () => {
      const r = trigger.getBoundingClientRect();
      const away = r.bottom <= 0 || r.top >= innerHeight;
      playing?.paused(away);
      runs().forEach((run) => { if (run.progress() > 0 && run.progress() < 1) run.paused(away); });
    };
    addEventListener('scroll', watchView, { passive: true });
    ScrollTrigger.addEventListener('refresh', watchView); // (positions change when the page re-measures)
    function becomePlain() {
      if (plain) return;
      const next = nextOver();
      const onScreen = el => { const r = el.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; };
      const anchor = next && onScreen(next) ? next
        : $$('.chat-section-header, [data-anim], .bento-row', trigger).find(el => { const r = el.getBoundingClientRect(); return r.height && r.top >= 0 && r.top < innerHeight; }) || trigger;
      const at = anchor.getBoundingClientRect().top;
      makePlain(next);
      session.set('plain', JSON.stringify([...new Set([...(JSON.parse(session.get('plain') || '[]')), `#${trigger.id}`])]));
      // (the smooth scrolling is paused for the move, so it doesn't ease on from where it was)
      settle(() => {
        smoother?.paused(true);
        ScrollTrigger.refresh();
        const y = Math.max(0, topOf(anchor) - at);
        smoother?.paused(false);
        scrollToY(y, false);
        ScrollTrigger.update();
      });
    }

    // Stops the scene for good: unpinned, nothing playing (the timeline stays where it is)
    function kill() {
      removeEventListener('scroll', watchView);
      ScrollTrigger.removeEventListener('refresh', watchView);
      stopAll();
      steps.kill();
      exitTrigger?.kill();
      exit?.kill();
      tl.pause();
      pin.kill(true);
    }
    // Seen this session already: plain from the start (once every scene is set up, so the next
    // section's slide-over can be dropped)
    if (!onBack && startsPlain(trigger)) plainOnStart.push(() => makePlain());
    return { pin, scrub: { labelToScroll }, steps, kill };
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
     Plays once per browser session, on the first open: it waits until the page (avatar, photos)
     has loaded, then the greeting pops in whole and flies into the hero. The page can't be
     scrolled while it plays, so every first visitor sees it. A refresh in the same session, a
     #section link or reduced motion skip it. Runs once, outside matchMedia. */
  const OPENING_SLOW = 1.2; // the greeting's glide into the hero and the card building around it
  const runOpening = () => {
    const splash = $('.splash');
    let done = false;
    let tl;
    let dotsLoop;

    const finish = () => {
      if (done) return;
      done = true;
      session.set('introSeen', '1');
      root.classList.remove('is-opening');
      finishOpening = () => {};
      tl?.kill();
      dotsLoop?.kill();
      splash?.remove();
      gsap.set(heroParts, { autoAlpha: 1, clearProps: 'transform' });
      gsap.set(hero.surface, { '--hero-surface': 1 });
    };

    if (!splash || prefersReducedMotion || location.hash || introSeen) {
      finish();
      return;
    }
    finishOpening = finish;
    root.classList.add('is-opening'); // no scrolling until the opening has played
    scrollTo(0, 0);

    const msg = $('.splash-msg', splash);
    const bubble = $('.splash-bubble', splash);
    const dots = $('.splash-dots', splash);
    const text = $('.splash-text', splash);
    const caption = $('.splash-caption', splash);
    const heroBubble = $('.bubble', hero.greeting);

    // Bubble sizes: the full greeting, and the small one-line "•••" bubble shown while typing
    const style = getComputedStyle(bubble);
    const full = { width: bubble.offsetWidth, height: bubble.offsetHeight };
    const typing = {
      width: dots.offsetWidth + 2 * parseFloat(style.paddingLeft),
      height: parseFloat(style.lineHeight) + 2 * parseFloat(style.paddingTop)
    };
    gsap.set(bubble, { ...typing, autoAlpha: 0 });
    gsap.set([text, caption], { autoAlpha: 0 });
    gsap.set(msg, { visibility: 'visible' }); // everything inside starts hidden now
    dotsLoop = gsap.to($$('i', dots), {
      y: -3, opacity: 0.4, duration: 0.35, ease: 'sine.inOut',
      stagger: { each: 0.12, repeat: -1, yoyo: true }
    });

    tl = gsap.timeline({ paused: true, onComplete: finish })
      .fromTo(bubble, { scale: 0.6, transformOrigin: 'left bottom' }, { autoAlpha: 1, scale: 1, duration: MOTION.fast, ease: 'back.out(2)' })
      .to(caption, { autoAlpha: 1, duration: MOTION.fast }, '<0.1')
      // a short "typing…", then the whole greeting pops in at once
      .addLabel('greet', `+=${MOTION.typing}`)
      .set(dots, { autoAlpha: 0 }, 'greet')
      .set(bubble, full, 'greet')
      .set(text, { autoAlpha: 1 }, 'greet')
      .call(() => { caption.textContent = 'concierge · 9:12 AM'; }, null, 'greet')
      .fromTo(bubble, { scale: 0.86 }, { scale: 1, duration: MOTION.pop, ease: 'back.out(1.8)', immediateRender: false }, 'greet')
      // hold, then hand the greeting to the hero while the card builds around it
      .addLabel('handoff', 'greet+=1.8')
      .to(splash, { backgroundColor: 'rgba(255, 255, 255, 0)', duration: OPENING_SLOW, ease: 'none' }, 'handoff')
      .to(msg, {
        x: () => heroBubble.getBoundingClientRect().left - bubble.getBoundingClientRect().left,
        y: () => heroBubble.getBoundingClientRect().top - bubble.getBoundingClientRect().top,
        duration: OPENING_SLOW, ease: MOTION.easeInOut
      }, 'handoff')
      .fromTo(hero.surface, { '--hero-surface': 0 }, { '--hero-surface': 1, duration: OPENING_SLOW }, 'handoff')
      .fromTo(hero.avatar, { autoAlpha: 0, scale: 1.04, transformOrigin: '50% 100%' },
        { autoAlpha: 1, scale: 1, duration: OPENING_SLOW, ease: MOTION.ease }, 'handoff+=0.2')
      .fromTo(hero.top, { autoAlpha: 0 }, { autoAlpha: 1, duration: MOTION.base }, 'handoff+=0.3')
      // the greeting lands: the real hero bubble takes over from the splash copy
      .set(hero.greeting, { autoAlpha: 1 }, `handoff+=${OPENING_SLOW}`)
      .set(msg, { autoAlpha: 0 }, `handoff+=${OPENING_SLOW}`)
      .fromTo(hero.composer, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.7, ease: MOTION.ease })
      .fromTo(hero.controls, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: MOTION.fast, ease: MOTION.ease, stagger: 0.16 })
      // the visitor "sends" the suggested question: it pops in whole
      .fromTo(hero.question, { autoAlpha: 0, scale: 0.86, transformOrigin: 'right bottom' },
        { autoAlpha: 1, scale: 1, duration: MOTION.pop, ease: 'back.out(1.8)' }, '+=0.6');

    // Start once everything has loaded, so nothing pops in half-drawn (a slow network still
    // starts it after a few seconds)
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      tl.play();
      // never leaves the page locked: if the browser stalls its frames, the opening ends anyway
      setTimeout(finish, (tl.duration() + 4) * 1000);
    };
    if (document.readyState === 'complete') start();
    else {
      addEventListener('load', start, { once: true });
      setTimeout(start, 4000);
    }
  };

  /* ---- Scenes: each is ({ isDesktop, isMobile }) => cleanup?, rebuilt when the breakpoint changes ---- */
  const scenes = [];

  // The intro story as plain sections (hero, intro, features stacked, everything shown, nothing
  // pinned): once the visitor scrolls back up into it, and on later loads in the session. The
  // site header slides away as the inbox comes in (as it does in the story) and back above it.
  const STORY_PROPS = 'transform,opacity,visibility,color,backgroundColor,boxShadow,--avatar-clip-bottom,--avatar-glow';
  const plainStory = () => {
    const story = $('.story');
    const hidden = $$('[data-anim], .hero-card-top, .chat-composer', story).filter(el => +getComputedStyle(el).opacity < 0.5);
    gsap.set([story, ...$$('*', story)], { clearProps: STORY_PROPS });
    gsap.set($$('[data-anim]', story), { autoAlpha: 1 });
    // what was hidden at that moment (the hero card's top bar and composer after the first step)
    // fades back in rather than snapping
    // (it ends set visible: clearing it would hand data-anim parts back to the CSS that hides them)
    gsap.fromTo(hidden, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5, ease: 'power1.out' });
    gsap.set(hero.surface, { '--hero-surface': 1 });
    gsap.set(siteHeader, { clearProps: 'transform' });
    root.classList.add('story-plain');
    const header = ScrollTrigger.create({
      trigger: '#problem',
      start: 'top 60%',
      onEnter: () => gsap.to(siteHeader, { yPercent: -100, duration: 0.4, ease: MOTION.easeInOut }),
      onLeaveBack: () => gsap.to(siteHeader, { yPercent: 0, duration: 0.4, ease: MOTION.easeInOut }),
      onRefresh: self => gsap.set(siteHeader, { yPercent: self.progress > 0 || scrollY > self.start ? -100 : 0 })
    });
    return () => {
      header.kill();
      root.classList.remove('story-plain');
      gsap.set(siteHeader, { clearProps: 'transform' });
    };
  };

  /* 3–5. Desktop story (Figma recording 11–25s): hero, intro and features share one pinned screen.
     The kiosk stays still while the chat changes around it, and only moves at set steps.
     The timeline moves with the scroll (scrollScene) and stops when the scroll stops.
     Only transforms and opacity animate. */
  scenes.push(({ isDesktop }) => {
    if (!isDesktop) return;
    if (introDone) return plainStory(); // already watched this session: never replayed
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
    // The features headline shrinks as it settles just below the top edge of the screen, wherever
    // the (screen-centred) features block puts it, making room for the kiosk (as in the Figma)
    const headlineTop = () => innerHeight * 0.035;
    const headlineScale = 0.6;
    const headlineToTop = () => {
      const top = featuresHeadline.getBoundingClientRect().top - gsap.getProperty(featuresHeadline, 'y');
      return Math.min(0, headlineTop() - top);
    };
    // Features step: with the site header gone, the feature stage and kiosk rise until the kiosk is
    // centred in the whole screen (as in the recording; the story sits under the header's height).
    // It never rises past the headline: a kiosk too tall to centre stops just under it and runs
    // off the bottom edge instead.
    const centreLift = () => {
      const slot = within(featuresKiosk);
      const top = siteHeader.offsetHeight + slot.y - gsap.getProperty(featuresStage, 'y');
      const highest = headlineTop() + featuresHeadline.offsetHeight * headlineScale + innerHeight * 0.03;
      return Math.max(0, Math.min(top - (innerHeight - slot.height) / 2, top - highest));
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
      // back never slides the kiosk over the text) and the site header slides up off the screen
      // (so the features headline, which grows next, never sits under it)
      .to([intro.question, intro.headline, ...intro.rest], { autoAlpha: 0, y: -50, duration: 0.4, stagger: 0.05, ease: 'power2.in' }, 'intro')
      .to(siteHeader, { yPercent: -100, duration: 0.5, ease: MOTION.easeInOut }, 'intro+=0.3')
      .to(traveller, { ...onSlot(featuresKiosk), duration: MOTION.slow, ease: MOTION.easeInOut }, 'intro+=0.5');
    bubbleIn(tl, featuresHeadline, 'intro+=1.2')
      .addLabel('features')

      // Step 4 (21–24s): everything moves up into the header's space: the headline shrinks to just
      // below the top edge, and the kiosk and features rise to show the whole kiosk; once the kiosk is in
      // place the features slide out from behind it row by row
      .to(featuresHeadline, { y: headlineToTop, scale: headlineScale, transformOrigin: 'left top', duration: 0.5, ease: MOTION.easeInOut }, 'features')
      .to(featuresStage, { y: () => -centreLift(), duration: 0.6, ease: MOTION.easeInOut }, 'features+=0.1')
      .to(traveller, { ...onSlot(featuresKiosk, centreLift), duration: 0.6, ease: MOTION.easeInOut }, 'features+=0.1')
      .addLabel('popOut', 'features+=0.7');
    left.forEach((el, i) => {
      tl.to([el, right[i]].filter(Boolean), { autoAlpha: 1, x: 0, duration: 0.7 }, `popOut+=${i * 0.3}`);
    });
    tl.addLabel('fan');

    // The site header stays away for the rest of the page; it comes back only when the visitor
    // scrolls back up to the intro step (the header tween above runs back)
    // Once the story has been seen to the end, scrolling back up turns it into plain sections
    // (before that it rewinds step by step), the view staying on what the visitor was looking at
    // (the inbox where it had slid over, otherwise the step's main part: the hero card, the intro
    // kiosk, or the features with their kiosk)
    let plain = null;
    const becomePlain = () => {
      if (plain) return;
      const t = tl.time();
      const inbox = next.getBoundingClientRect();
      const anchor = inbox.top < innerHeight && inbox.bottom > 0 ? next
        : t < tl.labels.kiosk - 0.001 ? hero.surface : t < tl.labels.features - 0.001 ? introKiosk : featuresStage;
      const onScreen = anchor.getBoundingClientRect().top;
      scene.kill();
      unstage();
      plain = plainStory();
      // (the smooth scrolling is paused for the move, so it doesn't ease on from where it was)
      settle(() => {
        smoother?.paused(true);
        ScrollTrigger.refresh();
        const y = Math.max(0, topOf(anchor) - onScreen);
        smoother?.paused(false);
        scrollToY(y, false);
        ScrollTrigger.update();
      });
    };

    const scene = scrollScene({
      trigger: story,
      tl,
      startShown: true, // its start is the hero, a full page
      followBack: true, // until seen to the end, it rewinds smoothly with the scroll
      top: () => siteHeader.offsetHeight,
      tail: () => story.offsetHeight, // the inbox section slides up over the finished story
      beforeMove: () => finishOpening(), // scrolling (or a reload restoring the scroll position) ends the opening first
      onBack: becomePlain,
      onRefresh: () => {
        fitTraveller();
        applyStart();
      }
    });

    /* One way through the opening: until the visitor reaches the team inbox, the page doesn't
       scroll back up (wheel, trackpad, keys; a dragged scrollbar is held at the furthest point
       reached), so the story is always watched through, never rewound or cut. Scrolling down
       and in-page links work as usual. Once the inbox has slid half way up over it, it unlocks
       for good (the session remembers), and the story is plain sections on the way back. */
    let furthest = scrollY;
    const remeasured = () => { furthest = scrollY; }; // positions change when the page re-measures
    const upKeys = ['ArrowUp', 'PageUp', 'Home'];
    const onWheel = (e) => { if (e.deltaY < 0 && !jumping) e.preventDefault(); };
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
      if (upKeys.includes(e.key) || (e.key === ' ' && e.shiftKey)) e.preventDefault();
    };
    const onScroll = () => {
      if (measuring) return;
      if (scrollY >= topOf(next) - innerHeight * 0.5) { // the inbox has slid half way up: free from now on
        session.set('introDone', '1');
        unlock();
        return;
      }
      if (jumping || scrollY >= furthest) furthest = scrollY;
      else if (scrollY < furthest - 1) scrollToY(furthest, false);
    };
    const unlock = () => {
      removeEventListener('wheel', onWheel, { capture: true });
      removeEventListener('keydown', onKey, { capture: true });
      removeEventListener('scroll', onScroll);
      ScrollTrigger.removeEventListener('refresh', remeasured);
    };
    addEventListener('wheel', onWheel, { capture: true, passive: false });
    addEventListener('keydown', onKey, { capture: true });
    addEventListener('scroll', onScroll, { passive: true });
    ScrollTrigger.addEventListener('refresh', remeasured);

    // In-page links to the intro and features land on their step inside the pinned story
    const stepLinks = { '#intro': 'intro', '#features': 'fan' };
    const onStepLink = (e) => {
      if (plain) return; // plain sections: the link goes to the section itself
      const link = e.target.closest('a[href^="#"]');
      const label = link ? stepLinks[link.getAttribute('href')] : undefined;
      if (label === undefined) return; // not one of the story's links: leave the click alone
      e.preventDefault();
      e.stopPropagation(); // capture phase: main.js's smooth scroll would aim at the layer instead
      scrollToY(scene.scrub.labelToScroll(label));
      history.replaceState(null, '', link.getAttribute('href'));
    };
    document.addEventListener('click', onStepLink, true);
    if (location.hash in stepLinks) requestAnimationFrame(() => scrollToY(scene.scrub.labelToScroll(stepLinks[location.hash]), false));

    function unstage() {
      gsap.set(siteHeader, { clearProps: 'transform' });
      traveller.remove();
      morph.remove();
      morphEdge.remove();
      story.classList.remove('is-staged');
      next.classList.remove('slides-over');
    }

    return () => {
      document.removeEventListener('click', onStepLink, true);
      unlock();
      if (plain) plain();
      else unstage();
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
     story. The visitor asks, the concierge answers; the inbox card darkens in, then on their own
     the questions rain into a pile and two are lifted out and dropped back (drag demo), after
     which the questions can be picked up; the next scroll moves the view down and "Let me handle
     the repeats." answers. The questions move by GSAP transforms (smoother
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

    // The rain and the drag demo play on their own, at their own pace, once the visitor has
    // reached the card (they don't need the scroll, and the scroll never waits for them); then
    // the questions can be picked up. Built below; reset with the scene.
    let show = null;
    let showKept = 0; // how far the show had got when the page re-measured while a scene turned plain
    const applyStart = () => {
      showKept = settling && show ? show.progress() : 0;
      show?.pause(0);
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
      show?.invalidate();
      pile.classList.add('is-busy');
    };
    applyStart();

    // The rain (recording 28–30s): the questions fall into the pile from the bottom up and the
    // glow rises under it. Then the drag demo (30.5–34s): "Where is the restroom?" is lifted out
    // with the cursor, hovers, and drops back; then "What time do you open?" does the same.
    show = gsap.timeline({ paused: true, onComplete: () => pile.classList.remove('is-busy') })
      .to(pile, { '--pile-glow': 1, duration: 1.8, ease: 'none' }, 0);
    tags.forEach((tag, i) => {
      const at = fallDelay(i) * 2;
      const rest = inbox.rest(tag);
      show.to(tag, { autoAlpha: 1, duration: 0.2, ease: 'none' }, at)
        .to(tag, { y: rest.y, duration: 1.4, ease: 'bounce.out' }, at)
        .to(tag, { rotation: rest.rotation, duration: 1.4, ease: 'back.out(1.7)' }, at);
    });
    show.addLabel('demo', '+=0.3')
      .set(float, { zIndex: 20 }, 'demo')
      .fromTo(float, { y: floatInPile, rotation: -6 }, { y: 0, rotation: 4, duration: 0.6, ease: MOTION.easeInOut, immediateRender: false }, 'demo')
      .to(floatCursor, { opacity: 1, duration: 0.2 }, 'demo')
      .to(float, { y: -10, rotation: 2, duration: 0.4, ease: 'sine.inOut' }, 'demo+=0.6')
      .to(float, { y: floatInPile, rotation: -6, duration: 0.9, ease: 'bounce.out' }, 'demo+=1.0')
      .to(floatCursor, { opacity: 0, duration: 0.2 }, 'demo+=1.0')
      .set(open, { zIndex: 20 }, 'demo+=1.6')
      .fromTo(open, { x: 0, y: openRest.y, rotation: openRest.rotation }, { x: 40, y: -120, rotation: -14, duration: 0.5, ease: MOTION.easeInOut, immediateRender: false }, 'demo+=1.6')
      .to(open, { y: -132, rotation: -11, duration: 0.4, ease: 'sine.inOut' }, 'demo+=2.1')
      .to(open, { x: 0, y: openRest.y, rotation: openRest.rotation, duration: 0.9, ease: 'bounce.out' }, 'demo+=2.5');

    const tl = gsap.timeline({ paused: true, defaults: { ease: MOTION.ease } });
    tl.addLabel('enter', 0)

      // Step 1 (26–28s): the visitor asks (grey → black), the concierge bubble grows, then the sub-bubble
      .to(askUser, { autoAlpha: 1, y: 0, duration: MOTION.base }, 0.01)
      .to(askPill, { backgroundColor: '#0E1013', duration: 0.4, ease: 'none' }, 0.3);
    bubbleIn(tl, askReply, 0.6)
      .to(askSub, { autoAlpha: 1, y: 0, duration: MOTION.base }, '-=0.1')
      .addLabel('ask')

      // Step 2 (28–30s): the view moves to the inbox and the card darkens in; once the whole card
      // is in view the rain and the demo play on their own (show)
      .to(content, { y: showCard, duration: MOTION.slow, ease: MOTION.easeInOut }, 'ask')
      .to(card, { autoAlpha: 1, duration: 0.3, ease: 'none' }, 'ask+=0.1')
      .to(card, { backgroundColor: '#0E1013', duration: 0.6, ease: 'none' }, 'ask+=0.25')
      .to(head, { autoAlpha: 1, duration: 0.4 }, 'ask+=0.55')
      .addLabel('inbox', 'ask+=0.95')

      // Step 3 (34.5–36s), on the next scroll: the view moves down; "Let me handle the repeats."
      // grows, then the sub-bubble
      .to(content, { y: showClosing, duration: MOTION.slow, ease: MOTION.easeInOut }, 'inbox');
    bubbleIn(tl, closingReply, 'inbox+=0.6')
      .to(closingSub, { autoAlpha: 1, y: 0, duration: MOTION.base }, '-=0.1')
      .addLabel('repeats');

    // The card in full view starts the show. When the page is only re-measuring (a refresh past
    // it, a resize), or a link glides past, it is shown finished instead: it never replays.
    const startShow = (time) => {
      if (time < tl.labels.inbox - 0.001 || show.progress() > 0) return;
      if (showKept > 0 && showKept < 1) show.progress(showKept).play(); // carries on from where it was
      else if (measuring || jumping) show.progress(1);
      else show.play();
      showKept = 0;
    };

    // Leaving, as the next section slides up over it: everything stays as the visitor left it
    // (the questions stay in the pile); the content only drifts up a little as it is covered
    const exit = gsap.timeline({ paused: true })
      .to(content, { y: '-=40', duration: 1, ease: 'none' }, 0);
    const next = $('#how');
    next.classList.add('slides-over');

    scrollScene({
      trigger: section,
      tl,
      exit,
      tail: () => section.offsetHeight, // the How section slides up over the inbox
      onUpdate: startShow,
      onRefresh: applyStart,
      // the scroll waits for the rain and the demo, which pause while the visitor is away
      hold: () => tl.time() >= tl.labels.inbox - 0.001 && show.progress() < 1,
      runs: () => [show]
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
      autoAlpha: 1, y: i => inbox.rest(inbox.tags[i]).y, duration: 0.9, ease: 'bounce.out',
      stagger: { each: 0.04, from: 'random' },
      scrollTrigger: { trigger: inbox.card, start: 'top 65%', toggleActions: PLAY }
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
      .to(content, { y: '-=40', duration: 1, ease: 'none' }, 0) // stays shown; only drifts as it is covered
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
      .to(content, { y: '-=40', duration: 1, ease: 'none' }, 0) // stays shown; only drifts as it is covered
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
      .to(content, { y: '-=40', duration: 1, ease: 'none' }, 0) // stays shown; only drifts as it is covered
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
      gsap.set(tabs[0], { color: '#FFFFFF' });
      gsap.set(konnichiwa, { autoAlpha: 0, y: 12 });
      gsap.set(hello, { autoAlpha: 1, y: 0 });
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
      .addLabel('row1', 'ask+=1.15') // after both cards have risen in (a step never ends mid-fade)
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
      .addLabel('row2', 'row1Done+=1.25')
      .to(infoBox, { autoAlpha: 1, y: 0, duration: 0.4 }, 'row2')
      .to(branches, { strokeDashoffset: 0, duration: 0.6, ease: 'power1.inOut', stagger: 0.1 }, 'row2+=0.4')
      .to(nodes, { autoAlpha: 1, scale: 1, duration: 0.35, ease: 'back.out(1.7)', stagger: 0.15 }, 'row2+=0.8')
      // EN → JP: the pill and the white label move to JP; Hello. leaves and こんにちは。 takes its place
      .to(langPill, { x: tabShift, duration: 0.45, ease: MOTION.easeInOut }, 'row2+=0.5')
      .to(tabs[0], { color: '#A8A49A', duration: 0.3 }, 'row2+=0.55')
      .to(tabs[1], { color: '#FFFFFF', duration: 0.3 }, 'row2+=0.65')
      .to(hello, { autoAlpha: 0, y: -12, duration: 0.3, ease: 'power2.in' }, 'row2+=0.6')
      .to(konnichiwa, { autoAlpha: 1, y: 0, duration: 0.4 }, 'row2+=0.85')
      // JP → EN: back again, こんにちは。 leaves and Hello. returns
      .to(langPill, { x: 0, duration: 0.45, ease: MOTION.easeInOut }, 'row2+=1.7')
      .to(tabs[1], { color: '#A8A49A', duration: 0.3 }, 'row2+=1.75')
      .to(tabs[0], { color: '#FFFFFF', duration: 0.3 }, 'row2+=1.85')
      .to(konnichiwa, { autoAlpha: 0, y: 12, duration: 0.3, ease: 'power2.in' }, 'row2+=1.8')
      .to(hello, { autoAlpha: 1, y: 0, duration: 0.4 }, 'row2+=2.05')
      .to(hub, { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'back.out(1.7)', stagger: 0.08 }, 'row2+=0.4')
      .to(network, { opacity: 1, duration: 0.4, stagger: 0.1 }, 'row2+=0.8')
      .to(places, { autoAlpha: 1, x: 0, y: 0, duration: 0.6, ease: MOTION.easeInOut, stagger: 0.12 }, 'row2+=0.8')
      .to(tags, { autoAlpha: 1, y: 0, duration: 0.3, stagger: 0.12 }, 'row2+=1.3')
      .addLabel('row2Done', 'row2+=2.55')

      // Step 4 (1:32–1:37): on to row 3. Parking and its quote appear, the week's bars grow (the
      // last, today, lit), then the demo card rises in
      .to(content, { y: showInStage(section, content, rows[2]), duration: MOTION.slow, ease: MOTION.easeInOut }, 'row2Done')
      .to(rows[2].children[0], { autoAlpha: 1, y: 0, duration: MOTION.base }, 'row2Done+=0.3')
      .addLabel('row3', 'row2Done+=0.85')
      .to(word, { autoAlpha: 1, y: 0, duration: 0.35, stagger: 0.12 }, 'row3')
      .to(bars, { '--grow': 1, duration: 0.5, ease: 'power2.out', stagger: 0.1 }, 'row3+=0.3')
      .to(demo, { autoAlpha: 1, y: 0, duration: 0.6 }, 'row3+=0.6')
      .addLabel('built', 'row3+=1.6');

    // Leaving, as the deployment section slides up over it: the content fades out
    const exit = gsap.timeline({ paused: true })
      .to(content, { y: '-=40', duration: 1, ease: 'none' }, 0) // stays shown; only drifts as it is covered
      .set({}, {}, 1);

    scrollScene({ trigger: section, tl, exit, tail: () => section.offsetHeight, onRefresh: applyStart });

    return () => {
      next.classList.remove('slides-over');
      section.classList.remove('is-staged');
    };
  });

  /* 13. Where would my concierge live? (Figma recording 1:38–2:01). Desktop: a scroll scene that
     slides up over Why concierge81?. The visitor asks and the concierge answers; then the device
     appears as a website screen, and each place joins the list in turn while the device turns into
     it: kiosk, website, tablet, then phone. It is one live screen: the same avatar and chat move and
     resize into each device's layout as it reshapes. All with the scroll. */
  const deployment = {
    section: $('#deployment'),
    content: $('#deployment > .container'),
    header: $('#deployment .chat-section-header'),
    split: $('#deployment .deploy-split'),
    stage: $('#deployment .deploy-stage'),
    device: $('#deployment .device'),
    cards: $$('#deployment .platform-card')
  };

  scenes.push(({ isDesktop }) => {
    if (!isDesktop) return;
    const { section, content, header, split, stage, device, cards } = deployment;
    const user = $('.chat-header-row.right', header);
    const pill = $('.header-pill--user', user);
    const reply = $('.header-pill--ai', header);
    const sub = $('.sub-pill-text', header);
    const pillColor = getComputedStyle(pill).backgroundColor;
    const screen = $('.device-screen', device);
    const ui = Object.fromEntries(['logo', 'toggle', 'lang', 'avatar', 'greet', 'question', 'composer']
      .map(key => [key, $(`.ds-${key}`, screen)]));
    $('img', ui.avatar).removeAttribute('loading'); // shown before the scene starts
    const MORPH = 1.6; // seconds of timeline for the device to turn into the next one
    const PLACE = 2.2; // seconds of timeline per place (its card, then the morph)
    section.classList.add('is-staged');
    stage.classList.add('is-shaping');

    // Each place's device, sized to the stage: the screen's own proportions inside the bezel
    const frame = 3; // the device's border
    const shapes = {
      website: { ratio: 1440 / 900, bezel: 4, radius: 15, wide: true },
      kiosk: { ratio: 720 / 1280, bezel: 10, radius: 22 },
      tablet: { ratio: 834 / 1194, bezel: 12, radius: 26 },
      mobile: { ratio: 393 / 852, bezel: 9, radius: 36 }
    };
    const shape = (name) => {
      const { ratio, bezel, radius, wide } = shapes[name];
      const edge = 2 * (bezel + frame);
      const width = wide ? stage.clientWidth * 0.89 : null;
      const height = wide ? (width - edge) / ratio + edge : stage.clientHeight * 0.86;
      return {
        width: wide ? width : (height - edge) * ratio + edge,
        height,
        padding: bezel,
        borderRadius: radius
      };
    };
    const shapeTo = name => Object.fromEntries(
      ['width', 'height', 'padding', 'borderRadius'].map(key => [key, () => shape(name)[key]])
    );
    // The concierge screen's layout on each device (Figma frames, in % of the screen; --fs is the
    // bubble text as a share of the screen's width). One avatar and one chat move between them.
    const layouts = {
      website: {
        screen: { '--fs': 1.53 },
        logo: { left: '3%', top: '5%' },
        toggle: { left: '77%', top: '4%' },
        lang: { right: '3%', top: '4%' },
        avatar: { left: '4%', top: '10%', width: '39%', height: '90%' },
        greet: { left: '47%', top: '15%' },
        question: { right: '4%', top: '27%' },
        composer: { left: '47%', top: '64%', width: '50%', height: '31%' }
      },
      kiosk: {
        screen: { '--fs': 3.61 },
        logo: { left: '4%', top: '3.5%' },
        toggle: { left: '63%', top: '2.6%' },
        lang: { right: '4%', top: '2.6%' },
        avatar: { left: '16%', top: '7%', width: '68%', height: '53%' },
        greet: { left: '4%', top: '61.5%' },
        question: { right: '4%', top: '68.5%' },
        composer: { left: '4%', top: '79%', width: '92%', height: '17.5%' }
      },
      tablet: {
        screen: { '--fs': 2.63 },
        logo: { left: '4.5%', top: '4%' },
        toggle: { left: '62%', top: '3%' },
        lang: { right: '4.5%', top: '3%' },
        avatar: { left: '24%', top: '7%', width: '52%', height: '49%' },
        greet: { left: '3.5%', top: '57.5%' },
        question: { right: '4.5%', top: '65%' },
        composer: { left: '3.5%', top: '76%', width: '92%', height: '20.5%' }
      },
      mobile: {
        screen: { '--fs': 5.16 },
        logo: { left: '4%', top: '3.5%' },
        toggle: { left: '25%', top: '8%' },
        lang: { right: '4.5%', top: '2.6%' },
        avatar: { left: '20%', top: '13%', width: '60%', height: '28%' },
        greet: { left: '4%', top: '43%' },
        question: { right: '4.5%', top: '54%' },
        composer: { left: '4%', top: '66%', width: '91.5%', height: '30.5%' }
      }
    };
    const layoutTo = (name, at) => Object.entries(layouts[name]).forEach(([key, props]) =>
      tl.to(key === 'screen' ? screen : ui[key], { ...props, duration: MORPH, ease: MOTION.easeInOut }, at));
    const setLayout = name => Object.entries(layouts[name]).forEach(([key, props]) =>
      gsap.set(key === 'screen' ? screen : ui[key], props));

    const applyStart = () => {
      gsap.set(content, { y: 0 });
      gsap.set(user, { autoAlpha: 0, y: 12 });
      gsap.set(pill, { backgroundColor: '#A8A49A' });
      gsap.set(reply, { autoAlpha: 0, scale: 0.9, transformOrigin: 'left bottom', color: 'rgba(255, 255, 255, 0)' });
      gsap.set(sub, { autoAlpha: 0, y: 16 });
      gsap.set(stage, { autoAlpha: 0, y: 30 });
      gsap.set(device, { ...shape('website'), scale: 0.92 });
      setLayout('website');
      gsap.set(cards, { autoAlpha: 0, x: 24 });
    };
    applyStart();

    const tl = gsap.timeline({ paused: true, defaults: { ease: MOTION.ease } });
    tl.addLabel('enter', 0)

      // Step 1 (1:38–1:41): the visitor asks (grey → black), the concierge bubble grows, then the sub-bubble
      .to(user, { autoAlpha: 1, y: 0, duration: MOTION.base }, 0.01)
      .to(pill, { backgroundColor: pillColor, duration: 0.4, ease: 'none' }, 0.3);
    bubbleIn(tl, reply, 0.6)
      .to(sub, { autoAlpha: 1, y: 0, duration: MOTION.base }, '-=0.1')
      .addLabel('ask')

      // Step 2 (1:41–1:43): the view moves to the stage; the device rises in as a website screen
      .to(content, { y: showInStage(section, content, split), duration: MOTION.slow, ease: MOTION.easeInOut }, 'ask')
      .to(stage, { autoAlpha: 1, y: 0, duration: MOTION.base }, 'ask+=0.3')
      .to(device, { scale: 1, duration: MOTION.base }, 'ask+=0.4')
      .addLabel('places', 'ask+=1.1');

    // Steps 3–6 (1:43–2:00), one per place: it joins the list and the device turns into it, slowly
    // enough to watch the whole change (on short screens the view moves down just enough to keep
    // the new card in sight)
    const at = i => `places+=${i * PLACE}`;
    cards.forEach((card, i) => {
      const name = card.dataset.device;
      const keepInView = () => Math.min(showInStage(section, content, split)(), showInStage(section, content, card)());
      if (i) tl.addLabel(`place${i}`, at(i));
      tl.to(content, { y: keepInView, duration: 0.5, ease: MOTION.easeInOut }, at(i))
        .to(card, { autoAlpha: 1, x: 0, duration: MOTION.base }, at(i))
        .to(device, { ...shapeTo(name), duration: MORPH, ease: MOTION.easeInOut }, `${at(i)}+=0.2`);
      layoutTo(name, `${at(i)}+=0.2`);
    });
    tl.addLabel('built', `${at(cards.length - 1)}+=${MORPH + 0.4}`);

    // The device on show at a moment of the scene: the last place that has joined the list
    const showing = t => cards.filter((card, i) => t >= tl.labels.places + i * PLACE + 0.2 - 0.001).at(-1)?.dataset.device;
    // Once the list is built the visitor can pick a place: the screen turns into that device. The
    // choice stays (scrolling back, or the page re-measuring, keeps it).
    let chosen = null;
    const mark = name => cards.forEach((card) => {
      card.classList.toggle('is-active', card.dataset.device === name);
      card.setAttribute('aria-pressed', card.dataset.device === name);
    });
    let morphs = []; // the visitor's own morph (a new pick takes over from it, never from the scene)
    const morphTo = (name, duration = 1.2) => {
      morphs.forEach(tween => tween.kill());
      morphs = [
        gsap.to(device, { ...shape(name), duration, ease: MOTION.easeInOut }),
        ...Object.entries(layouts[name]).map(([key, props]) =>
          gsap.to(key === 'screen' ? screen : ui[key], { ...props, duration, ease: MOTION.easeInOut }))
      ];
    };
    const choose = (card) => {
      if (!section.classList.contains('is-built')) return;
      chosen = card.dataset.device;
      mark(chosen);
      morphTo(chosen);
    };
    const onClick = e => { const card = e.target.closest('.platform-card'); if (card) choose(card); };
    const onKey = (e) => {
      const card = e.target.closest('.platform-card');
      if (!card || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      choose(card);
    };
    const list = cards[0].parentElement;
    list.addEventListener('click', onClick);
    list.addEventListener('keydown', onKey);
    cards.forEach((card) => {
      card.setAttribute('role', 'button');
      card.tabIndex = 0;
      card.setAttribute('aria-label', `Show concierge81 on a ${card.dataset.device}`);
    });
    // When the scene shows its finished frame again (the page re-measuring), the choice comes back
    const keepChoice = (t) => {
      if (!chosen || t < tl.labels.built - 0.001 || morphs.some(tween => tween.isActive())) return;
      gsap.set(device, shape(chosen));
      setLayout(chosen);
    };

    // Leaving, as the pricing section slides up over it: the content fades out
    const next = $('#pricing');
    next.classList.add('slides-over');
    const exit = gsap.timeline({ paused: true })
      .to(content, { y: '-=40', duration: 1, ease: 'none' }, 0) // stays shown; only drifts as it is covered
      .set({}, {}, 1);

    scrollScene({
      trigger: section, tl, exit, tail: () => section.offsetHeight, onRefresh: applyStart,
      onUpdate: (t) => {
        mark(chosen || showing(t));
        keepChoice(t);
      }
    });

    return () => {
      list.removeEventListener('click', onClick);
      list.removeEventListener('keydown', onKey);
      cards.forEach((card) => {
        card.classList.remove('is-active');
        ['role', 'tabindex', 'aria-label', 'aria-pressed'].forEach(attr => card.removeAttribute(attr));
      });
      next.classList.remove('slides-over');
      section.classList.remove('is-staged');
      stage.classList.remove('is-shaping');
      gsap.set(device, { clearProps: 'width,height,padding,borderRadius,transform' });
      gsap.set([screen, ...Object.values(ui)], { clearProps: 'all' });
    };
  });

  /* 14. Which setup is right for me? (Figma recording 2:06–2:16). Desktop: a scroll scene that
     slides up over Where would my concierge live?. The visitor asks and the concierge answers;
     then the four tiers arrive one after another, each dark at first and lighting up to its own
     colour while its graphic builds: the basic rings ripple out from their dot, the two circles
     slide together into their overlap, the business dot travels its orbit, and the enterprise
     network draws its spokes and nodes. Then "Not sure which setup is right for you?" arrives.
     All with the scroll. */
  const pricing = {
    section: $('#pricing'),
    content: $('#pricing > .container'),
    header: $('#pricing .chat-section-header'),

    cards: $$('#pricing .tier-card'),
    help: $('#pricing .cta-pill')
  };

  scenes.push(({ isDesktop }) => {
    if (!isDesktop) return;
    const { section, content, header, cards, help } = pricing;
    const user = $('.chat-header-row.right', header);
    const pill = $('.header-pill--user', user);
    const reply = $('.header-pill--ai', header);
    const pillColor = getComputedStyle(pill).backgroundColor;
    const [basic, capacity, business, enterprise] = cards;
    const texts = cards.map(card => $$('.tier-label, h3, p, .btn', card));
    const parts = (card, selector) => $$(selector, card);
    const spokes = parts(enterprise, '.tier-spokes path');
    spokes.forEach(path => path.setAttribute('pathLength', '1'));
    const next = $('#faq');
    section.classList.add('is-staged');
    next.classList.add('slides-over');

    const applyStart = () => {
      gsap.set(content, { y: 0, autoAlpha: 1 });
      gsap.set(user, { autoAlpha: 0, y: 12 });
      gsap.set(pill, { backgroundColor: '#5B5F66' });
      gsap.set(reply, { autoAlpha: 0, scale: 0.9, transformOrigin: 'left bottom', color: 'rgba(255, 255, 255, 0)' });
      gsap.set(cards, { autoAlpha: 0, y: 24, filter: 'brightness(0.35) saturate(0.6)' });
      gsap.set(texts.flat(), { opacity: 0.4 });
      // basic: the dot and its disc, the rings drawn in towards it
      gsap.set(parts(basic, '.tier-dot, .tier-disc'), { scale: 0, svgOrigin: '245 114' });
      gsap.set(parts(basic, '.tier-ring'), { scale: 0.5, opacity: 0, svgOrigin: '245 114' });
      // more capacity: the two circles apart, no overlap yet
      gsap.set(parts(capacity, '.tier-left'), { x: -40 });
      gsap.set(parts(capacity, '.tier-right'), { x: 40 });
      gsap.set(parts(capacity, '.tier-overlap'), { opacity: 0 });
      // business: the dot a third of the way back round its orbit, the disc small
      gsap.set(parts(business, '.tier-dot'), { rotation: -150, svgOrigin: '275.36 59' });
      gsap.set(parts(business, '.tier-disc'), { scale: 0.4, opacity: 0, svgOrigin: '231.36 104' });
      gsap.set(parts(business, '.tier-orbit, .tier-ring'), { opacity: 0 });
      // enterprise: spokes undrawn, nodes and hub hidden
      gsap.set(spokes, { strokeDasharray: 1, strokeDashoffset: 1 });
      gsap.set(parts(enterprise, '.tier-nodes circle'), { scale: 0, transformOrigin: '50% 50%' });
      gsap.set(parts(enterprise, '.tier-dot, .tier-disc'), { scale: 0, svgOrigin: '245 114' });
      gsap.set(parts(enterprise, '.tier-ring'), { opacity: 0 });
      gsap.set(help, { autoAlpha: 0, scale: 0.85, transformOrigin: 'center bottom' });
    };
    applyStart();

    const tl = gsap.timeline({ paused: true, defaults: { ease: MOTION.ease } });
    tl.addLabel('enter', 0)

      // Step 1 (2:06–2:08): the visitor asks (grey → white), then the concierge bubble grows
      .to(user, { autoAlpha: 1, y: 0, duration: MOTION.base }, 0.01)
      .to(pill, { backgroundColor: pillColor, duration: 0.4, ease: 'none' }, 0.3);
    bubbleIn(tl, reply, 0.6)
      .addLabel('ask')
      .to(content, { y: showInStage(section, content, header, help), duration: MOTION.slow, ease: MOTION.easeInOut }, 'ask')
      .addLabel('tiers', 'ask+=0.2');

    // Steps 2–5 (2:08–2:11): each tier arrives dark, lights up to its colour, then its graphic builds
    cards.forEach((card, i) => {
      const at = `tiers+=${i * 0.8}`;
      tl.to(card, { autoAlpha: 1, y: 0, duration: 0.4 }, at)
        .to(card, { filter: 'brightness(1) saturate(1)', duration: 0.5, ease: 'none' }, `${at}+=0.2`)
        .to(texts[i], { opacity: 1, duration: 0.4, stagger: 0.06 }, `${at}+=0.3`);
    });
    tl.to(parts(basic, '.tier-dot, .tier-disc'), { scale: 1, duration: 0.5, ease: 'back.out(1.6)', stagger: 0.1 }, 'tiers+=0.4')
      .to(parts(basic, '.tier-ring'), { scale: 1, opacity: 1, duration: 0.7, stagger: 0.15 }, 'tiers+=0.6')
      .to(parts(capacity, '.tier-left, .tier-right'), { x: 0, duration: 0.7, ease: MOTION.easeInOut }, 'tiers+=1.2')
      .to(parts(capacity, '.tier-overlap'), { opacity: 1, duration: 0.4 }, 'tiers+=1.7')
      .to(parts(business, '.tier-orbit, .tier-ring'), { opacity: 1, duration: 0.4, stagger: 0.1 }, 'tiers+=2.0')
      .to(parts(business, '.tier-disc'), { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.4)' }, 'tiers+=2.1')
      .to(parts(business, '.tier-dot'), { rotation: 0, duration: 0.9, ease: MOTION.easeInOut }, 'tiers+=2.1')
      .to(parts(enterprise, '.tier-ring'), { opacity: 1, duration: 0.4, stagger: 0.1 }, 'tiers+=2.8')
      .to(parts(enterprise, '.tier-dot, .tier-disc'), { scale: 1, duration: 0.4, ease: 'back.out(1.6)', stagger: 0.08 }, 'tiers+=2.8')
      .to(spokes, { strokeDashoffset: 0, duration: 0.45, ease: 'power1.inOut', stagger: 0.07 }, 'tiers+=3.0')
      .to(parts(enterprise, '.tier-nodes circle'), { scale: 1, duration: 0.3, ease: 'back.out(2)', stagger: 0.07 }, 'tiers+=3.3')

      .addLabel('help', 'tiers+=4.0') // after the last graphic has finished (a step never ends mid-pop)

      // Step 6 (2:11–2:13), only on a further scroll down: the view moves down to the tiers and
      // the visitor's follow-up pops in like a message
      .to(content, { y: showInStage(section, content, cards[0], help), duration: MOTION.slow, ease: MOTION.easeInOut }, 'help')
      .to(help, { autoAlpha: 1, scale: 1, duration: MOTION.pop, ease: 'back.out(1.8)' }, 'help+=0.45')
      .addLabel('built', 'help+=0.9');

    // Leaving, as the FAQ section slides up over it: the content fades out
    const exit = gsap.timeline({ paused: true })
      .to(content, { y: '-=40', duration: 1, ease: 'none' }, 0) // stays shown; only drifts as it is covered
      .set({}, {}, 1);

    scrollScene({ trigger: section, tl, exit, tail: () => section.offsetHeight, onRefresh: applyStart });

    return () => {
      next.classList.remove('slides-over');
      section.classList.remove('is-staged');
      gsap.set(cards, { clearProps: 'filter' });
    };
  });

  /* 15. I still have a few questions. (Figma recording 2:16–2:45). Desktop: a scroll scene that
     slides up over the pricing. The visitor asks and the concierge answers; the topics and the chat
     rise in with the suggested questions; then, as a demo, "What is Concierge81?" is asked: its
     suggestion leaves the list, the question pops in, the concierge types (•••) and the answer pops
     in, then "Anything else I can help you with?". From there the visitor asks by tapping the
     suggestions (main.js). On a further scroll "Can't find your answer?" arrives. */
  const faq = {
    section: $('#faq'),
    content: $('#faq > .container'),
    header: $('#faq .chat-section-header'),
    filters: $('#faqFilters'),
    box: $('#faq .faq-chat-box'),
    help: $('#faq .cta-pill')
  };

  scenes.push(({ isDesktop }) => {
    if (!isDesktop) return;
    const { section, content, header, filters, box, help } = faq;
    const user = $('.chat-header-row.right', header);
    const pill = $('.header-pill--user', user);
    const reply = $('.header-pill--ai', header);
    const sub = $('.sub-pill-text', header);
    const pillColor = getComputedStyle(pill).backgroundColor;
    const chip = $('.faq-ask', box);
    const demo = $(`.faq-pair[data-q="${chip.dataset.q}"]`, box);
    const thread = {
      question: $('.faq-q', demo), typing: $('.faq-typing', demo), answer: $('.faq-a:not(.faq-typing)', demo),
      anything: $('.faq-anything', box)
    };
    const origin = el => (el === thread.question ? 'right bottom' : 'left bottom');
    const gap = () => parseFloat(getComputedStyle(demo).rowGap) || 0;
    // A message pops into the thread: it makes its room, then springs up from its tail corner
    const closed = el => ({ height: 0, marginTop: -gap(), autoAlpha: 0, scale: 0.6, transformOrigin: origin(el), overflow: 'hidden' });
    const popIn = (el, at) => tl
      .to(el, { height: 'auto', marginTop: 0, duration: 0.3, ease: MOTION.easeInOut }, at)
      .to(el, { autoAlpha: 1, scale: 1, duration: MOTION.pop + 0.08, ease: 'back.out(1.8)' }, `${at}+=0.05`)
      .set(el, { overflow: 'visible' }, `${at}+=0.3`);
    // The view follows the chat: the topics stay at the top while everything fits, and scroll off
    // when the chat (or `el`) would fall below the screen
    const follow = (el = box) => () => {
      const top = content.getBoundingClientRect().top;
      const from = filters.getBoundingClientRect().top - top - 16;
      const to = el.getBoundingClientRect().bottom - top + 24 - innerHeight;
      return -Math.max(0, from, to);
    };
    // Already chatting this session: the demo is shown as asked (it never replays above it)
    const chatting = () => !!$('.faq-pair.is-asked', box) || (() => { try { return JSON.parse(session.get('faq')).length > 0; } catch (e) { return false; } })();
    const next = $('#cta');
    section.classList.add('is-staged');
    next.classList.add('slides-over');

    const applyStart = () => {
      gsap.set(content, { y: 0, autoAlpha: 1 });
      gsap.set(user, { autoAlpha: 0, y: 12 });
      gsap.set(pill, { backgroundColor: '#A8A49A' });
      gsap.set(reply, { autoAlpha: 0, scale: 0.9, transformOrigin: 'left bottom', color: 'rgba(255, 255, 255, 0)' });
      gsap.set(sub, { autoAlpha: 0, y: 16 });
      gsap.set([filters, box], { autoAlpha: 0, y: 24 });
      gsap.set(help, { autoAlpha: 0, scale: 0.85, transformOrigin: 'center bottom' });
      if (chatting()) {
        gsap.set(Object.values(thread), { clearProps: 'height,marginTop,opacity,visibility,transform,overflow' });
        gsap.set(thread.typing, closed(thread.typing));
        gsap.set(chip, { display: 'none' });
        return;
      }
      Object.values(thread).forEach(el => gsap.set(el, closed(el)));
      gsap.set(chip, { display: 'inline-flex', autoAlpha: 1 });
    };
    applyStart();
    box.classList.toggle('is-waiting', !chatting());

    const tl = gsap.timeline({ paused: true, defaults: { ease: MOTION.ease } });
    tl.addLabel('enter', 0)

      // Step 1 (2:16–2:18): the visitor asks (grey → black), the concierge bubble grows, then the sub-bubble
      .to(user, { autoAlpha: 1, y: 0, duration: MOTION.base }, 0.01)
      .to(pill, { backgroundColor: pillColor, duration: 0.4, ease: 'none' }, 0.3);
    bubbleIn(tl, reply, 0.6)
      .to(sub, { autoAlpha: 1, y: 0, duration: MOTION.base }, '-=0.1')
      .addLabel('ask')

      // Step 2 (2:18–2:24): the view moves to the topics; they and the chat with its suggestions rise in
      .to(content, { y: follow(), duration: MOTION.slow, ease: MOTION.easeInOut }, 'ask')
      .to([filters, box], { autoAlpha: 1, y: 0, duration: MOTION.base, stagger: 0.15 }, 'ask+=0.3')
      .addLabel('thread', 'ask+=1.0')

      // Step 3 (2:24–2:27): the demo. "What is Concierge81?" is tapped: it leaves the suggestions
      // and pops into the chat, the concierge types, then the answer and "Anything else?" pop in
      .to(chip, { autoAlpha: 0, scale: 0.9, duration: 0.25 }, 'thread')
      .set(chip, { display: 'none' }, 'thread+=0.25');
    popIn(thread.question, 'thread+=0.2');
    popIn(thread.typing, 'thread+=0.75');
    tl.to(thread.typing, { autoAlpha: 0, duration: 0.15 }, 'thread+=1.85')
      .to(thread.typing, { height: 0, marginTop: () => -gap(), duration: 0.2, ease: MOTION.easeInOut }, 'thread+=1.9');
    popIn(thread.answer, 'thread+=1.9');
    popIn(thread.anything, 'thread+=2.6');
    tl.addLabel('demo', 'thread+=3.1')

      // Step 4, on a further scroll: the view moves on and "Can't find your answer?" pops in
      .to(content, { y: follow(help), duration: 0.6, ease: MOTION.easeInOut }, 'demo')
      .to(help, { autoAlpha: 1, scale: 1, duration: MOTION.pop, ease: 'back.out(1.8)' }, 'demo+=0.4')
      .addLabel('built', 'demo+=0.9');

    // Leaving, as the final call to action slides up over it: the content fades out
    const exit = gsap.timeline({ paused: true })
      .to(content, { y: '-=40', duration: 1, ease: 'none' }, 0) // stays shown; only drifts as it is covered
      .set({}, {}, 1);

    scrollScene({
      trigger: section, tl, exit, tail: () => section.offsetHeight, onRefresh: applyStart,
      // the suggestions can be tapped once the demo has been asked
      onUpdate: t => box.classList.toggle('is-waiting', t < tl.labels.demo - 0.001 && !chatting())
    });

    return () => {
      next.classList.remove('slides-over');
      section.classList.remove('is-staged');
      box.classList.remove('is-waiting');
      gsap.set([...Object.values(thread), chip], { clearProps: 'all' });
    };
  });

  /* 16. Your AI assistant. Now on every screen. (Figma recording 2:45–2:48). Desktop: a scroll
     scene that slides up over the FAQ. The status, the title line by line, the sub-line and the
     buttons arrive, the kiosk rises in below them, then the view moves down onto the kiosk while
     the contact section slides up over it. All with the scroll.
     17. How do I get started? (2:48–). On every screen size the chat plays and the steps and the
     form come in as the contact section scrolls into view (it is not pinned: the footer follows). */
  const cta = {
    section: $('#cta'),
    content: $('#cta > .container'),
    parts: $$('#cta .status-line, #cta .cta-title, #cta .cta-sub, #cta .cta-actions'),
    kiosk: $('#cta .kiosk-device')
  };
  const contact = {
    header: $('#contact .chat-section-header'),
    steps: $('#contact .next-steps'),
    form: $('#contact .footer-form-card')
  };

  scenes.push(({ isDesktop }) => {
    if (!isDesktop) return;
    const { section, content, parts, kiosk } = cta;
    const screen = $('.kiosk-screen', kiosk);
    const next = $('#contact');
    section.classList.add('is-staged');
    next.classList.add('slides-over');

    const applyStart = () => {
      gsap.set(content, { y: 0 });
      gsap.set(parts, { autoAlpha: 0, y: 24 });
      gsap.set(kiosk, { autoAlpha: 0, y: 120 });
    };
    applyStart();

    const tl = gsap.timeline({ paused: true, defaults: { ease: MOTION.ease } })
      .addLabel('enter', 0)
      // Step 1: the status, the title, the sub-line and the buttons, one after another
      .to(parts, { autoAlpha: 1, y: 0, duration: MOTION.base, stagger: 0.3 }, 0.01)
      // Step 2: the kiosk rises in below them, then the view moves down until its whole screen
      // (down to her hands and the top of the base) is in view, as in the Figma
      .to(kiosk, { autoAlpha: 1, y: 0, duration: 0.8 }, 'enter+=1.0')
      .to(content, { y: showInStage(section, content, screen), duration: MOTION.slow, ease: MOTION.easeInOut }, 'enter+=1.6')
      .addLabel('built', 'enter+=2.4');

    scrollScene({ trigger: section, tl, tail: () => section.offsetHeight, onRefresh: applyStart });

    return () => {
      next.classList.remove('slides-over');
      section.classList.remove('is-staged');
    };
  });

  // The contact section (every screen size): the chat, then the steps and the form
  scenes.push(() => {
    chatThread(contact.header);
    scrollReveal(contact.steps, contact.steps, { autoAlpha: 0, y: 30 });
    scrollReveal(contact.form, contact.form, { autoAlpha: 0, y: 40 });
  });

  // Phones: the chats, then the step, mode and industry cards come in with the scroll
  scenes.push(({ isMobile }) => {
    if (!isMobile) return;
    [how.header, modes.header, industries.header, values.header, deployment.header].forEach(header => chatThread(header));
    scrollReveal(deployment.stage, deployment.stage, { autoAlpha: 0, y: 30 });
    deployment.cards.forEach(card => scrollReveal(card, card, { autoAlpha: 0, y: 30 }));
    chatThread(pricing.header);
    [...pricing.cards, pricing.help].forEach(el => scrollReveal(el, el, { autoAlpha: 0, y: 30 }));
    chatThread(faq.header);
    [faq.filters, faq.box, faq.help].forEach(el => scrollReveal(el, el, { autoAlpha: 0, y: 30 }));
    [...cta.parts, cta.kiosk].forEach(el => scrollReveal(el, el, { autoAlpha: 0, y: 30 }));
    values.cards.forEach(card => scrollReveal(card, card, { autoAlpha: 0, y: 30 }));
    scrollReveal([...industries.cards, industries.controls], industries.gallery, { autoAlpha: 0, x: 40 }, { stagger: 0.1 });
    $$('#how .process-card, #interaction .mode-card').forEach(card => scrollReveal(card, card, { autoAlpha: 0, y: 30 }));
  });

  /* Hover loops (desktop, with a mouse): once a part has been shown (its scene resting on a
     finished step, not mid-step), hovering it plays a short round of that part's animation, again and again while the pointer stays.
     Moving away lets the round finish quickly; every round ends on the finished frame, so the page
     is always left as the scene built it. `round()` builds one round (a fresh timeline each time). */
  const shownWhole = el => +getComputedStyle(el).opacity > 0.99 && getComputedStyle(el).visibility !== 'hidden';
  const hoverLoop = (el, round, { section = el.closest('section'), stopOn = [], ready = () => !section.classList.contains('is-playing') && shownWhole(el) } = {}) => {
    let current = null;
    let over = false;
    const next = () => {
      current = round();
      current.eventCallback('onComplete', () => {
        if (over && ready()) next();
        else current = null;
      });
    };
    const enter = () => {
      over = true;
      if (current) current.timeScale(1);
      else if (ready()) next();
    };
    const leave = () => {
      over = false;
      current?.timeScale(2.5); // finishes its round quickly
    };
    const stop = () => { // straight to the finished frame (a drag starts, the page re-measures)
      over = false;
      if (!current) return;
      const finishing = current;
      current = null;
      finishing.progress(1).kill();
    };
    el.addEventListener('mouseenter', enter);
    el.addEventListener('mouseleave', leave);
    stopOn.forEach(type => el.addEventListener(type, stop));
    const off = () => {
      stop();
      el.removeEventListener('mouseenter', enter);
      el.removeEventListener('mouseleave', leave);
      stopOn.forEach(type => el.removeEventListener(type, stop));
    };
    off.stop = stop;
    return off;
  };

  scenes.push(({ isDesktop }) => {
    if (!isDesktop || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const offs = [];
    const loop = (el, round, options) => el && offs.push(hoverLoop(el, round, options));
    const pause = s => ({ duration: s }); // a still moment at the end of a round

    // Inbox: a question wobbles on its tilt (a drag stops it at once)
    inbox.tags.forEach(tag => loop(tag, () => {
      const r = gsap.getProperty(tag, 'rotation');
      return gsap.timeline()
        .to(tag, { rotation: r + 4, duration: 0.12, ease: 'sine.out' })
        .to(tag, { rotation: r - 4, duration: 0.24, ease: 'sine.inOut' })
        .to(tag, { rotation: r + 2, duration: 0.18, ease: 'sine.inOut' })
        .to(tag, { rotation: r, duration: 0.14, ease: 'sine.in' })
        .to({}, pause(0.5));
    }, { stopOn: ['pointerdown'], ready: () => !inbox.pile.classList.contains('is-busy') })); // once the questions have landed

    // How: the dial turns a full circle; the reply goes back to "typing" and to the check
    const dial = $('.process-glyph--round', how.cards[1]);
    loop(how.cards[1], () => {
      const from = parseFloat(gsap.getProperty(dial, '--dial')) || 0;
      return gsap.timeline()
        .fromTo(dial, { '--dial': `${from}deg` }, { '--dial': `${from + 360}deg`, duration: 2.4, ease: 'power1.inOut' })
        .set(dial, { '--dial': `${from}deg` });
    });
    loop(how.cards[2], () => gsap.timeline()
      .to(how.answer, { morphSVG: how.bubble, duration: 0.45, ease: MOTION.easeInOut })
      .to({}, pause(0.6))
      .to(how.answer, { morphSVG: how.check, duration: 0.45, ease: MOTION.easeInOut })
      .to({}, pause(0.9)));
    const askIcon = $('.how-art', how.cards[0]);
    loop(how.cards[0], () => gsap.timeline()
      .to(askIcon, { y: -6, duration: 0.35, ease: 'sine.out' })
      .to(askIcon, { y: 0, duration: 0.45, ease: 'bounce.out' })
      .to({}, pause(0.7)));

    // Type or talk: the mini chat plays again, message by message; the voice orb glows
    const mini = $('.mini-chat', modes.chat);
    const messages = $$('.msg-row, .chip', mini);
    loop(modes.chat, () => gsap.timeline()
      .to(messages, { autoAlpha: 0, duration: 0.2 })
      .fromTo(messages, { autoAlpha: 0, y: 10, scale: 0.92, transformOrigin: i => (messages[i].matches('.msg-row--user') ? 'right bottom' : 'left bottom') },
        { autoAlpha: 1, y: 0, scale: 1, duration: MOTION.pop, ease: 'back.out(1.8)', stagger: 0.35 }, '+=0.2')
      .to({}, pause(1.4)));
    // The voice card answers: the mic swells, sound waves ripple out across the card, the glow
    // brightens and "Listening…" turns to "Answering…" for a moment
    const orb = $('.voice-orb', modes.voice);
    const voiceStage = $('.voice-stage', modes.voice);
    const listening = $('.listening', modes.voice);
    const listeningText = listening.textContent;
    const waves = [0, 1, 2].map(() => voiceStage.appendChild(Object.assign(document.createElement('span'), { className: 'voice-wave' })));
    offs.push(() => waves.forEach(wave => wave.remove()));
    loop(modes.voice, () => gsap.timeline()
      .to(orb, { scale: 1.18, duration: 0.35, ease: 'sine.out' }, 0)
      .to(voiceStage, { filter: 'brightness(1.4)', duration: 0.4, ease: 'sine.out' }, 0)
      .fromTo(waves, { scale: 1, opacity: 0.75 }, { scale: 3.4, opacity: 0, duration: 1.5, ease: 'power2.out', stagger: 0.3 }, 0.1)
      .call(() => { listening.textContent = 'Answering…'; }, null, 0.2)
      .to(orb, { scale: 0.96, duration: 0.25, ease: 'sine.inOut' }, 0.55)
      .to(orb, { scale: 1.12, duration: 0.25, ease: 'sine.inOut' }, 0.8)
      .to(orb, { scale: 1, duration: 0.5, ease: 'sine.inOut' }, 1.05)
      .to(voiceStage, { filter: 'brightness(1)', duration: 0.7, ease: 'sine.inOut' }, 1.1)
      .call(() => { listening.textContent = listeningText; }, null, 1.9)
      .set(voiceStage, { clearProps: 'filter' }, 2.1)
      .to({}, pause(0.3)));

    // Why concierge81?
    const [availability, handoff, accuracy, languages, scale, insights] = values.cards;
    const timeline = $('.timeline', availability);
    const fill = $('.timeline-fill', availability);
    loop(availability, () => gsap.timeline() // the dot runs the day again
      .fromTo(timeline, { '--at': '0%' }, { '--at': '100%', duration: 2, ease: 'power1.inOut' })
      .fromTo(fill, { scaleX: 0 }, { scaleX: 1, duration: 2, ease: 'power1.inOut' }, '<')
      .to({}, pause(0.6)));
    const lines = $$('.handoff-line', handoff);
    const handoffPill = $('.handoff-pill', handoff);
    loop(handoff, () => gsap.timeline() // the hand-off draws again
      .to([...lines, handoffPill], { autoAlpha: 0, duration: 0.2 })
      .set(lines, { scaleX: 0, autoAlpha: 1 })
      .to(lines[0], { scaleX: 1, duration: 0.45, ease: 'power1.inOut' })
      .fromTo(handoffPill, { autoAlpha: 0, scale: 0.8 }, { autoAlpha: 1, scale: 1, duration: 0.35, ease: 'back.out(1.7)' }, '-=0.1')
      .to(lines[1], { scaleX: 1, duration: 0.45, ease: 'power1.inOut' }, '-=0.15')
      .to({}, pause(1)));
    const branches = $$('.info-branches path', accuracy);
    const nodes = $$('.info-nodes > div', accuracy);
    loop(accuracy, () => gsap.timeline() // the info branches out again
      .to(nodes, { autoAlpha: 0, scale: 0.7, duration: 0.2 })
      .set(branches, { strokeDashoffset: 1 })
      .to(branches, { strokeDashoffset: 0, duration: 0.6, ease: 'power1.inOut', stagger: 0.1 })
      .to(nodes, { autoAlpha: 1, scale: 1, duration: 0.35, ease: 'back.out(1.7)', stagger: 0.15 }, '-=0.3')
      .to({}, pause(1)));
    const langPill = $('.lang-pill', languages);
    const tabs = $$('.lang-tabs span', languages);
    const hello = $('.hello-en', languages);
    const konnichiwa = $('.hello-jp', languages);
    loop(languages, () => gsap.timeline() // Hello. ↔ こんにちは。
      .to(langPill, { x: () => tabs[1].offsetLeft - tabs[0].offsetLeft, duration: 0.45, ease: MOTION.easeInOut })
      .to(tabs[0], { color: '#A8A49A', duration: 0.3 }, '<0.05')
      .to(tabs[1], { color: '#FFFFFF', duration: 0.3 }, '<0.1')
      .to(hello, { autoAlpha: 0, y: -12, duration: 0.3, ease: 'power2.in' }, '<')
      .to(konnichiwa, { autoAlpha: 1, y: 0, duration: 0.4 }, '>-0.05')
      .to({}, pause(0.9))
      .to(langPill, { x: 0, duration: 0.45, ease: MOTION.easeInOut })
      .to(tabs[1], { color: '#A8A49A', duration: 0.3 }, '<0.05')
      .to(tabs[0], { color: '#FFFFFF', duration: 0.3 }, '<0.1')
      .to(konnichiwa, { autoAlpha: 0, y: 12, duration: 0.3, ease: 'power2.in' }, '<')
      .to(hello, { autoAlpha: 1, y: 0, duration: 0.4 }, '>-0.05')
      .to({}, pause(0.9)));
    const glow = $('.network-glow', scale);
    const placesOut = $$('.network-node', scale);
    loop(scale, () => gsap.timeline() // the network pulses out from the hub
      .to(glow, { scale: 1.5, opacity: 0.35, transformOrigin: '50% 50%', duration: 0.5, ease: 'sine.out' })
      .to(placesOut, { scale: 1.35, transformOrigin: '50% 50%', duration: 0.25, ease: 'sine.out', stagger: 0.08 }, '-=0.2')
      .to(placesOut, { scale: 1, duration: 0.35, ease: 'sine.inOut', stagger: 0.08 }, '-=0.15')
      .to(glow, { scale: 1, opacity: 1, duration: 0.6, ease: 'sine.inOut' }, '<')
      .to({}, pause(0.5)));
    const bars = $$('.bar', insights);
    loop(insights, () => gsap.timeline() // the week's bars grow again
      .to(bars, { '--grow': 0, duration: 0.25, ease: 'power2.in' })
      .to(bars, { '--grow': 1, duration: 0.5, ease: 'power2.out', stagger: 0.1 })
      .to({}, pause(1)));

    // Industries: the chat on a card pops in again (its photo zooms, in the CSS)
    industries.cards.forEach((card) => {
      const bubbles = $$('.industry-chat .bubble', card);
      if (!bubbles.length) return;
      loop(card, () => gsap.timeline()
        .to(bubbles, { autoAlpha: 0, duration: 0.2 })
        .fromTo(bubbles, { autoAlpha: 0, scale: 0.9, transformOrigin: i => (i ? 'left bottom' : 'right bottom') },
          { autoAlpha: 1, scale: 1, duration: MOTION.pop, ease: 'back.out(1.8)', stagger: 0.5 }, '+=0.1')
        .to({}, pause(1.6)));
    });

    // Pricing: each tier's graphic builds again
    const [basic, capacity, business, enterprise] = pricing.cards;
    const art = (card, selector) => $$(selector, card);
    loop(basic, () => gsap.timeline()
      .to(art(basic, '.tier-ring'), { scale: 0.5, opacity: 0, svgOrigin: '245 114', duration: 0.25 })
      .to(art(basic, '.tier-ring'), { scale: 1, opacity: 1, duration: 0.7, stagger: 0.15 })
      .to({}, pause(0.6)));
    loop(capacity, () => gsap.timeline()
      .to(art(capacity, '.tier-overlap'), { opacity: 0, duration: 0.2 })
      .to(art(capacity, '.tier-left'), { x: -40, duration: 0.45, ease: MOTION.easeInOut }, '<')
      .to(art(capacity, '.tier-right'), { x: 40, duration: 0.45, ease: MOTION.easeInOut }, '<')
      .to(art(capacity, '.tier-left, .tier-right'), { x: 0, duration: 0.7, ease: MOTION.easeInOut })
      .to(art(capacity, '.tier-overlap'), { opacity: 1, duration: 0.4 }, '-=0.2')
      .to({}, pause(0.6)));
    loop(business, () => gsap.timeline()
      .fromTo(art(business, '.tier-dot'), { rotation: 0 }, { rotation: 360, svgOrigin: '275.36 59', duration: 1.6, ease: MOTION.easeInOut })
      .set(art(business, '.tier-dot'), { rotation: 0 })
      .to({}, pause(0.5)));
    const spokes = art(enterprise, '.tier-spokes path');
    const entNodes = art(enterprise, '.tier-nodes circle');
    loop(enterprise, () => gsap.timeline()
      .to(entNodes, { scale: 0, duration: 0.2 })
      .set(spokes, { strokeDashoffset: 1 })
      .to(spokes, { strokeDashoffset: 0, duration: 0.45, ease: 'power1.inOut', stagger: 0.07 })
      .to(entNodes, { scale: 1, duration: 0.3, ease: 'back.out(2)', stagger: 0.07 }, '-=0.3')
      .to({}, pause(0.8)));

    // The page re-measures (a refresh resets the scenes): every loop stops on its finished frame
    const stopAll = () => offs.forEach(off => off.stop?.());
    ScrollTrigger.addEventListener('refreshInit', stopAll);
    return () => {
      ScrollTrigger.removeEventListener('refreshInit', stopAll);
      offs.forEach(off => off());
    };
  });

  setupPile();

  runOpening();

  // Where the visitor is, as a section and a distance into it (positions shift when scenes are
  // shown as plain sections instead of pinned), saved as they scroll
  const topOf = (target) => {
    const el = typeof target === 'string' ? $(target) : target;
    const box = el.parentElement.classList.contains('pin-spacer') ? el.parentElement : el;
    // (with smooth scrolling the content trails the scrollbar, so ask the smoother)
    return smoother ? smoother.offset(box, 'top top') : box.getBoundingClientRect().top + scrollY;
  };
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
      // Desktop: the page glides with a little momentum, so a quick flick or a slow wheel never
      // feels rough (phones keep their native touch scrolling)
      if (context.conditions.isDesktop && window.ScrollSmoother) {
        setHeaderHeight();
        root.classList.add('is-smooth');
        smoother = ScrollSmoother.create({ wrapper: '#smooth-wrapper', content: '#smooth-content', smooth: 0.6, smoothTouch: false });
      }
      measuring = true; // setting up: shown finished where seen, nothing plays
      const unlimit = context.conditions.isDesktop ? limitScroll() : null; // the scroll follows the animation
      const cleanups = scenes.map(scene => scene(context.conditions)).filter(Boolean);
      plainOnStart.splice(0).forEach(plain => plain());
      requestAnimationFrame(() => { measuring = false; });
      return () => {
        unlimit?.();
        cleanups.forEach(cleanup => cleanup());
        smoother?.kill();
        smoother = null;
        root.classList.remove('is-smooth');
      };
    }
  );

  // In-page links glide there with the smooth scrolling (the story's step links are handled first)
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    const href = link?.getAttribute('href');
    const target = href && href.length > 1 && document.querySelector(href);
    if (!smoother || !target || e.defaultPrevented) return;
    e.preventDefault();
    e.stopPropagation(); // main.js would scroll natively instead
    glide();
    smoother.scrollTo(target, true, 'top top');
    history.replaceState(null, '', href);
  }, true);

  const savePlace = () => {
    if (root.classList.contains('is-opening')) return;
    const y = scrollY;
    const id = [...places].reverse().find(sel => topOf(sel) <= y + 1) || places[0];
    session.set('place', JSON.stringify({ id, offset: y - topOf(id) }));
    if (y >= topOf('#problem') - 1) session.set('introDone', '1');
  };
  ScrollTrigger.addEventListener('scrollEnd', savePlace);
  addEventListener('pagehide', savePlace);

  /* Back to where the visitor was (a refresh, or a return to the page this session): the page is
     placed there before it is shown (index.html hides it with .is-restoring until then), the scene
     there on its finished step and everything above it shown finished. It is shown once images
     and fonts have their real size and it has been measured again there (or after 2.5s at most,
     by index.html; then it is put back unless the visitor has moved meanwhile). */
  const restore = () => {
    if (!savedPlace || !$(savedPlace.id)) return;
    ScrollTrigger.refresh();
    scrollToY(topOf(savedPlace.id) + savedPlace.offset, false);
    ScrollTrigger.refresh(); // the scenes jump to their finished step there, instead of playing up to it
  };
  restore();
  let moved = false;
  ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(type => addEventListener(type, () => { moved = true; }, { once: true, passive: true }));
  const loaded = new Promise(resolve => (document.readyState === 'complete' ? resolve() : addEventListener('load', resolve, { once: true })));
  Promise.all([loaded, document.fonts?.ready]).then(() => {
    if (moved) ScrollTrigger.refresh();
    else restore();
    requestAnimationFrame(() => root.classList.remove('is-restoring')); // shown there, at last
  });
})();
