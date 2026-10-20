document.addEventListener('DOMContentLoaded', () => {
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
document.addEventListener('DOMContentLoaded', () => {
  
  // Mobile Menu Toggle
  const mobileToggle = document.getElementById('mobileToggle');
  const navMenu = document.getElementById('navMenu');

  if (mobileToggle && navMenu) {
    mobileToggle.addEventListener('click', () => {
      mobileToggle.classList.toggle('active');
      navMenu.classList.toggle('active');
    });

    // Close menu when a navigation link is clicked
    const navLinks = navMenu.querySelectorAll('a');
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        mobileToggle.classList.remove('active');
        navMenu.classList.remove('active');
      });
    });
  }

  // --- Keep your existing form submission and smooth scroll JS below this line ---
  
  // Simple form submission handler
  const leadForm = document.getElementById('leadForm');
  // ... rest of your JS
});
  // Smooth scroll behavior for internal anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({
          behavior: 'smooth'
        });
      }
    });
  });
});