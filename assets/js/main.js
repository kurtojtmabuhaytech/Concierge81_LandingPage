document.addEventListener('DOMContentLoaded', () => {

  // Single-select pill groups (mode toggle, interest pills, filters, "helpful")
  const singleSelect = (group, activeClass = 'is-active') => {
    if (!group) return;
    const buttons = [...group.querySelectorAll('button')];
    buttons.forEach(b => b.setAttribute('aria-pressed', b.classList.contains(activeClass)));
    group.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn || !group.contains(btn)) return;
      buttons.forEach(b => { b.classList.toggle(activeClass, b === btn); b.setAttribute('aria-pressed', b === btn); });
    });
  };

  // Copy text, briefly confirm on the button, then restore its label
  const copyText = async (btn, text, done = 'Copied!') => {
    if (!navigator.clipboard) return;
    await navigator.clipboard.writeText(text);
    const hasText = btn.textContent.trim() !== '';
    const original = hasText ? btn.textContent : btn.getAttribute('aria-label');
    if (hasText) btn.textContent = done; else btn.setAttribute('aria-label', done);
    setTimeout(() => { if (hasText) btn.textContent = original; else btn.setAttribute('aria-label', original); }, 2000);
  };

  // Mobile Menu Toggle
  const mobileToggle = document.getElementById('mobileToggle');
  const navMenu = document.getElementById('navMenu');

  if (mobileToggle && navMenu) {
    // Lock page scroll while the menu is open
    const setMenu = (open) => {
      mobileToggle.classList.toggle('active', open);
      navMenu.classList.toggle('active', open);
      document.documentElement.classList.toggle('menu-open', open);
      mobileToggle.setAttribute('aria-expanded', open);
    };

    mobileToggle.addEventListener('click', () => {
      setMenu(!navMenu.classList.contains('active'));
    });

    // Close menu when a navigation link is clicked
    navMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => setMenu(false));
    });

    // Close menu when tapping outside it or pressing Escape
    document.addEventListener('click', (e) => {
      if (navMenu.classList.contains('active') && !navMenu.contains(e.target) && !mobileToggle.contains(e.target)) {
        setMenu(false);
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') setMenu(false);
    });

    // Unlock scroll if the window is widened past the mobile breakpoint
    // (addListener fallback: Safari < 14 has no MediaQueryList.addEventListener)
    const desktop = window.matchMedia('(min-width: 901px)');
    const onDesktop = (e) => { if (e.matches) setMenu(false); };
    if (desktop.addEventListener) desktop.addEventListener('change', onDesktop);
    else desktop.addListener(onDesktop);
  }

  // Lead form: once sent, the card shows "Request sent." with the visitor's email (Figma); "Send
  // another request" brings the empty form back. (Static site: nothing is sent anywhere yet.)
  const leadForm = document.getElementById('leadForm');
  const leadSent = document.getElementById('leadSent');
  if (leadForm && leadSent) {
    const card = leadForm.closest('.footer-form-card');
    leadForm.addEventListener('submit', (e) => {
      e.preventDefault();
      document.getElementById('leadSentEmail').textContent = leadForm.elements.email.value;
      leadForm.hidden = true;
      leadSent.hidden = false;
      card.classList.add('is-sent');
      leadSent.focus({ preventScroll: true });
    });
    document.getElementById('leadAgain').addEventListener('click', () => {
      leadForm.reset();
      leadSent.hidden = true;
      leadForm.hidden = false;
      card.classList.remove('is-sent');
      leadForm.elements.name.focus();
    });
  }

  // Smooth scroll for in-page links (sections set scroll-margin-top for the sticky header)
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href === '#') return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
        history.replaceState(null, '', href);
      }
    });
  });

  singleSelect(document.querySelector('.mode-toggle'));
  singleSelect(document.getElementById('interestPills'));
  singleSelect(document.querySelector('#helpfulRow div'));

  // Filterable lists (FAQ, blog grid, news list) with optional "Load more"
  // Items marked data-more stay hidden until "Load more" reveals the next page of them.
  // data-cat can hold several space-separated categories; data-filter-only items are left out of "All".
  // The active filter is kept in the address (?topic=…), so a shared or reloaded link opens on it.
  const setupListing = ({ list, item, filters, button, count, empty, pageSize = 6, noun = 'items' }) => {
    if (!list) return;
    const items = [...list.querySelectorAll(item)];
    let filter = 'all';
    const inFilter = (el) => filter === 'all'
      ? !el.hasAttribute('data-filter-only')
      : (el.dataset.cat || '').split(' ').includes(filter);

    const render = () => {
      const matching = items.filter(inFilter);
      const loaded = matching.filter(el => !el.hasAttribute('data-more'));
      items.forEach(el => { el.hidden = !loaded.includes(el); });
      if (count) count.textContent = `Showing ${loaded.length} of ${matching.length} ${noun}`;
      if (button) button.hidden = loaded.length >= matching.length;
      if (empty) empty.hidden = matching.length > 0;
    };

    // "Load more": the count is announced (aria-live in the HTML), focus moves to the first new item
    if (button) {
      button.addEventListener('click', () => {
        const added = items.filter(el => el.hasAttribute('data-more') && inFilter(el)).slice(0, pageSize);
        added.forEach(el => el.removeAttribute('data-more'));
        render();
        if (added[0]) {
          if (added[0].tabIndex < 0) added[0].setAttribute('tabindex', '-1');
          added[0].focus();
        }
      });
    }

    if (filters) {
      const setFilter = (value) => {
        filter = value;
        const url = new URL(location.href);
        if (value === 'all') url.searchParams.delete('topic'); else url.searchParams.set('topic', value);
        history.replaceState(history.state, '', url);
        render();
      };
      // A topic in the address picks its filter before the buttons are set up
      const fromUrl = new URLSearchParams(location.search).get('topic');
      const start = fromUrl && [...filters.querySelectorAll('[data-filter]')].find(b => b.dataset.filter === fromUrl);
      if (start) {
        filters.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('is-active', b === start));
        filter = fromUrl;
      }
      singleSelect(filters);
      filters.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-filter]');
        if (!btn) return;
        setFilter(btn.dataset.filter);
      });
    }
    render();
  };

  /* FAQ chat ("Ask me anything"): tapping a suggestion asks it. Like a messaging app, the question
     pops in, the concierge types (•••), then the answer pops in, one after another, and the
     conversation scrolls on its own inside the chat (the page keeps scrolling outside it). Asked
     questions leave the suggestions; the topics filter what is left. The conversation is kept for
     the browser session. "What is concierge81?" is asked by the scroll scene (animations.js). */
  const faqBox = document.querySelector('.faq-chat-box');
  if (faqBox) {
    const thread = faqBox.querySelector('.faq-thread');
    const anything = thread.querySelector('.faq-anything');
    const chips = [...faqBox.querySelectorAll('.faq-suggestion')];
    const done = faqBox.querySelector('.faq-suggestions-done');
    const suggested = faqBox.querySelector('.faq-suggested-label');
    const avatar = anything.querySelector('.msg-avatar');
    const SAVED = 'c81:faq';
    const saved = (() => { try { return JSON.parse(sessionStorage.getItem(SAVED)) || []; } catch (e) { return []; } })();
    const save = () => {
      const asked = [...thread.querySelectorAll('.faq-pair.is-asked')].map(pair => pair.dataset.q);
      try { sessionStorage.setItem(SAVED, JSON.stringify(asked)); } catch (e) { /* storage blocked */ }
    };
    const wait = ms => new Promise(resolve => setTimeout(resolve, motionOK ? ms : 0));
    // A message pops in (springs up from its tail corner); the chat follows the newest one
    const pop = (el) => {
      el.hidden = false;
      el.classList.remove('is-popping');
      void el.offsetWidth; // restart the animation
      el.classList.add('is-popping');
      thread.scrollTo({ top: thread.scrollHeight, behavior: motionOK ? 'smooth' : 'auto' });
    };
    const helpful = () => {
      const row = document.createElement('div');
      row.className = 'helpful';
      row.innerHTML = 'Was this helpful? <span><button type="button">Yes</button><button type="button">No</button></span>';
      singleSelect(row.querySelector('span'));
      return row;
    };

    // Topics filter the suggestions still to ask
    let topic = 'all';
    const showChips = () => {
      const left = chips.filter(chip => chip.isConnected && !chip.classList.contains('faq-ask'));
      left.forEach(chip => { chip.hidden = topic !== 'all' && !chip.dataset.cat.split(' ').includes(topic); });
      left.forEach(chip => chip.classList.toggle('is-first', chip === left.find(c => !c.hidden)));
      done.hidden = left.length > 0;
      suggested.hidden = left.length === 0;
    };
    const filters = document.getElementById('faqFilters');
    singleSelect(filters);
    filters?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-filter]');
      if (!btn) return;
      topic = btn.dataset.filter;
      showChips();
    });

    // A question already in the thread: moved to the end of the conversation, shown at once
    const place = (pair) => {
      thread.insertBefore(pair, anything);
      pair.hidden = false;
      pair.classList.add('is-asked');
      if (!pair.querySelector('.helpful')) pair.append(helpful());
      faqBox.querySelector(`.faq-suggestion[data-q="${pair.dataset.q}"]`)?.remove();
    };
    saved.forEach((q) => {
      const pair = thread.querySelector(`.faq-pair[data-q="${q}"]`);
      if (faqBox.querySelector(`.faq-ask[data-q="${q}"]`)) return; // the scroll scene asks that one
      if (pair) place(pair);
    });
    if (saved.length) thread.scrollTop = thread.scrollHeight;
    showChips();

    // Asking: one question at a time, each waits for the one before it
    let queue = Promise.resolve();
    const ask = async (chip) => {
      const pair = thread.querySelector(`.faq-pair[data-q="${chip.dataset.q}"]`);
      if (!pair) return;
      chip.remove();
      showChips();
      const [question, answer] = pair.querySelectorAll(':scope > .faq-q, :scope > .faq-a');
      anything.hidden = true;
      thread.insertBefore(pair, anything);
      [question, answer].forEach(el => { el.hidden = true; });
      pair.hidden = false;
      pair.classList.add('is-asked');
      save();
      pop(question);
      await wait(550);
      const typing = document.createElement('div');
      typing.className = 'faq-a faq-typing is-live';
      typing.setAttribute('aria-hidden', 'true');
      typing.innerHTML = `${avatar.outerHTML}<p class="bubble bubble--sand faq-dots"><i></i><i></i><i></i></p>`;
      pair.insertBefore(typing, answer);
      pop(typing);
      await wait(1100);
      typing.remove();
      pop(answer);
      await wait(450);
      const row = helpful();
      row.hidden = true;
      pair.append(row);
      pop(row);
      await wait(700);
      pop(anything);
    };
    faqBox.querySelector('.faq-suggestions').addEventListener('click', (e) => {
      const chip = e.target.closest('.faq-suggestion');
      if (!chip || chip.classList.contains('faq-ask')) return;
      chip.disabled = true;
      queue = queue.then(() => ask(chip));
    });
  }
  setupListing({
    list: document.getElementById('postGrid'), item: '.post-card',
    filters: document.getElementById('postFilters'), button: document.getElementById('loadMore'),
    count: document.getElementById('loadCount'), empty: document.getElementById('postEmpty'),
    pageSize: 6, noun: 'articles'
  });
  setupListing({
    list: document.getElementById('newsList'), item: '.news-row',
    filters: document.getElementById('newsFilters'), button: document.getElementById('newsLoadMore'),
    count: document.getElementById('newsLoadCount'), empty: document.getElementById('newsEmpty'),
    pageSize: 8, noun: 'stories'
  });

  // Industry gallery arrows + dots
  const gallery = document.getElementById('industryGallery');
  if (gallery) {
    const dots = [...document.querySelectorAll('.gallery-dots span')];
    const step = () => {
      const card = gallery.querySelector('.industry-card');
      const gap = parseFloat(getComputedStyle(gallery).columnGap) || 0;
      return (card ? card.offsetWidth : 260) + gap;
    };

    document.querySelectorAll('[data-gallery]').forEach(btn => {
      btn.addEventListener('click', () => {
        const dir = btn.dataset.gallery === 'next' ? 1 : -1;
        gallery.scrollBy({ left: dir * step(), behavior: 'smooth' });
      });
    });

    gallery.addEventListener('scroll', () => {
      const atEnd = gallery.scrollLeft >= gallery.scrollWidth - gallery.clientWidth - 1;
      const index = atEnd ? dots.length - 1 : Math.min(Math.round(gallery.scrollLeft / step()), dots.length - 1);
      dots.forEach((dot, i) => dot.classList.toggle('is-active', i === index));
    }, { passive: true });
  }

  // Industry cards: the ＋ opens the "More info" panel (and turns into ×)
  document.querySelectorAll('.industry-plus[aria-controls]').forEach(btn => {
    const name = btn.getAttribute('aria-label');
    btn.addEventListener('click', () => {
      const open = btn.closest('.industry-card').classList.toggle('is-open');
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? name.replace('More about', 'Close details for') : name);
    });
  });

  // Draggable inbox questions. With GSAP, animations.js runs the pile instead (drag and throw).
  const pile = document.getElementById('qPile');
  if (pile && !window.gsap) {
    let topZ = 10;
    pile.querySelectorAll('.q-tag').forEach(tag => {
      let startX = 0, startY = 0, baseX = 0, baseY = 0;

      tag.addEventListener('pointerdown', (e) => {
        tag.setPointerCapture(e.pointerId);
        startX = e.clientX;
        startY = e.clientY;
        baseX = parseFloat(tag.style.getPropertyValue('--dx')) || 0;
        baseY = parseFloat(tag.style.getPropertyValue('--dy')) || 0;
        tag.style.zIndex = ++topZ;
        tag.classList.add('is-dragging');
      });

      tag.addEventListener('pointermove', (e) => {
        if (!tag.hasPointerCapture(e.pointerId)) return;
        tag.style.setProperty('--dx', `${baseX + e.clientX - startX}px`);
        tag.style.setProperty('--dy', `${baseY + e.clientY - startY}px`);
      });

      const stop = (e) => {
        if (tag.hasPointerCapture(e.pointerId)) tag.releasePointerCapture(e.pointerId);
        tag.classList.remove('is-dragging');
      };
      tag.addEventListener('pointerup', stop);
      tag.addEventListener('pointercancel', stop);
    });
  }

  // Clipboard: footer email, article "Copy link"
  document.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', () => copyText(btn, btn.dataset.copy));
  });
  document.querySelectorAll('[data-copy-url]').forEach(btn => {
    btn.addEventListener('click', () => copyText(btn, location.href, 'Link copied'));
  });

  // Article pages: share (native share sheet, falls back to copying the link)
  const shareBtn = document.getElementById('shareBtn');
  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      try {
        if (navigator.share) await navigator.share({ title: document.title, url: location.href });
        else await copyText(shareBtn, location.href, 'Link copied');
      } catch (err) { /* share sheet dismissed */ }
    });
  }

  // Scroll reveal (pages with <body class="reveal-page">): text fades in as it enters the
  // viewport and out as it leaves (blog and news: in once, then it stays). Chat headers / highlighted text get the stronger "emphasis" variant.
  // Sections marked data-motion are animated by animations.js (GSAP) instead.
  const revealGroups = [
    {
      variant: 'reveal--emphasis',
      selector: [
        '.chat-section-header > *',        // "You" question, concierge bubble, sub-bubble
        '.hero-chat-interface .msg-row',   // hero chat messages
        '.intro-thread > *',               // "I'm concierge81..." headline thread
        '.status-line', '.cta-title'       // final CTA headline
      ].join(', '),
      stagger: 0.15
    },
    {
      variant: 'reveal--soft',
      selector: [
        '.hero-avatar', '.chat-composer', '.kiosk-device',
        '.feature-item', '.inbox-card', '.stepper', '.process-card',
        '.mode-card', '.gallery-controls', '.bento-card', '.deploy-stage', '.platform-card',
        '.tier-card', '.cta-row', '.faq-filters', '.faq-chat-box',
        '.cta-sub', '.cta-actions', '.next-steps', '.footer-form-card',
        // blog pages
        '.blog-section-title', '.featured-card', '.post-filters', '.post-card', '.load-more',
        '.post-header > *', '.post-hero', '.post-toc', '.post-body > *', '.keep-reading-head',
        // news pages
        '.news-featured', '.news-list-wrap', '.news-hero', '.news-body > *'
      ].join(', '),
      stagger: 0.08
    }
  ];
  const motionOK = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (document.body.classList.contains('reveal-page') && motionOK && 'IntersectionObserver' in window) {
    // Blog and news (<body class="reveal-once">): shown once, stays shown, so focus never lands on hidden content
    const once = document.body.classList.contains('reveal-once');
    // Once in, the reveal classes come off so the element's own hover/focus lift works again
    const settle = (el, instant) => {
      observer.unobserve(el);
      let timer;
      const done = () => {
        clearTimeout(timer);
        el.removeEventListener('transitionend', onEnd);
        el.classList.remove('reveal', 'reveal--soft', 'reveal--emphasis', 'is-visible');
        el.style.removeProperty('--reveal-delay');
      };
      const onEnd = (e) => { if (e.target === el && e.propertyName === 'opacity') done(); };
      if (instant) {
        done();
        el.getAnimations?.().forEach(a => { if (a.transitionProperty) a.cancel(); }); // stop a fade already under way
        return;
      }
      el.classList.add('is-visible');
      el.addEventListener('transitionend', onEnd);
      timer = setTimeout(done, 2000); // in case it never transitions (e.g. filtered out mid-fade)
    };
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!once) entry.target.classList.toggle('is-visible', entry.isIntersecting);
        else if (entry.isIntersecting) settle(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    // Keyboard focus inside something not yet revealed, or still fading in (e.g. tabbing ahead of
    // the scroll): show it at once
    if (once) document.addEventListener('focusin', (e) => {
      document.querySelectorAll('.reveal').forEach(el => { if (el.contains(e.target)) settle(el, true); });
    });

    revealGroups.forEach(({ variant, selector, stagger }) => {
      document.querySelectorAll(selector).forEach(el => {
        if (el.classList.contains('reveal') || el.closest('[data-motion]')) return;
        // Stagger siblings that share this group (e.g. bubbles in one header, cards in one row)
        const siblings = [...el.parentElement.children].filter(child => child.matches(selector));
        el.style.setProperty('--reveal-delay', `${(siblings.indexOf(el) % 5) * stagger}s`);
        el.classList.add('reveal', variant);
        observer.observe(el);
      });
    });
  }

  // Blog post: highlight the "On this page" link for the section in view
  const toc = document.getElementById('postToc');
  if (toc && 'IntersectionObserver' in window) {
    const links = [...toc.querySelectorAll('a[href^="#"]')];
    const sections = links.map(link => document.querySelector(link.getAttribute('href'))).filter(Boolean);
    const setActive = (id) => links.forEach(link => link.classList.toggle('is-active', link.getAttribute('href') === `#${id}`));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => { if (entry.isIntersecting) setActive(entry.target.id); });
    }, { rootMargin: '-20% 0px -70% 0px' });
    sections.forEach(section => observer.observe(section));
  }

  // Blog post: reading progress bar (through the article) and "Back to top" after about one screen
  const progress = document.getElementById('readProgress');
  const toTop = document.getElementById('toTop');
  if (progress || toTop) {
    const article = document.querySelector('main article');
    let ticking = false;
    const update = () => {
      ticking = false;
      if (progress && article) {
        const rect = article.getBoundingClientRect();
        const total = rect.height - window.innerHeight;
        const done = total > 0 ? Math.min(Math.max(-rect.top / total, 0), 1) : 1;
        progress.style.transform = `scaleX(${done})`;
      }
      if (toTop) toTop.classList.toggle('is-shown', window.scrollY > window.innerHeight);
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();

    // Back at the top, focus goes to the title so keyboard users continue from there
    toTop?.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: motionOK ? 'smooth' : 'auto' });
      document.querySelector('.post-title')?.focus({ preventScroll: true });
    });
  }
});
