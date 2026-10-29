(function () {
  var $ = function (id) { return document.getElementById(id); };
  var esc = Auth.esc, money = Auth.money;
  var STATUSES = Auth.STATUSES;
  var PSTAT = ["received", "in progress", "delivered"];

  // admins sign in on login.html; anyone else is sent there
  if (!Auth.adminOk()) { location.replace("login.html"); return; }
  function show() { $("panel").classList.remove("hide"); render(); }
  $("aOut").onclick = function () { Auth.adminLogout(); location.href = "login.html"; };

  PLANS.forEach(function (p) { var o = document.createElement("option"); o.textContent = p.name; $("fplan").appendChild(o); });
  var none = document.createElement("option"); none.value = "__none"; none.textContent = "no plan"; $("fplan").appendChild(none);
  ["q", "fplan", "fstat"].forEach(function (id) { $(id).oninput = renderTable; });

  function revenueOf(u) { return u.plan && u.plan.paid && u.plan.status !== "cancelled" ? u.plan.price : 0; }

  function render() { renderStats(); renderTable(); }

  function renderStats() {
    var us = Auth.all(), week = Date.now() - 7 * 864e5;
    var active = us.filter(function (u) { return u.plan && u.plan.status === "work started"; }).length;
    var pending = us.filter(function (u) { return u.plan && u.plan.status === "under review"; }).length;
    var rev = us.reduce(function (s, u) { return s + revenueOf(u); }, 0);
    var newW = us.filter(function (u) { return new Date(u.joined) > week; }).length;
    var projs = us.reduce(function (s, u) { return s + u.projects.length; }, 0);
    var cards = [["total clients", us.length], ["payments to confirm", us.filter(function (u) { return u.plan && u.plan.payment && !u.plan.paid && u.plan.status !== "cancelled"; }).length], ["work started", active], ["under review", pending], ["new this week", newW], ["projects", projs], ["revenue", money(rev)]];
    $("stats").innerHTML = cards.map(function (c) { return "<div class='stat'><b>" + c[1] + "</b><span>" + c[0] + "</span></div>"; }).join("");

    var counts = {}; PLANS.forEach(function (p) { counts[p.name] = 0; }); counts["no plan"] = 0;
    us.forEach(function (u) { counts[u.plan ? u.plan.name : "no plan"] = (counts[u.plan ? u.plan.name : "no plan"] || 0) + 1; });
    var max = Math.max.apply(null, Object.keys(counts).map(function (k) { return counts[k]; }).concat(1));
    $("dist").innerHTML = Object.keys(counts).map(function (k) {
      return "<div class='line'><span>" + esc(k) + "</span><div class='track2'><i style='width:" + counts[k] / max * 100 + "%'></i></div><b>" + counts[k] + "</b></div>";
    }).join("");

    var days = [], i;
    for (i = 6; i >= 0; i--) { var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i); days.push({ d: d, n: 0 }); }
    us.forEach(function (u) {
      var j = new Date(u.joined); j.setHours(0, 0, 0, 0);
      days.forEach(function (x) { if (x.d.getTime() === j.getTime()) x.n++; });
    });
    var dm = Math.max.apply(null, days.map(function (x) { return x.n; }).concat(1));
    $("bars").innerHTML = days.map(function (x) {
      return "<div>" + x.n + "<span style='height:" + x.n / dm * 90 + "%'></span>" + x.d.toLocaleDateString("en", { weekday: "short" }).toLowerCase() + "</div>";
    }).join("");
  }

  function filtered() {
    var q = $("q").value.trim().toLowerCase(), fp = $("fplan").value, fs = $("fstat").value;
    return Auth.all().filter(function (u) {
      if (q && (u.name + " " + u.email + " " + u.phone).toLowerCase().indexOf(q) < 0) return false;
      if (fp === "__none" ? u.plan : (fp && (!u.plan || u.plan.name !== fp))) return false;
      if (fs && (!u.plan || u.plan.status !== fs)) return false;
      return true;
    }).sort(function (a, b) { return new Date(b.joined) - new Date(a.joined); });
  }

  function renderTable() {
    var us = filtered();
    $("ccount").textContent = us.length;
    $("rows").innerHTML = us.length ? us.map(function (u) {
      return "<tr><td><b>" + esc(u.name) + "</b></td><td>" + esc(u.email) + "<br><small style='color:var(--muted)'>" + esc(u.phone || "—") + "</small></td>" +
        "<td>" + (u.plan ? esc(u.plan.name) + " <small style='color:var(--muted)'>" + money(u.plan.price) + "</small>" : "—") + "</td>" +
        "<td>" + (u.plan ? "<span class='status s-" + Auth.cls(u.plan.status) + "'>" + esc(u.plan.status) + "</span> <span class='status s-" + (u.plan.paid ? "paid" : u.plan.payment ? "under-review" : "unpaid") + "'>" + (u.plan.paid ? "paid" : u.plan.payment ? "confirm payment" : "unpaid") + "</span>" : "—") + "</td>" +
        "<td>" + u.projects.length + "</td><td>" + Auth.fmtDate(u.joined) + "</td>" +
        "<td><div class='acts'><button class='btn sm' data-v='" + esc(u.id) + "'>view</button><button class='btn sm danger' data-d='" + esc(u.id) + "'>delete</button></div></td></tr>";
    }).join("") : "<tr><td colspan='7' class='empty'>no clients found.</td></tr>";
  }

  $("rows").onclick = function (e) {
    var t = e.target;
    if (t.dataset.v) openModal(t.dataset.v);
    if (t.dataset.d) {
      var u = Auth.get(t.dataset.d);
      if (u && confirm("Delete " + u.name + " and all their data? This cannot be undone.")) { Auth.remove(u.id); render(); }
    }
  };

  function opts(list, cur) { return list.map(function (s) { return "<option" + (s === cur ? " selected" : "") + ">" + s + "</option>"; }).join(""); }

  function openModal(id) {
    var u = Auth.get(id); if (!u) return;
    $("box").innerHTML =
      "<button class='close' id='mx' aria-label='close'>×</button><h3>" + esc(u.name) + "</h3>" +
      "<dl class='kv'><dt>email</dt><dd>" + esc(u.email) + "</dd><dt>phone</dt><dd>" + esc(u.phone || "—") + "</dd><dt>joined</dt><dd>" + Auth.fmtDate(u.joined) + "</dd><dt>email status</dt><dd>" + (u.verified ? "verified ✓" : "not verified") +
      "</dd><dt>terms</dt><dd>" + (u.termsAccepted ? "accepted " + Auth.fmtDate(u.termsAccepted) : "—") + "</dd></dl>" +
      "<h3 style='margin-top:22px'>plan</h3>" +
      (u.plan ? "<div class='row2'><div><label>plan</label><select id='m-plan'>" + opts(PLANS.map(function (p) { return p.name; }), u.plan.name) + "</select></div>" +
        "<div><label>order status (client sees this)</label><select id='m-stat'>" + STATUSES.map(function (s) {
          var lock = !u.plan.paid && (s === "work started" || s === "completed");
          return "<option" + (s === u.plan.status ? " selected" : "") + (lock ? " disabled" : "") + ">" + s + "</option>";
        }).join("") + "</select></div></div>" +
        (u.plan.payment ? "<div class='msg ok' style='display:block;margin:12px 0'>client submitted " + esc(u.plan.payment.method.toUpperCase()) + " transaction id <b>" + esc(u.plan.payment.utr) + "</b> on " + Auth.fmtDate(u.plan.payment.submittedAt) +
          ". check it in your bank/UPI app, then tick confirm below. " + (u.plan.paid ? "" : "<button class='btn sm danger' id='m-reject' type='button' style='margin-left:6px'>reject id</button>") + "</div>"
          : (u.plan.paid ? "" : "<p class='empty'>no payment submitted yet.</p>")) +
        "<label style='display:flex;gap:10px;align-items:center;color:var(--text);cursor:pointer'><input id='m-paid' type='checkbox' style='width:auto'" + (u.plan.paid ? " checked" : "") + "> payment received &amp; confirmed" +
        (u.plan.paidAt ? " <small style='color:var(--muted)'>(" + Auth.fmtDate(u.plan.paidAt) + ")</small>" : "") + "</label>" +
        "<p class='empty'>ordered " + Auth.fmtDate(u.plan.started) + " · " + money(u.plan.price) + (u.plan.paid ? "" : " · confirm payment to unlock \"work started\" / \"completed\"") + "</p>"
        : "<p class='empty'>no plan chosen.</p>") +
      "<h3 style='margin-top:18px'>projects (" + u.projects.length + ")</h3>" +
      (u.projects.length ? u.projects.map(function (j, i) {
        return "<div class='proj'><div><b>" + esc(j.title) + "</b><small>" + Auth.fmtDate(j.date) + (j.notes ? " · " + esc(j.notes) : "") + "</small>" +
          (/^https?:\/\//i.test(j.link) ? "<small><a href='" + esc(j.link) + "' target='_blank' rel='noopener' style='color:var(--a)'>files ↗</a></small>" : "") +
          "</div><select data-pi='" + i + "' style='width:auto'>" + opts(PSTAT, j.status) + "</select></div>";
      }).join("") : "<p class='empty'>none yet.</p>") +
      "<a class='btn' style='margin-top:18px;display:inline-block' href='mailto:" + esc(u.email) + "'>email client</a>";
    $("modal").classList.add("open");
    $("mx").onclick = closeModal;
    var mp = $("m-plan"), ms = $("m-stat");
    if (mp) {
      mp.onchange = function () { Auth.update(id, function (x) { var p = PLANS.filter(function (q) { return q.name === mp.value; })[0]; x.plan.name = p.name; x.plan.price = p.price; }); render(); openModal(id); };
      ms.onchange = function () {
        Auth.update(id, function (x) { if (x.plan.paid || (ms.value !== "work started" && ms.value !== "completed")) x.plan.status = ms.value; });
        render(); openModal(id);
      };
      if ($("m-reject")) $("m-reject").onclick = function () {
        Auth.update(id, function (x) { x.plan.payment = null; }); render(); openModal(id);
      };
      $("m-paid").onchange = function () {
        var on = $("m-paid").checked;
        Auth.update(id, function (x) {
          x.plan.paid = on; x.plan.paidAt = on ? new Date().toISOString() : null;
          if (!on && (x.plan.status === "work started" || x.plan.status === "completed")) x.plan.status = "under review"; // can't work without payment
        });
        render(); openModal(id);
      };
    }
    Array.prototype.forEach.call($("box").querySelectorAll("[data-pi]"), function (s) {
      s.onchange = function () { Auth.update(id, function (x) { x.projects[+s.dataset.pi].status = s.value; }); render(); };
    });
  }
  function closeModal() { $("modal").classList.remove("open"); }
  $("modal").onclick = function (e) { if (e.target === $("modal")) closeModal(); };
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeModal(); });

  $("csv").onclick = function () {
    var rows = [["name", "email", "phone", "plan", "price", "status", "paid", "projects", "joined"]].concat(Auth.all().map(function (u) {
      return [u.name, u.email, u.phone, u.plan ? u.plan.name : "", u.plan ? u.plan.price : "", u.plan ? u.plan.status : "", u.plan ? (u.plan.paid ? "yes" : "no") : "", u.projects.length, u.joined];
    }));
    var csv = rows.map(function (r) {
      return r.map(function (c) { c = String(c == null ? "" : c); if (/^[=+\-@]/.test(c)) c = "'" + c; return '"' + c.replace(/"/g, '""') + '"'; }).join(",");
    }).join("\n");
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "khyal-clients.csv"; a.click();
  };

  show();
})();
