(function () {
  var $ = function (id) { return document.getElementById(id); };
  var params = new URLSearchParams(location.search);

  // email verification link: login.html?verify=<token>
  var verifiedNow = false;
  if (params.get("verify")) {
    verifiedNow = !!Auth.verify(params.get("verify"));
  }

  if (!verifiedNow && Auth.current()) { location.replace("dashboard.html"); return; }
  if (!verifiedNow && Auth.adminOk()) { location.replace("admin.html"); return; }

  var sel = $("s-plan");
  PLANS.forEach(function (p) {
    var o = document.createElement("option");
    o.value = p.name; o.textContent = p.name + " — " + Auth.money(p.price);
    sel.appendChild(o);
  });
  if (params.get("plan")) sel.value = params.get("plan");

  function msg(t, ok) {
    var m = $("msg");
    m.innerHTML = "";
    if (t instanceof Node) m.appendChild(t); else m.textContent = t || "";
    m.className = "msg" + (t ? (ok ? " ok" : " err") : "");
  }
  function mode(m) {
    var s = m === "signup";
    $("f-login").classList.toggle("hide", s);
    $("f-signup").classList.toggle("hide", !s);
    $("t-login").classList.toggle("on", !s);
    $("t-signup").classList.toggle("on", s);
    msg("");
  }
  $("t-login").onclick = function () { mode("login"); };
  $("t-signup").onclick = function () { mode("signup"); };
  mode(params.get("mode") === "signup" ? "signup" : "login");

  if (params.get("verify")) {
    msg(verifiedNow ? "email verified ✓ — you can log in now." : "this verification link is invalid or already used.", verifiedNow);
    if (verifiedNow) mode("login"), msg("email verified ✓ — you can log in now.", true);
  }

  // terms modal
  $("termsList").innerHTML = TERMS.map(function (t) { return "<li>" + Auth.esc(t) + "</li>"; }).join("");
  function terms(open) { $("termsModal").classList.toggle("open", open); }
  $("openTerms").onclick = function (e) { e.preventDefault(); terms(true); };
  $("termsClose").onclick = $("termsOk").onclick = function () { terms(false); };
  $("termsModal").onclick = function (e) { if (e.target === $("termsModal")) terms(false); };

  function go() { msg("welcome! redirecting…", true); setTimeout(function () { location.href = "dashboard.html"; }, 500); }

  $("f-login").onsubmit = function (e) {
    e.preventDefault();
    Auth.login($("l-email").value, $("l-pass").value).then(function (r) {
      if (r && r.admin) { msg("admin login ✓ redirecting…", true); location.href = "admin.html"; }
      else go();
    }).catch(function (er) {
      if (er.code !== "unverified") return msg(er.message);
      var box = document.createElement("span");
      box.appendChild(document.createTextNode(er.message + " "));
      var b = document.createElement("a"); b.href = "#"; b.textContent = "resend email"; b.style.textDecoration = "underline";
      b.onclick = function (ev) {
        ev.preventDefault();
        var u = Auth.resendFor($("l-email").value);
        if (!u) return msg("This account is already verified — try logging in.");
        Mail.sendVerification(u).then(function (r) { msg(r.sent ? "verification email sent to " + u.email + "." : verifyLinkNote(r, u), true); });
      };
      box.appendChild(b);
      msg(box);
    });
  };

  // shown only when the mail server isn't running (demo mode) or sending failed
  function verifyLinkNote(res, user) {
    var box = document.createElement("span");
    box.appendChild(document.createTextNode((res.failed ? "account created, but the email could not be sent. " : "email sending isn't available (start the server: cd server && npm start). ") + "Use this link to verify: "));
    var a = document.createElement("a"); a.href = res.link; a.textContent = "verify my email"; a.style.textDecoration = "underline";
    box.appendChild(a);
    return box;
  }

  $("f-signup").onsubmit = function (e) {
    e.preventDefault();
    if ($("s-pass").value !== $("s-pass2").value) return msg("Passwords don't match.");
    if (!$("s-terms").checked) return msg("You must accept the terms & conditions.");
    var btn = e.target.querySelector("button[type=submit]");
    btn.disabled = true;
    Auth.signup({
      name: $("s-name").value, email: $("s-email").value, phone: $("s-phone").value,
      password: $("s-pass").value, plan: sel.value, terms: true
    }).then(function (user) {
      return Mail.sendVerification(user).then(function (res) {
        e.target.reset();
        if (res.sent) { msg("account created! we sent a verification email to " + user.email + " — open it and confirm, then log in.", true); btn.disabled = false; return; }
        msg(verifyLinkNote(res, user), true); btn.disabled = false;
      });
    }).catch(function (er) { msg(er.message); btn.disabled = false; });
  };
})();
