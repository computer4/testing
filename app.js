// khyal — site logic: menu panel, scroll spy, reveals, lights, tilt, counters, equalizer
(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // Render pricing from pricing.js
  var pricingBox = $("#pricing-grid");
  if (pricingBox && window.renderPricing) window.renderPricing(pricingBox);

  // ---- Menu panel ----
  var burger = $("#burger"), menu = $("#menu"), links = $$("#menu a");
  function setMenu(open) {
    menu.classList.toggle("open", open);
    burger.classList.toggle("open", open);
    burger.setAttribute("aria-expanded", open);
    document.body.classList.toggle("noscroll", open);
  }
  burger.addEventListener("click", function () { setMenu(!menu.classList.contains("open")); });
  links.forEach(function (a) { a.addEventListener("click", function () { setMenu(false); }); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") setMenu(false); });
  window.addEventListener("resize", function () { if (innerWidth > 720) setMenu(false); });

  // ---- Scroll: nav style, progress bar, scroll spy ----
  var nav = $("nav"), bar = $("#progress");
  var sections = $$("main section, header.hero").filter(function (s) { return s.id; });
  function onScroll() {
    var h = document.documentElement;
    nav.classList.toggle("scrolled", scrollY > 30);
    bar.style.width = (scrollY / (h.scrollHeight - innerHeight) * 100) + "%";
    var cur = "top";
    // use viewport-based position (offsetTop is relative to <main>, not the page, for sections)
    sections.forEach(function (s) { if (s.getBoundingClientRect().top <= 140) cur = s.id; });
    links.forEach(function (a) { a.classList.toggle("active", a.getAttribute("href") === "#" + cur); });
  }
  addEventListener("scroll", onScroll, { passive: true }); onScroll();

  // ---- Reveal on scroll ----
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add("in");
      $$(".count[data-to]", e.target).forEach(countUp);
      io.unobserve(e.target);
    });
  }, { threshold: .15 });
  $$(".reveal").forEach(function (el, i) { el.style.transitionDelay = (i % 3) * 90 + "ms"; io.observe(el); });

  function countUp(el) {
    var to = +el.dataset.to, t0 = performance.now();
    (function step(t) {
      var p = Math.min((t - t0) / 900, 1), v = Math.round(to * (1 - Math.pow(1 - p, 3)));
      el.textContent = "₹" + v.toLocaleString("en-IN");
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }
  $$(".stat b[data-to]").forEach(function (b) {
    new IntersectionObserver(function (es, o) {
      if (es[0].isIntersecting) {
        var to = +b.dataset.to, t0 = performance.now();
        (function step(t) {
          var p = Math.min((t - t0) / 1000, 1);
          b.textContent = Math.round(to * p) + (b.dataset.suffix || "");
          if (p < 1) requestAnimationFrame(step);
        })(t0);
        o.disconnect();
      }
    }).observe(b);
  });

  // ---- Cursor light ----
  var glow = $("#cursor-glow");
  addEventListener("pointermove", function (e) {
    glow.style.transform = "translate(" + (e.clientX - 200) + "px," + (e.clientY - 200) + "px)";
    glow.style.opacity = 1;
    // card spotlight
    $$(".card,.track,.stat").forEach(function (c) {
      var r = c.getBoundingClientRect();
      c.style.setProperty("--mx", (e.clientX - r.left) + "px");
      c.style.setProperty("--my", (e.clientY - r.top) + "px");
    });
  });

  // ---- 3D tilt on pricing cards ----
  document.addEventListener("pointermove", function (e) {
    $$("[data-tilt]").forEach(function (c) {
      var r = c.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) { c.style.transform = ""; return; }
      var x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      c.style.transform = "perspective(800px) rotateY(" + x * 8 + "deg) rotateX(" + -y * 8 + "deg) translateY(-4px)";
    });
  });

  // ---- Equalizer bars ----
  var eq = $(".eq");
  for (var i = 0; i < 32; i++) {
    var b = document.createElement("i");
    b.style.animationDelay = (i * .07) + "s";
    b.style.animationDuration = (.7 + Math.random() * .9) + "s";
    eq.appendChild(b);
  }

  // ---- Floating particles (canvas) ----
  var cv = $("#particles"), cx = cv.getContext("2d"), pts = [];
  function size() { cv.width = innerWidth; cv.height = innerHeight; }
  size(); addEventListener("resize", size);
  for (var k = 0; k < 55; k++) pts.push({ x: Math.random() * innerWidth, y: Math.random() * innerHeight, r: Math.random() * 2 + .5, v: Math.random() * .4 + .1, h: Math.random() < .5 ? 265 : 330 });
  (function draw() {
    cx.clearRect(0, 0, cv.width, cv.height);
    pts.forEach(function (p) {
      p.y -= p.v; if (p.y < -5) { p.y = cv.height + 5; p.x = Math.random() * cv.width; }
      cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 6.283);
      cx.fillStyle = "hsla(" + p.h + ",90%,70%,.6)"; cx.shadowBlur = 12; cx.shadowColor = "hsl(" + p.h + ",90%,65%)";
      cx.fill();
    });
    requestAnimationFrame(draw);
  })();

  $("#y").textContent = new Date().getFullYear();
})();
