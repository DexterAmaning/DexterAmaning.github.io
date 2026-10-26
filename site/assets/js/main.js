// Progressive enhancement only: every page works without this file.
(function () {
  "use strict";

  document.documentElement.classList.add("js");

  // Mobile navigation toggle.
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("site-nav");
  if (toggle && nav) {
    var close = function () {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
    };
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("is-open")) {
        close();
        toggle.focus();
      }
    });
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) close();
    });
  }

  // Highlight the table-of-contents entry for the section in view.
  var tocLinks = document.querySelectorAll(".toc a[href^='#']");
  if (tocLinks.length && "IntersectionObserver" in window) {
    var byId = {};
    tocLinks.forEach(function (a) {
      byId[a.getAttribute("href").slice(1)] = a;
    });
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          tocLinks.forEach(function (a) {
            a.removeAttribute("aria-current");
          });
          var link = byId[entry.target.id];
          if (link) link.setAttribute("aria-current", "true");
        });
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );
    Object.keys(byId).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) observer.observe(el);
    });
  }

  // Pointer tooltips for chart marks. Keyboard and screen-reader users get
  // the same values from each chart's data table.
  var marks = document.querySelectorAll(".chart [data-tip]");
  if (marks.length) {
    var tip = document.createElement("div");
    tip.className = "chart-tooltip";
    tip.setAttribute("aria-hidden", "true");
    tip.hidden = true;
    document.body.appendChild(tip);
    var place = function (e) {
      var x = e.clientX + 14;
      var y = e.clientY + 14;
      var r = tip.getBoundingClientRect();
      if (x + r.width > window.innerWidth - 8) x = e.clientX - r.width - 14;
      if (y + r.height > window.innerHeight - 8) y = e.clientY - r.height - 14;
      tip.style.left = x + "px";
      tip.style.top = y + "px";
    };
    marks.forEach(function (m) {
      m.addEventListener("pointerenter", function (e) {
        tip.textContent = m.getAttribute("data-tip");
        tip.hidden = false;
        place(e);
      });
      m.addEventListener("pointermove", place);
      m.addEventListener("pointerleave", function () {
        tip.hidden = true;
      });
    });
  }
})();
