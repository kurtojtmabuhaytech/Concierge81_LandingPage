document.addEventListener('DOMContentLoaded', () => {

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
    window.matchMedia('(min-width: 901px)').addEventListener('change', (e) => {
      if (e.matches) setMenu(false);
    });
  }

  // Simple form submission handler
  const leadForm = document.getElementById('leadForm');
  if (leadForm) {
    leadForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = leadForm.querySelector('input[type="email"]');
      if (input && input.value) {
        alert(`Thank you! We received: ${input.value}. We will be in touch shortly.`);
        leadForm.reset();
      }
    });
  }

  // Smooth scroll behavior for internal anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href === '#') return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // Single-select pill groups (hero mode toggle, interest pills)
  const singleSelect = (group, activeClass = 'is-active') => {
    if (!group) return;
    group.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn || !group.contains(btn)) return;
      group.querySelectorAll('button').forEach(b => b.classList.remove(activeClass));
      btn.classList.add(activeClass);
    });
  };
  singleSelect(document.querySelector('.mode-toggle'));
  singleSelect(document.getElementById('interestPills'));

  // FAQ category filters
  const faqFilters = document.getElementById('faqFilters');
  if (faqFilters) {
    singleSelect(faqFilters);
    faqFilters.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-filter]');
      if (!btn) return;
      const filter = btn.dataset.filter;
      document.querySelectorAll('.faq-pair').forEach(pair => {
        const cats = pair.dataset.cat.split(' ');
        pair.hidden = filter !== 'all' && !cats.includes(filter);
      });
    });
  }

  // Industry gallery arrows + dots
  const gallery = document.getElementById('industryGallery');
  if (gallery) {
    const dots = document.querySelectorAll('.gallery-dots span');
    const step = () => (gallery.querySelector('.industry-card')?.offsetWidth || 260) + 12;

    document.querySelectorAll('[data-gallery]').forEach(btn => {
      btn.addEventListener('click', () => {
        const dir = btn.dataset.gallery === 'next' ? 1 : -1;
        gallery.scrollBy({ left: dir * step(), behavior: 'smooth' });
      });
    });

    gallery.addEventListener('scroll', () => {
      const index = Math.round(gallery.scrollLeft / step());
      dots.forEach((dot, i) => dot.classList.toggle('is-active', i === Math.min(index, dots.length - 1)));
    }, { passive: true });
  }

  // Copy email to clipboard
  document.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!navigator.clipboard) return;
      navigator.clipboard.writeText(btn.dataset.copy).then(() => {
        btn.setAttribute('aria-label', 'Copied!');
      });
    });
  });

  // Draggable inbox questions
  const pile = document.getElementById('qPile');
  if (pile) {
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
});
