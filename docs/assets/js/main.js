(function () {
  "use strict";

  // Mobile nav drawer
  var toggle = document.querySelector(".nav-toggle");
  var drawer = document.querySelector(".mobile-drawer");
  var closeBtn = document.querySelector(".mobile-close");
  function openDrawer() { if (drawer) { drawer.classList.add("open"); document.body.style.overflow = "hidden"; } }
  function closeDrawer() { if (drawer) { drawer.classList.remove("open"); document.body.style.overflow = ""; } }
  if (toggle) toggle.addEventListener("click", openDrawer);
  if (closeBtn) closeBtn.addEventListener("click", closeDrawer);
  if (drawer) {
    drawer.querySelectorAll("a").forEach(function (a) { a.addEventListener("click", closeDrawer); });
  }

  // Scroll reveal
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && revealEls.length) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("in"); });
  }

  // Footer year
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  // Active nav link
  var here = window.location.pathname.replace(/\/index\.html$/, "/");
  document.querySelectorAll(".nav-link[data-nav], .mobile-drawer nav a").forEach(function (a) {
    var href = a.getAttribute("href");
    if (href && href !== "/" && here.indexOf(href.split("#")[0]) === 0) {
      a.classList.add("active");
    } else if (href === "/" && here === "/") {
      a.classList.add("active");
    }
  });

  // Cookie consent banner
  var banner = document.querySelector("[data-cookie-banner]");
  if (banner) {
    var consent = null;
    try { consent = window.localStorage.getItem("rada-cookie-consent"); } catch (err) {}
    if (!consent) banner.hidden = false;
    var accept = banner.querySelector("[data-cookie-accept]");
    var decline = banner.querySelector("[data-cookie-decline]");
    function setConsent(value) {
      try { window.localStorage.setItem("rada-cookie-consent", value); } catch (err) {}
      banner.hidden = true;
    }
    if (accept) accept.addEventListener("click", function () { setConsent("accepted"); });
    if (decline) decline.addEventListener("click", function () { setConsent("declined"); });
  }

  // Pre-select "preferred engagement" from ?interest= query param (e.g. links from service pages)
  var engagementSelect = document.querySelector("[data-engagement-select]");
  if (engagementSelect) {
    var params = new URLSearchParams(window.location.search);
    var interest = params.get("interest");
    if (interest && engagementSelect.querySelector('option[value="' + interest + '"]')) {
      engagementSelect.value = interest;
    }
  }

  // Diagnostic / contact form — front-end only.
  // Wire this to the firm's CRM / email-automation endpoint before go-live (see README).
  var form = document.querySelector("[data-diagnostic-form]");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var status = form.querySelector(".form-status");
      var submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Sending..."; }
      window.setTimeout(function () {
        if (status) {
          status.textContent = "Thank you — your request has been received. A member of the RADA AI team will be in touch within one business day.";
          status.classList.add("show", "ok");
        }
        form.reset();
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Book my diagnostic"; }
      }, 700);
    });
  }
})();
