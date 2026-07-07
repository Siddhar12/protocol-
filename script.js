/* =========================================================
   Protocol · interactions + 3D figure
   ========================================================= */
(function () {
  "use strict";

  var body = document.body;
  var overlay = document.getElementById("overlay");
  var formPane = document.getElementById("formPane");
  var donePane = document.getElementById("donePane");
  var lastFocus = null;

  /* Footer year */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Scroll reveal (blur-in) ---------- */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); } });
    }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
    reveals.forEach(function (el, i) { el.style.transitionDelay = (i % 3) * 70 + "ms"; io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-in"); });
  }

  /* ---------- Member-file panel activation ---------- */
  var panels = document.querySelectorAll("[data-panel]");
  if ("IntersectionObserver" in window && panels.length) {
    var pio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { en.target.classList.toggle("on", en.isIntersecting); });
    }, { threshold: 0.45 });
    panels.forEach(function (p) { pio.observe(p); });
  } else {
    panels.forEach(function (p) { p.classList.add("on"); });
  }

  /* ---------- Seamless full-width ticker ---------- */
  var tickerBase = null;
  function setupTicker() {
    var view = document.querySelector(".ticker__view");
    var track = document.querySelector(".ticker__track");
    if (!view || !track) return;
    if (tickerBase === null) tickerBase = track.innerHTML;
    var half = tickerBase;
    track.innerHTML = half;
    var guard = 0;
    while (track.scrollWidth < view.offsetWidth * 1.25 && guard < 60) {
      half += tickerBase;
      track.innerHTML = half;
      guard++;
    }
    var halfWidth = track.scrollWidth;
    track.innerHTML = half + half;
    track.style.animationDuration = Math.max(16, Math.round(halfWidth / 55)) + "s";
  }
  setupTicker();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(setupTicker);
  window.addEventListener("load", setupTicker);
  var tkTimer;
  window.addEventListener("resize", function () { clearTimeout(tkTimer); tkTimer = setTimeout(setupTicker, 200); });

  /* ---------- Button hover shifts the page background ---------- */
  document.querySelectorAll("[data-bg]").forEach(function (el) {
    el.addEventListener("mouseenter", function () { body.classList.add("bg-shift"); });
    el.addEventListener("mouseleave", function () { body.classList.remove("bg-shift"); });
    el.addEventListener("focus", function () { body.classList.add("bg-shift"); });
    el.addEventListener("blur", function () { body.classList.remove("bg-shift"); });
  });

  /* ---------- Popup ---------- */
  function openPopup() {
    lastFocus = document.activeElement;
    formPane.removeAttribute("hidden");
    donePane.setAttribute("hidden", "");
    overlay.removeAttribute("hidden");
    body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeydown);
    window.setTimeout(function () {
      var input = document.getElementById("email");
      if (input) input.focus({ preventScroll: true });
    }, 60);
  }
  function closePopup() {
    overlay.setAttribute("hidden", "");
    body.style.overflow = "";
    body.classList.remove("bg-shift");
    document.removeEventListener("keydown", onKeydown);
    if (lastFocus) lastFocus.focus();
  }
  function onKeydown(e) { if (e.key === "Escape") closePopup(); }

  document.querySelectorAll("[data-open]").forEach(function (b) { b.addEventListener("click", openPopup); });
  overlay.addEventListener("click", function (e) { if (e.target.closest("[data-close]")) closePopup(); });

  /* ---------- Waitlist capture ---------- */
  var STORE_KEY = "ad1line_waitlist";
  /* Paste your capture endpoint to receive real leads (Formspree /
     Google Apps Script / your own API). Empty = local-only demo mode. */
  var WAITLIST_ENDPOINT = "";

  function isEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
  function save(entry) {
    try {
      var list = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
      list.push(entry);
      localStorage.setItem(STORE_KEY, JSON.stringify(list));
    } catch (e) { /* private mode — ignore */ }
    if (WAITLIST_ENDPOINT) {
      fetch(WAITLIST_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(entry)
      }).catch(function () {});
    }
  }

  var form = document.getElementById("wlForm");
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var input = document.getElementById("email");
    if (!isEmail(input.value.trim())) {
      input.classList.add("error");
      input.focus();
      return;
    }
    input.classList.remove("error");
    save({ email: input.value.trim(), ts: new Date().toISOString() });
    formPane.setAttribute("hidden", "");
    donePane.removeAttribute("hidden");
  });
  form.addEventListener("input", function () {
    document.getElementById("email").classList.remove("error");
  });

  /* =========================================================
     3D figure — the real Male.OBJ surface, decimated to a smooth
     shaded mesh and rendered with a tiny custom WebGL engine
     (no libraries). Sculptural clay, rotates with scroll, breathes,
     and is swept by a scan band. See figure-data.js.
     ========================================================= */
  var canvas = document.getElementById("figure");
  var mfile = document.querySelector(".mfile");
  var grid = document.querySelector(".mfile__grid");
  var MESH = window.FIGURE_MESH;
  var gl = null;
  try {
    if (canvas) gl = canvas.getContext("webgl", { antialias: true, alpha: true, premultipliedAlpha: false, depth: true })
      || canvas.getContext("experimental-webgl", { antialias: true, alpha: true });
  } catch (e) {}

  if (canvas && mfile && grid && MESH && gl) {
    /* ---- decode baked mesh ---- */
    function b64buf(s) { var bin = atob(s), n = bin.length, u = new Uint8Array(n); for (var i = 0; i < n; i++) u[i] = bin.charCodeAt(i); return u.buffer; }
    var posI = new Int16Array(b64buf(MESH.pos));
    var nrmI = new Int8Array(b64buf(MESH.nrm));
    var u32 = MESH.bits === 32 && !!gl.getExtension("OES_element_index_uint");
    var idx = MESH.bits === 32 ? new Uint32Array(b64buf(MESH.idx)) : new Uint16Array(b64buf(MESH.idx));
    var nIdx = idx.length;
    var pos = new Float32Array(posI.length);
    for (var pi = 0; pi < pos.length; pi++) pos[pi] = posI[pi] / 1000;
    var nrm = new Float32Array(nrmI.length);
    for (var ni = 0; ni < nrm.length; ni++) nrm[ni] = nrmI[ni] / 127;

    /* ---- shaders ---- */
    var VS =
      "attribute vec3 aPos; attribute vec3 aNrm;" +
      "uniform mat4 uMVP; uniform mat4 uModel;" +
      "varying vec3 vN; varying float vY;" +
      "void main(){ vN = mat3(uModel) * aNrm; vY = aPos.y; gl_Position = uMVP * vec4(aPos,1.0); }";
    var FS =
      "precision mediump float;" +
      "varying vec3 vN; varying float vY; uniform float uScan;" +
      "void main(){" +
      "  vec3 N = normalize(vN); if (N.z < 0.0) N = -N;" +          /* face the camera (robust to winding) */
      "  vec3 L1 = normalize(vec3(0.32,0.62,0.72));" +
      "  vec3 L2 = normalize(vec3(-0.6,-0.1,0.35));" +
      "  float d1 = max(dot(N,L1),0.0);" +
      "  float d2 = max(dot(N,L2),0.0) * 0.30;" +
      "  float rim = pow(1.0 - max(N.z,0.0), 2.6);" +
      "  vec3 base = vec3(0.80,0.83,0.90);" +
      "  vec3 col = base * (0.30 + d1*0.9 + d2);" +
      "  col += vec3(0.42,0.56,0.82) * rim * 0.75;" +               /* cool steel edge glow */
      "  float scan = smoothstep(0.055,0.0,abs(vY - uScan));" +
      "  col += vec3(0.95,0.78,0.42) * scan * 0.55;" +             /* warm gold scan band */
      "  gl_FragColor = vec4(col, 1.0);" +
      "}";
    function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
    var prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.bindAttribLocation(prog, 0, "aPos");
    gl.bindAttribLocation(prog, 1, "aNrm");
    gl.linkProgram(prog);
    gl.useProgram(prog);

    var bPos = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bPos); gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    var bNrm = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bNrm); gl.bufferData(gl.ARRAY_BUFFER, nrm, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    var bIdx = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bIdx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    var idxType = u32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;

    var uMVP = gl.getUniformLocation(prog, "uMVP");
    var uModel = gl.getUniformLocation(prog, "uModel");
    var uScan = gl.getUniformLocation(prog, "uScan");
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 0);

    /* ---- mat4 (column-major) ---- */
    function mMul(a, b) {
      var o = new Array(16);
      for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++)
        o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
      return o;
    }
    function mPersp(fy, asp, n, f) { var t = 1 / Math.tan(fy / 2); return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, (2 * f * n) / (n - f), 0]; }
    function mTrans(x, y, z) { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]; }
    function mRotY(a) { var c = Math.cos(a), s = Math.sin(a); return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]; }
    function mRotX(a) { var c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]; }

    var W = 0, H = 0, DPR = 1;
    function resize() {
      var rect = canvas.parentElement.getBoundingClientRect();
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(1, Math.round(rect.width * DPR));
      H = Math.max(1, Math.round(rect.height * DPR));
      canvas.width = W; canvas.height = H;
      gl.viewport(0, 0, W, H);
    }
    resize();
    window.addEventListener("resize", resize);

    var tiltTarget = 0, tilt = 0, running = false, t0 = performance.now();
    window.addEventListener("mousemove", function (e) { tiltTarget = (e.clientX / window.innerWidth - 0.5) * 0.5; }, { passive: true });

    function frame(now) {
      if (!running) return;
      var t = (now - t0) / 1000;
      var r = grid.getBoundingClientRect();
      var total = r.height - window.innerHeight;
      var p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
      var rot = -0.5 + p * Math.PI * 2.2 + t * 0.035;
      tilt += (tiltTarget - tilt) * 0.05;
      var breathe = 1 + Math.sin(t * 1.05) * 0.006;

      /* responsive framing: full figure on desktop, chest-up bust on phones */
      var mob = window.innerWidth <= 900;
      var proj = mPersp(mob ? 0.64 : 0.6, W / H, 0.1, 20);
      var view = mTrans(0, mob ? -0.5 : 0.0, mob ? -2.05 : -3.0);
      var sc = [breathe, 0, 0, 0, 0, 1, 0, 0, 0, 0, breathe, 0, 0, 0, 0, 1];
      var model = mMul(mMul(mRotY(rot), mRotX(tilt * 0.32)), sc);
      var mvp = mMul(proj, mMul(view, model));

      gl.uniformMatrix4fv(uMVP, false, new Float32Array(mvp));
      gl.uniformMatrix4fv(uModel, false, new Float32Array(model));
      gl.uniform1f(uScan, 0.95 - ((t * 0.3) % 2.5));

      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.drawElements(gl.TRIANGLES, nIdx, idxType, 0);
      requestAnimationFrame(frame);
    }

    if ("IntersectionObserver" in window) {
      var fio = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting && !running) { running = true; resize(); requestAnimationFrame(frame); }
          else if (!en.isIntersecting) { running = false; }
        });
      }, { rootMargin: "25% 0px 25% 0px" });
      fio.observe(mfile);
    } else {
      running = true;
      requestAnimationFrame(frame);
    }
  }
})();
