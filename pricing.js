// Pricing data + renderer. Edit prices/features here; index.html updates automatically.
window.KHYAL_EMAIL = "khyal.music.work@gmail.com";

// Where clients send payment. Fill in upiId (e.g. "khyal@okhdfcbank") to turn the UPI payment option on.
window.PAYMENT = {
  upiId: "",
  payeeName: "khyal",
  note: "khyal mix & master"
};

window.PLANS = [
  {
    name: "Starter",
    for: "For newbies",
    oldPrice: 500,
    price: 250,
    features: ["Mixing", "Basic level processing", "Release-ready stereo mix"],
    featured: false
  },
  {
    name: "Rising",
    for: "For rising artists",
    oldPrice: 750,
    price: 600,
    features: ["Mix + Master", "Advanced processing", "Release-ready final master", "1 revision"],
    featured: true
  },
  {
    name: "Professional",
    for: "For professional artists",
    oldPrice: 1000,
    price: 750,
    features: ["Mix + Master", "Professional processing", "Release-ready final master", "2 revisions"],
    featured: false
  }
];

window.renderPricing = function (container) {
  var fmt = function (n) { return "₹" + n.toLocaleString("en-IN"); };
  container.innerHTML = window.PLANS.map(function (p) {
    var off = Math.round((1 - p.price / p.oldPrice) * 100);
    var subject = encodeURIComponent(p.name + " plan enquiry");
    return '<div class="card plan reveal' + (p.featured ? " feat" : "") + '" data-tilt>' +
      (p.featured ? '<span class="badge">POPULAR</span>' : "") +
      "<h3>" + p.name + "</h3>" +
      '<div class="for">' + p.for + "</div>" +
      '<div class="price"><span class="count" data-to="' + p.price + '">' + fmt(p.price) + "</span><s>" + fmt(p.oldPrice) + "</s></div>" +
      '<div class="off">' + off + "% off</div>" +
      "<ul>" + p.features.map(function (f) { return "<li>" + f + "</li>"; }).join("") + "</ul>" +
      '<a class="btn' + (p.featured ? " p" : "") + '" href="login.html?mode=signup&plan=' + encodeURIComponent(p.name) + '">Get Started</a>' +
      "</div>";
  }).join("");
};
