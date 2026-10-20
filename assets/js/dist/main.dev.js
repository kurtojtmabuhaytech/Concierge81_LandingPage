"use strict";

document.addEventListener('DOMContentLoaded', function () {
  // Simple form submission handler
  var leadForm = document.getElementById('leadForm');

  if (leadForm) {
    leadForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = leadForm.querySelector('input[type="email"]');

      if (input && input.value) {
        alert("Thank you! We received: ".concat(input.value, ". We will be in touch shortly."));
        leadForm.reset();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    // Mobile Menu Toggle
    var mobileToggle = document.getElementById('mobileToggle');
    var navMenu = document.getElementById('navMenu');

    if (mobileToggle && navMenu) {
      mobileToggle.addEventListener('click', function () {
        mobileToggle.classList.toggle('active');
        navMenu.classList.toggle('active');
      }); // Close menu when a navigation link is clicked

      var navLinks = navMenu.querySelectorAll('a');
      navLinks.forEach(function (link) {
        link.addEventListener('click', function () {
          mobileToggle.classList.remove('active');
          navMenu.classList.remove('active');
        });
      });
    } // --- Keep your existing form submission and smooth scroll JS below this line ---
    // Simple form submission handler


    var leadForm = document.getElementById('leadForm'); // ... rest of your JS
  }); // Smooth scroll behavior for internal anchor links

  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      var target = document.querySelector(this.getAttribute('href'));

      if (target) {
        e.preventDefault();
        target.scrollIntoView({
          behavior: 'smooth'
        });
      }
    });
  });
});
//# sourceMappingURL=main.dev.js.map
