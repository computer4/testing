(function () {
  var $ = function (id) { return document.getElementById(id); };
  var esc = Auth.esc;
  var me = Auth.current();
  if (!me) { location.replace("login.html"); return; }

  $("help").href = "mailto:" + KHYAL_EMAIL;
  $("logout").onclick = function () { Auth.logout(); location.href = "login.html"; };

  var STEPS = ["under review", "work started", "completed"];
  var PSTEPS = ["received", "in progress", "delivered"];

  function flash(id, text, ok) {
    var m = $(id); m.textContent = text; m.className = "msg " + (ok ? "ok" : "err");
    setTimeout(function () { m.className = "msg"; }, 3000);
  }

  function render() {
    me = Auth.current();
    if (!me) { location.replace("login.html"); return; }
    $("who").textContent = me.email;

    // email verification banner
    var vb = $("verifyBar");
    if (me.verified) { vb.className = "msg"; vb.innerHTML = ""; vb.style.display = "none"; }
    else {
      vb.className = "msg err"; vb.style.display = "block";
      vb.innerHTML = "your email isn't verified yet — check your inbox (and spam) for the link from khyal. <button class='btn sm' id='resend' type='button' style='margin-left:8px'>resend email</button><span id='dev'></span>";
      $("resend").onclick = function () {
        var u = Auth.renewToken(me.id);
        Mail.sendVerification(u).then(function (r) {
          if (r.sent) { $("dev").textContent = " sent ✓"; return; }
          var a = document.createElement("a"); a.href = r.link; a.textContent = "verify now"; a.style.textDecoration = "underline";
          $("dev").textContent = r.failed ? " couldn't send — " : " email sending isn't set up (demo) — "; $("dev").appendChild(a);
        });
      };
    }
    $("hello").textContent = "hello, " + me.name.split(" ")[0].toLowerCase() + " 👋";

    // plan card
    var p = me.plan, full = p && PLANS.filter(function (x) { return x.name === p.name; })[0];
    if (!p) {
      $("planCard").innerHTML = "<h3>active plan</h3><p class='empty'>you haven't chosen a plan yet. pick one below to get started.</p>";
    } else {
      var idx = Math.max(STEPS.indexOf(p.status), 0);
      var done = p.status === "cancelled";
      $("planCard").innerHTML =
        "<h3>my plan <span><span class='status s-" + (p.paid ? "paid" : "unpaid") + "'>" + (p.paid ? "payment confirmed ✓" : "payment awaiting") + "</span> " +
        "<span class='status s-" + Auth.cls(p.status) + "'>" + esc(p.status) + "</span></span></h3>" +
        "<div class='bigplan'>" + esc(p.name) + " <small>" + Auth.money(p.price) + (full ? " <s>" + Auth.money(full.oldPrice) + "</s>" : "") + "</small></div>" +
        (full ? "<ul class='feat'>" + full.features.map(function (f) { return "<li>" + esc(f) + "</li>"; }).join("") + "</ul>" : "") +
        (done ? "" : "<div class='steps'>" + STEPS.map(function (s, i) { return "<i class='" + (i <= idx ? "on" : "") + "'></i>"; }).join("") + "</div>" +
          "<div class='steplbl'>" + STEPS.map(function (s) { return "<span>" + s + "</span>"; }).join("") + "</div>") +
        "<p class='empty'>ordered " + Auth.fmtDate(p.started) +
        (p.status === "under review" ? (p.paid ? " · payment confirmed, khyal will start work soon" : p.payment ? " · payment submitted — khyal is confirming it" : " · pay below, work starts once khyal confirms your payment") : "") +
        (p.paidAt ? " · paid " + Auth.fmtDate(p.paidAt) : "") + "</p>";
    }

    renderPay(p);

    // details
    $("detailCard").innerHTML =
      "<h3>my details <button class='btn sm' id='editBtn' type='button'>edit</button></h3>" +
      "<dl class='kv' id='kv'><dt>name</dt><dd>" + esc(me.name) + "</dd><dt>email</dt><dd>" + esc(me.email) +
      "</dd><dt>phone</dt><dd>" + esc(me.phone || "—") + "</dd><dt>member since</dt><dd>" + Auth.fmtDate(me.joined) +
      "</dd><dt>projects</dt><dd>" + me.projects.length + "</dd></dl>" +
      "<form id='editForm' class='hide'><label>name</label><input id='e-name' value='" + esc(me.name) + "' required>" +
      "<label>phone</label><input id='e-phone' value='" + esc(me.phone) + "'>" +
      "<button class='btn p' style='width:100%;margin-top:16px' type='submit'>save</button></form>";
    $("editBtn").onclick = function () { $("kv").classList.toggle("hide"); $("editForm").classList.toggle("hide"); };
    $("editForm").onsubmit = function (e) {
      e.preventDefault();
      Auth.update(me.id, function (u) { u.name = $("e-name").value.trim() || u.name; u.phone = $("e-phone").value.trim(); });
      render();
    };

    // plan picker
    $("planPick").innerHTML = PLANS.map(function (x) {
      return "<button type='button' class='pm" + (p && p.name === x.name ? " cur" : "") + "' data-p='" + esc(x.name) + "'><b>" + esc(x.name) +
        "</b><span>" + esc(x.for) + "</span><br><em>" + Auth.money(x.price) + "</em></button>";
    }).join("");
    Array.prototype.forEach.call($("planPick").querySelectorAll(".pm"), function (b) {
      b.onclick = function () {
        if (p && p.name === b.dataset.p) return;
        if (p && (p.paid || p.status === "work started" || p.status === "completed")) return flash("planMsg", "this order is already paid / in progress — mail khyal to change it.", false);
        Auth.setPlan(me.id, b.dataset.p); render();
        flash("planMsg", "plan updated — it's now under review.", true);
      };
    });

    // projects
    $("pcount").textContent = me.projects.length;
    $("projList").innerHTML = me.projects.length ? me.projects.slice().reverse().map(function (j) {
      return "<div class='proj'><div><b>" + esc(j.title) + "</b><small>" + Auth.fmtDate(j.date) + (j.notes ? " · " + esc(j.notes) : "") + "</small>" +
        (/^https?:\/\//i.test(j.link) ? "<small><a href='" + esc(j.link) + "' target='_blank' rel='noopener' style='color:var(--a)'>files ↗</a></small>" : "") +
        "</div><span class='status s-" + esc(j.status.replace(" ", "-")) + "'>" + esc(j.status) + "</span></div>";
    }).join("") : "<p class='empty'>no projects yet — submit your first track.</p>";
  }

  function renderPay(p) {
    var card = $("payCard");
    if (!p || p.status === "cancelled") { card.classList.add("hide"); return; }
    card.classList.remove("hide");
    if (p.paid) {
      card.innerHTML = "<h3>payment <span class='status s-paid'>confirmed ✓</span></h3><p class='empty'>" + Auth.money(p.price) + " received" + (p.paidAt ? " on " + Auth.fmtDate(p.paidAt) : "") + ". thank you!</p>";
      return;
    }
    var P = window.PAYMENT || {};
    if (!P.upiId) {
      card.innerHTML = "<h3>payment <span class='status s-unpaid'>awaiting</span></h3><p class='empty'>online payment isn't set up yet — mail <a href='mailto:" + esc(KHYAL_EMAIL) + "' style='color:var(--a)'>" + esc(KHYAL_EMAIL) + "</a> to pay for your " + esc(p.name) + " plan (" + Auth.money(p.price) + ").</p>";
      return;
    }
    var upi = "upi://pay?pa=" + encodeURIComponent(P.upiId) + "&pn=" + encodeURIComponent(P.payeeName || "khyal") + "&am=" + p.price + "&cu=INR&tn=" + encodeURIComponent((P.note || "khyal") + " - " + p.name);
    var pay = p.payment;
    card.innerHTML =
      "<h3>pay for your plan <span class='status s-" + (pay ? "under-review" : "unpaid") + "'>" + (pay ? "waiting for confirmation" : "payment awaiting") + "</span></h3>" +
      "<div class='row2' style='align-items:start'>" +
      "<div><p style='margin-bottom:10px'>pay <b>" + Auth.money(p.price) + "</b> by UPI (GPay, PhonePe, Paytm, any app):</p>" +
      "<div id='qr' style='background:#fff;padding:10px;border-radius:12px;display:inline-block'></div>" +
      "<p class='empty'>UPI id: <b id='upiId'>" + esc(P.upiId) + "</b> <button class='btn sm' id='copyUpi' type='button'>copy</button></p>" +
      "<a class='btn p sm' href='" + esc(upi) + "'>open UPI app (phone)</a></div>" +
      "<div>" + (pay
        ? "<p>you submitted transaction id <b>" + esc(pay.utr) + "</b> on " + Auth.fmtDate(pay.submittedAt) + ".</p><p class='empty'>khyal will confirm it shortly and start work. wrong id? send it again below.</p>" : "<p>after paying, enter the transaction / UTR id shown in your payment app:</p>") +
      "<form id='payForm'><label for='utr'>transaction / UTR id</label><input id='utr' required maxlength='22' autocomplete='off' placeholder='e.g. 412345678901'>" +
      "<button class='btn p' type='submit' style='width:100%;margin-top:16px'>" + (pay ? "update transaction id" : "i've paid") + "</button></form><div class='msg' id='payMsg'></div></div></div>";
    if (window.QRCode) new QRCode($("qr"), { text: upi, width: 150, height: 150 });
    else $("qr").textContent = "QR unavailable offline";
    $("copyUpi").onclick = function () { if (navigator.clipboard) navigator.clipboard.writeText(P.upiId); this.textContent = "copied"; };
    $("payForm").onsubmit = function (e) {
      e.preventDefault();
      var err = Auth.submitPayment(me.id, "upi", $("utr").value);
      if (err) return flash("payMsg", err, false);
      render();
    };
  }

  $("projForm").onsubmit = function (e) {
    e.preventDefault();
    if (!me.plan) return flash("projMsg", "choose a plan first.", false);
    if (Mail.enabled && !me.verified) return flash("projMsg", "please verify your email first.", false);
    Auth.update(me.id, function (u) {
      u.projects.push({ id: "p" + Date.now(), title: $("p-title").value.trim(), link: $("p-link").value.trim(), notes: $("p-notes").value.trim(), status: "received", date: new Date().toISOString() });
    });
    $("projForm").reset(); render();
    flash("projMsg", "project sent!", true);
  };

  render();
  // reveal animation (app.js is not loaded here)
  Array.prototype.forEach.call(document.querySelectorAll(".reveal"), function (el, i) { setTimeout(function () { el.classList.add("in"); }, 80 * i); });
})();
