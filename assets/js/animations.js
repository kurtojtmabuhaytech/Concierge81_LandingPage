// Landing page motion (GSAP + ScrollTrigger, Flip, MorphSVG). Loaded on index.html only.
// Sections that GSAP animates carry data-motion; main.js leaves those out of its simple scroll reveal.
// Elements marked data-anim start hidden (see _animations.scss) until a scene reveals them with autoAlpha.
(() => {
  const root = document.documentElement;

  // GSAP failed to load: show everything and let the page work without motion
  if (!window.gsap || !window.ScrollTrigger) {
    root.classList.remove('js-motion');
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
    stagger: 0.25,       // features, list items
    typing: 1.2,         // "concierge is typing…" before a reply
    bubbleText: 0.4      // text fading in after a bubble shape has grown
  };

  // Each scene is a function (ctx) => void, added per section in the batches that follow.
  // ctx.isDesktop / ctx.isMobile tell a scene which layout it is building for.
  const scenes = [];

  const mm = gsap.matchMedia();
  mm.add(
    {
      isDesktop: '(min-width: 901px) and (prefers-reduced-motion: no-preference)',
      isMobile: '(max-width: 900px) and (prefers-reduced-motion: no-preference)',
      reduceMotion: '(prefers-reduced-motion: reduce)'
    },
    (context) => {
      const { reduceMotion } = context.conditions;
      if (reduceMotion) {
        // No movement: everything visible in its final state
        gsap.set('[data-anim]', { autoAlpha: 1, clearProps: 'transform' });
        return;
      }
      scenes.forEach(scene => scene({ ...context.conditions, MOTION }));
    }
  );

  // Recalculate trigger positions once images (avatar, photos) have their real size
  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
