/* ============================================================
   navbar.js — Gestion du menu burger (responsive mobile)
   ============================================================ */

(function () {
  "use strict";

  function initNavbar() {
    var burger   = document.getElementById("burger");
    var navLinks = document.getElementById("navLinks");

    if (!burger || !navLinks) return;

    burger.addEventListener("click", function () {
      var isOpen = navLinks.classList.toggle("open");
      burger.classList.toggle("open", isOpen);
      burger.setAttribute("aria-expanded", isOpen);
    });

    /* Fermer le menu au clic sur un lien */
    navLinks.querySelectorAll(".nav-link").forEach(function (link) {
      link.addEventListener("click", function () {
        navLinks.classList.remove("open");
        burger.classList.remove("open");
        burger.setAttribute("aria-expanded", "false");
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initNavbar);
  } else {
    initNavbar();
  }
})();
