// khyal — verification email sender (browser side).
// The email is actually sent by server/server.js through Gmail SMTP; the Gmail password never reaches the browser.
// Start the site with:  cd server && npm start   (then open http://localhost:8123)
// Opened as a plain file (or without the server) the site runs in demo mode: the verify link is shown on screen.
(function () {
  function linkFor(user) {
    return new URL("login.html?verify=" + encodeURIComponent(user.verifyToken), location.href).href;
  }

  var Mail = window.Mail = {
    enabled: false,
    linkFor: linkFor,
    // resolves { sent: true } or { sent: false, link, failed? }
    sendVerification: function (user) {
      var link = linkFor(user);
      if (!/^https?:/.test(location.protocol)) return Promise.resolve({ sent: false, link: link });
      return fetch("/api/send-verification", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: user.name, email: user.email, link: link })
      }).then(function (r) {
        if (r.status === 404 || r.status === 405 || r.status === 503) return { sent: false, link: link }; // no mail server
        if (!r.ok) return { sent: false, link: link, failed: true };
        return { sent: true };
      }).catch(function () { return { sent: false, link: link }; });
    }
  };

  if (/^https?:/.test(location.protocol)) {
    fetch("/api/status").then(function (r) { return r.json(); }).then(function (s) { Mail.enabled = !!s.mail; }).catch(function () {});
  }
})();
