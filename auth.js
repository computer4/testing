// khyal — account store (demo backend).
// Data is saved in this browser's localStorage, so there is no real server yet.
// To go live across devices, replace the functions below with calls to a real backend (Firebase/Supabase/etc).
(function () {
  var K = { users: "khyal_users", sess: "khyal_session", admin: "khyal_admin_session" };

  // CHANGE THESE before publishing. Anyone can read them in this file — see README note.
  var ADMIN = { email: "khyal.music.work@gmail.com", password: "ADMIN" };

  function token() {
    var a = new Uint8Array(16);
    (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach(function (_, i) { a[i] = Math.random() * 256; });
    return Array.from(a).map(function (x) { return x.toString(16).padStart(2, "0"); }).join("");
  }

  // order status shown to the client; admin moves it forward. Work can only start after admin confirms payment.
  var STATUSES = ["under review", "work started", "completed", "cancelled"];
  var LEGACY = { pending: "under review", active: "work started" };

  function load() {
    var users; try { users = JSON.parse(localStorage.getItem(K.users)) || []; } catch (e) { return []; }
    users.forEach(function (u) { // migrate older saved data
      if (u.plan) { if (LEGACY[u.plan.status]) u.plan.status = LEGACY[u.plan.status]; if (u.plan.paid === undefined) u.plan.paid = false; }
    });
    return users;
  }
  function save(u) { localStorage.setItem(K.users, JSON.stringify(u)); }
  function norm(e) { return String(e || "").trim().toLowerCase(); }
  function uid() { return "u" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function hash(s) {
    if (window.crypto && crypto.subtle) {
      return crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)).then(function (b) {
        return Array.from(new Uint8Array(b)).map(function (x) { return x.toString(16).padStart(2, "0"); }).join("");
      });
    }
    return Promise.resolve("p:" + btoa(unescape(encodeURIComponent(s))));
  }

  function planFor(name) {
    var p = (window.PLANS || []).filter(function (x) { return x.name === name; })[0];
    if (!p) return null;
    return { name: p.name, price: p.price, status: "under review", paid: false, paidAt: null, payment: null, started: new Date().toISOString() };
  }

  window.Auth = {
    STATUSES: STATUSES,
    cls: function (s) { return String(s).replace(/\s+/g, "-"); },
    all: load,
    get: function (id) { return load().filter(function (u) { return u.id === id; })[0] || null; },
    current: function () { var id = localStorage.getItem(K.sess); return id ? this.get(id) : null; },
    logout: function () { localStorage.removeItem(K.sess); },

    signup: function (d) {
      var email = norm(d.email);
      if (!d.name || !d.name.trim()) return Promise.reject(new Error("Please enter your name."));
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return Promise.reject(new Error("Enter a valid email."));
      if (!d.password || d.password.length < 6) return Promise.reject(new Error("Password must be at least 6 characters."));
      if (!d.terms) return Promise.reject(new Error("You must accept the terms & conditions."));
      if (email === norm(ADMIN.email)) return Promise.reject(new Error("This email is reserved."));
      var users = load();
      if (users.some(function (u) { return u.email === email; })) return Promise.reject(new Error("An account with this email already exists."));
      return hash(email + ":" + d.password).then(function (h) {
        var u = {
          id: uid(), name: d.name.trim(), email: email, phone: (d.phone || "").trim(),
          pass: h, joined: new Date().toISOString(), plan: planFor(d.plan), projects: [],
          termsAccepted: new Date().toISOString(), termsVersion: window.TERMS_VERSION || "",
          verified: false, verifyToken: token()
        };
        users.push(u); save(users);
        // no session yet: the client must confirm their email before they can log in
        return u;
      });
    },

    // marks the account owning this token as verified; returns the user or null
    verify: function (t) {
      if (!t) return null;
      var users = load(), u = users.filter(function (x) { return x.verifyToken === t; })[0];
      if (!u) return null;
      u.verified = true; u.verifyToken = null; save(users);
      return u;
    },
    // new token for resending the verification mail
    renewToken: function (id) { return this.update(id, function (u) { u.verifyToken = token(); }); },
    // for "resend verification": fresh token for an unverified account, or null
    resendFor: function (email) {
      var u = load().filter(function (x) { return x.email === norm(email) && !x.verified; })[0];
      return u ? this.renewToken(u.id) : null;
    },

    // ---- payments (UPI): client submits the transaction id, admin confirms it ----
    utrUsed: function (utr, exceptId) {
      return load().some(function (u) { return u.id !== exceptId && u.plan && u.plan.payment && u.plan.payment.utr.toLowerCase() === utr.toLowerCase(); });
    },
    submitPayment: function (id, method, ref) {
      ref = String(ref || "").trim();
      if (!/^[A-Za-z0-9]{8,22}$/.test(ref)) return "Enter the transaction / UTR id from your payment app (8–22 letters or numbers).";
      if (this.utrUsed(ref, id)) return "This transaction id was already submitted.";
      var u = this.update(id, function (x) { if (x.plan && !x.plan.paid) x.plan.payment = { method: method, utr: ref, submittedAt: new Date().toISOString() }; });
      return u && u.plan && u.plan.payment ? "" : "Could not save payment.";
    },

    // returns the user, or { admin: true } when the admin credentials were used
    login: function (email, password) {
      email = norm(email);
      if (email === norm(ADMIN.email)) {
        if (password !== ADMIN.password) return Promise.reject(new Error("Wrong email or password."));
        sessionStorage.setItem(K.admin, "1");
        return Promise.resolve({ admin: true });
      }
      return hash(email + ":" + password).then(function (h) {
        var u = load().filter(function (x) { return x.email === email && x.pass === h; })[0];
        if (!u) throw new Error("Wrong email or password.");
        if (!u.verified) { var er = new Error("Please verify your email first — check your inbox for the link."); er.code = "unverified"; throw er; }
        localStorage.setItem(K.sess, u.id);
        return u;
      });
    },

    // mutate a user: fn(user) edits it in place
    update: function (id, fn) {
      var users = load(), u = users.filter(function (x) { return x.id === id; })[0];
      if (!u) return null;
      fn(u); save(users); return u;
    },
    remove: function (id) { save(load().filter(function (u) { return u.id !== id; })); },
    setPlan: function (id, name) { return this.update(id, function (u) { u.plan = planFor(name); }); },

    adminOk: function () { return sessionStorage.getItem(K.admin) === "1"; },
    adminLogout: function () { sessionStorage.removeItem(K.admin); },

    esc: function (s) {
      return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    },
    fmtDate: function (iso) { return iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"; },
    money: function (n) { return "₹" + Number(n || 0).toLocaleString("en-IN"); }
  };
})();
