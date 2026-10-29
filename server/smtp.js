// Minimal SMTP-over-TLS client (no dependencies) — enough to send one email through Gmail.
const tls = require("tls");

function b64(s) { return Buffer.from(s, "utf8").toString("base64"); }
function wrap(s) { return b64(s).replace(/(.{76})/g, "$1\r\n"); }
function clean(s) { return String(s).replace(/[\r\n]+/g, " "); } // block header injection

function buildMessage(m) {
  var boundary = "khyal-" + Date.now().toString(36);
  var lines = [
    "From: " + clean(m.from), "To: " + clean(m.to),
    "Subject: =?UTF-8?B?" + b64(clean(m.subject)) + "?=",
    "Date: " + new Date().toUTCString(), "MIME-Version: 1.0",
    "Content-Type: multipart/alternative; boundary=\"" + boundary + "\"", "",
    "--" + boundary, "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", wrap(m.text),
    "--" + boundary, "Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: base64", "", wrap(m.html),
    "--" + boundary + "--", ""
  ];
  return lines.join("\r\n");
}

// opts: { user, pass, host?, port? }  m: { from, to, subject, text, html }
function sendMail(opts, m) {
  return new Promise(function (resolve, reject) {
    var sock = tls.connect({ host: opts.host || "smtp.gmail.com", port: opts.port || 465, servername: opts.host || "smtp.gmail.com" });
    var buf = "", step = 0, done = false;
    var addr = function (s) { var x = String(s).match(/<([^>]+)>/); return clean(x ? x[1] : s); };
    var plan = [
      ["", 220],
      ["EHLO khyal.local", 250],
      ["AUTH PLAIN " + b64("\0" + opts.user + "\0" + opts.pass), 235],
      ["MAIL FROM:<" + opts.user + ">", 250],
      ["RCPT TO:<" + addr(m.to) + ">", 250],
      ["DATA", 354],
      [buildMessage(m).replace(/^\./gm, "..") + "\r\n.", 250],
      ["QUIT", 221]
    ];
    function finish(err) { if (done) return; done = true; sock.destroy(); err ? reject(err) : resolve(); }
    sock.setTimeout(20000, function () { finish(new Error("smtp timeout")); });
    sock.on("error", finish);
    sock.on("data", function (d) {
      buf += d.toString("utf8");
      var lines = buf.split("\r\n"); buf = lines.pop();
      lines.forEach(function (line) {
        if (!/^\d{3} /.test(line)) return; // skip continuation lines (250-...)
        var code = +line.slice(0, 3);
        if (code !== plan[step][1]) return finish(new Error("smtp " + line));
        step++;
        if (step >= plan.length) return finish();
        sock.write(plan[step][0] + "\r\n");
      });
    });
  });
}

module.exports = { sendMail: sendMail };
