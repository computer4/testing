// khyal — tiny server: serves the website and sends verification emails through Gmail SMTP.
// The Gmail app password lives only here (server/.env) and is never sent to the browser.
// Run:  cd server && npm start     then open http://localhost:8123
const http = require("http");
const fs = require("fs");
const path = require("path");
const { sendMail } = require("./smtp");

// --- load .env (no extra dependency) ---
try {
  fs.readFileSync(path.join(__dirname, ".env"), "utf8").split(/\r?\n/).forEach(function (l) {
    var m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  });
} catch (e) { console.warn("no .env found — mail disabled"); }

const PORT = +process.env.PORT || 8123;
const ROOT = path.resolve(__dirname, "..");
const MAIL_ON = !!(process.env.SMTP_USER && process.env.SMTP_PASS);
const SMTP = MAIL_ON ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS.replace(/\s+/g, "") } : null;

const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".woff2": "font/woff2" };

// --- simple rate limiting: max N sends per key per hour ---
const hits = new Map();
function limited(key, max) {
  var now = Date.now(), arr = (hits.get(key) || []).filter(function (t) { return now - t < 36e5; });
  if (arr.length >= max) { hits.set(key, arr); return true; }
  arr.push(now); hits.set(key, arr); return false;
}

const esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };

function body(name, link) {
  return '<div style="font-family:Arial,sans-serif;background:#0a0a0f;padding:32px"><div style="max-width:480px;margin:auto;background:#14141d;border:1px solid #262636;border-radius:16px;padding:28px;color:#f1f0f7">' +
    '<h2 style="margin:0 0 12px;color:#a78bfa">khyal.</h2><p>Hi ' + esc(name) + ',</p>' +
    '<p>Welcome! Please confirm your email address to finish setting up your khyal account.</p>' +
    '<p style="margin:26px 0"><a href="' + esc(link) + '" style="background:linear-gradient(90deg,#a78bfa,#f472b6);color:#0a0a0f;padding:12px 26px;border-radius:99px;text-decoration:none;font-weight:bold">Verify my email</a></p>' +
    '<p style="color:#9a98b0;font-size:13px">Or paste this link in your browser:<br>' + esc(link) + '</p>' +
    '<p style="color:#9a98b0;font-size:13px">If you did not sign up, you can ignore this email.</p></div></div>';
}

function json(res, code, obj) { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); }

const server = http.createServer(function (req, res) {
  var url = new URL(req.url, "http://" + (req.headers.host || "localhost"));

  if (req.method === "GET" && url.pathname === "/api/status") return json(res, 200, { mail: MAIL_ON });

  if (req.method === "POST" && url.pathname === "/api/send-verification") {
    var raw = "";
    req.on("data", function (c) { raw += c; if (raw.length > 5000) req.destroy(); });
    req.on("end", function () {
      var d; try { d = JSON.parse(raw); } catch (e) { return json(res, 400, { ok: false }); }
      var email = String(d.email || "").trim().toLowerCase(), name = String(d.name || "there").slice(0, 80), link;
      if (!MAIL_ON) return json(res, 503, { ok: false, error: "mail not configured" });
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(res, 400, { ok: false, error: "bad email" });
      // the link must point back to this site's login page — prevents using us to send arbitrary links
      try { link = new URL(d.link); } catch (e) { return json(res, 400, { ok: false, error: "bad link" }); }
      if (link.host !== req.headers.host || !link.pathname.endsWith("/login.html") || !link.searchParams.get("verify")) return json(res, 400, { ok: false, error: "bad link" });
      var ip = req.socket.remoteAddress;
      if (limited("ip:" + ip, 10) || limited("em:" + email, 4)) return json(res, 429, { ok: false, error: "too many requests" });
      sendMail(SMTP, {
        from: '"khyal" <' + process.env.SMTP_USER + ">", to: email, subject: "Verify your khyal account",
        text: "Hi " + name + ",\n\nConfirm your email: " + link.href + "\n\nIf you did not sign up, ignore this email.",
        html: body(name, link.href)
      }).then(function () { json(res, 200, { ok: true }); })
        .catch(function (e) { console.error("mail error:", e.message); json(res, 502, { ok: false, error: "send failed" }); });
    });
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); return res.end(); }

  // static files: only public extensions, never dotfiles or the server folder
  var rel = decodeURIComponent(url.pathname);
  if (rel === "/") rel = "/index.html";
  var file = path.resolve(ROOT, "." + rel);
  var inRoot = file.startsWith(ROOT + path.sep);
  var parts = path.relative(ROOT, file).split(path.sep);
  var blocked = !inRoot || parts.some(function (p) { return p.startsWith("."); }) || parts[0] === "server";
  var type = TYPES[path.extname(file).toLowerCase()];
  if (blocked || !type) { res.writeHead(404); return res.end("not found"); }
  fs.readFile(file, function (err, data) {
    if (err) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-cache" });
    res.end(data);
  });
});

server.listen(PORT, function () {
  console.log("khyal site running at http://localhost:" + PORT + (MAIL_ON ? "  (email on)" : "  (email OFF)"));
});
