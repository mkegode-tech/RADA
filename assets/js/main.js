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

  // Diagnostic form — POSTs to the Google Apps Script web app named in the form's action
  // attribute (google-apps-script/diagnostic-form.gs), which logs to a Google Sheet and sends
  // the team notification + enquirer confirmation emails. Host-independent: works on any
  // static host.
  //
  // Apps Script runs doPost() and then answers with a redirect to a second Google address
  // that serves the script's reply. That second hop intermittently returns a Google 404
  // even though the submission was already saved and emailed, so we don't follow it:
  // redirect: "manual" resolves as soon as the redirect arrives (an "opaqueredirect"
  // response), which only happens once doPost() has finished. A script crash returns an
  // error page with no redirect, so it still reaches the error branch below. Browser-side
  // validation covers the script's own required-field checks for real visitors.
  var form = document.querySelector("[data-diagnostic-form]");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      var status = form.querySelector(".form-status");
      var submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Sending..."; }
      function showStatus(text, kind) {
        if (!status) return;
        status.textContent = text;
        status.classList.remove("ok", "error");
        status.classList.add("show");
        if (kind) status.classList.add(kind);
      }
      if (status) status.classList.remove("show", "ok", "error");

      // Google occasionally takes 20-30 seconds to respond; reassure rather than let
      // visitors assume it's broken and leave or resubmit.
      var slowTimer = setTimeout(function () {
        showStatus("Still sending — this can take up to half a minute. Please keep this page open.");
      }, 8000);
      var controller = "AbortController" in window ? new AbortController() : null;
      var abortTimer = controller ? setTimeout(function () { controller.abort(); }, 60000) : null;

      var data = new URLSearchParams(new FormData(form));
      data.append("page", window.location.pathname);
      fetch(form.action, {
        method: "POST",
        redirect: "manual",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: data.toString(),
        signal: controller ? controller.signal : undefined,
      })
        .then(function (response) {
          if (response.type !== "opaqueredirect") {
            throw new Error("Form submission failed: " + response.status);
          }
          showStatus("Thank you — your request has been received. A member of the RADA AI team will be in touch within one business day.", "ok");
          form.reset();
        })
        .catch(function () {
          showStatus("Something went wrong sending this — please email us directly at contact@radaai.ai instead.", "error");
        })
        .finally(function () {
          clearTimeout(slowTimer);
          if (abortTimer) clearTimeout(abortTimer);
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Book my diagnostic"; }
        });
    });
  }
})();
