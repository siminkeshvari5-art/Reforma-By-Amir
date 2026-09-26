(function () {
  "use strict";
  var doc = document.documentElement;
  doc.classList.add("js");
  var T = window.RBA_I18N || {};

  /* Header surface change after 80px (VD 05 default) */
  var header = document.querySelector(".site-header");
  function onScroll() { if (header) header.classList.toggle("is-scrolled", window.scrollY > 80); }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* Mobile menu */
  var toggle = document.querySelector(".menu-toggle");
  var panel = document.getElementById("nav-panel");
  if (toggle && panel) {
    toggle.addEventListener("click", function () {
      var open = toggle.getAttribute("aria-expanded") !== "true";
      toggle.setAttribute("aria-expanded", String(open));
      toggle.textContent = open ? T.menuClose : T.menuOpen;
      panel.classList.toggle("is-open", open);
      document.body.style.overflow = open ? "hidden" : "";
    });
    panel.addEventListener("click", function (e) {
      if (e.target.closest("a") && panel.classList.contains("is-open")) toggle.click();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && panel.classList.contains("is-open")) { toggle.click(); toggle.focus(); }
    });
  }

  /* Accordions — VD 05 pattern */
  document.querySelectorAll(".t-acc").forEach(function (item) {
    var btn = item.querySelector(".t-acc-head");
    btn.addEventListener("click", function () {
      var open = item.getAttribute("data-open") !== "true";
      item.setAttribute("data-open", String(open));
      btn.setAttribute("aria-expanded", String(open));
    });
  });

  /* Estimator — preliminary public-guide bands, IVA included (see 09-build-notes.md) */
  var DATA = {
    full:    { perM2: [[330, 385], [440, 770], [880, 1100]], weeks: function (m2) { var b = m2 <= 60 ? [8, 10] : m2 <= 100 ? [10, 14] : [14, 18]; return [b, [b[0] + 1, b[1] + 2], [b[0] + 2, b[1] + 4]]; } },
    rooms:   { perM2: [[250, 290], [330, 580], [660, 825]], weeks: function (m2) { var b = m2 <= 30 ? [3, 5] : m2 <= 60 ? [5, 8] : [8, 11]; return [b, [b[0] + 1, b[1] + 2], [b[0] + 2, b[1] + 4]]; } },
    kitchen: { fixed: [[6000, 10000], [10000, 15000], [15000, 25000]], weeks: function () { return [[4, 5], [5, 6], [6, 8]]; } },
    bath:    { fixed: [[4500, 6000], [6000, 8500], [8500, 12000]], weeks: function () { return [[2, 3], [3, 4], [4, 5]]; } }
  };
  var est = document.getElementById("est-form");
  var lastEstimate = "";
  if (est) {
    var sizeField = document.getElementById("est-size-field");
    var sizeInput = document.getElementById("est-size");
    var out = document.getElementById("est-output");
    var sep = (T.locale || "es-ES").indexOf("en") === 0 ? "," : ".";
    var fmt = { format: function (n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, sep); } };
    function roundTo(n) { return n >= 10000 ? Math.round(n / 500) * 500 : Math.round(n / 100) * 100; }
    function syncSize() {
      var t = est.querySelector('input[name="est-type"]:checked');
      var needs = t && (t.value === "full" || t.value === "rooms");
      sizeField.hidden = !needs;
      sizeInput.required = !!needs;
    }
    est.addEventListener("change", syncSize);
    syncSize();
    est.addEventListener("submit", function (e) {
      e.preventDefault();
      var typeErr = document.getElementById("est-type-error");
      var sizeErr = document.getElementById("est-size-error");
      typeErr.hidden = true; sizeErr.hidden = true; sizeInput.removeAttribute("aria-invalid");
      var t = est.querySelector('input[name="est-type"]:checked');
      if (!t) { typeErr.hidden = false; est.querySelector('input[name="est-type"]').focus(); return; }
      var d = DATA[t.value], m2 = parseFloat(sizeInput.value);
      if (d.perM2 && (!(m2 >= 10) || m2 > 400)) { sizeErr.hidden = false; sizeInput.setAttribute("aria-invalid", "true"); sizeInput.focus(); return; }
      var ranges = d.perM2 ? d.perM2.map(function (r) { return [roundTo(r[0] * m2), roundTo(r[1] * m2)]; }) : d.fixed;
      var weeks = d.weeks(m2);
      var typeLabel = T.types[t.value];
      var heading = d.perM2 ? T.resultHeading.replace("{type}", typeLabel).replace("{size}", fmt.format(m2)) : T.resultHeadingNoSize.replace("{type}", typeLabel);
      var html = '<span class="level" aria-hidden="true"></span><h3>' + heading + '</h3><ul class="est-rows">';
      var summary = [];
      ranges.forEach(function (r, i) {
        var amount = fmt.format(r[0]) + " – " + fmt.format(r[1]) + " €";
        var wk = T.duration.replace("{a}", weeks[i][0]).replace("{b}", weeks[i][1]);
        html += '<li><span class="tier">' + T.tiers[i] + '</span><span class="amount">' + amount + '</span><span class="weeks">' + wk + "</span></li>";
        summary.push(T.tiers[i] + ": " + amount + " (" + wk + ")");
      });
      html += '</ul><p class="est-vat">' + T.vat + "</p>";
      html += '<a class="btn btn-primary on-dark" href="#S10-request" data-cta="estimator">' + T.cta + '</a><p class="hint">' + T.ctaHint + "</p>";
      out.innerHTML = html;
      out.focus();
      lastEstimate = heading + " — " + summary.join("; ");
      var inc = document.getElementById("f-estimate-wrap");
      if (inc) { inc.hidden = false; document.getElementById("f-estimate").checked = true; }
      track("estimator_result", { type: t.value });
    });
  }

  /* Request form — FormSubmit AJAX; success shown only when the service confirms */
  var form = document.getElementById("request-form");
  if (form) {
    var status = document.getElementById("form-status");
    var phoneWrap = document.getElementById("f-phone-wrap");
    var emailWrap = document.getElementById("f-email-wrap");
    function syncMethod() {
      var m = form.querySelector('input[name="contact_method"]:checked');
      var v = m ? m.value : "";
      phoneWrap.hidden = v === "Email";
      emailWrap.hidden = !(v === "Email" || v === "");
      if (v === "") { phoneWrap.hidden = false; }
      form.elements.phone.required = v === "Phone" || v === "WhatsApp";
      form.elements.email.required = v === "Email";
    }
    form.addEventListener("change", syncMethod);
    syncMethod();

    var params = new URLSearchParams(window.location.search);
    form.elements.utm_source.value = params.get("utm_source") || "";
    form.elements.utm_campaign.value = params.get("utm_campaign") || "";

    var started = false;
    form.addEventListener("input", function () { if (!started) { started = true; track("form_start"); } });

    function setError(name, msg) {
      var el = form.elements[name];
      var err = document.getElementById("err-" + name);
      if (err) { err.textContent = msg; err.hidden = !msg; }
      var target = el && el.length && !el.tagName ? el[0] : el;
      if (target && target.setAttribute) { if (msg) target.setAttribute("aria-invalid", "true"); else target.removeAttribute("aria-invalid"); }
    }
    function validate() {
      var first = null, f = form.elements;
      function need(name, ok, msg) { setError(name, ok ? "" : msg); if (!ok && !first) first = name; }
      need("renovation_type", !!form.querySelector('input[name="renovation_type"]:checked'), T.err.type);
      need("description", f.description.value.trim().length > 0, T.err.description);
      need("neighbourhood", f.neighbourhood.value.trim().length > 0, T.err.neighbourhood);
      need("start_timing", !!f.start_timing.value, T.err.timing);
      need("name", f.name.value.trim().length > 0, T.err.name);
      var m = form.querySelector('input[name="contact_method"]:checked');
      need("contact_method", !!m, T.err.method);
      if (m && m.value !== "Email") need("phone", /^[+\d][\d\s().-]{6,}$/.test(f.phone.value.trim()), T.err.phone); else setError("phone", "");
      if (m && m.value === "Email") need("email", /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.value.trim()), T.err.email); else setError("email", "");
      need("consent", f.consent.checked, T.err.consent);
      return first;
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      status.hidden = true;
      var first = validate();
      if (first) {
        var el = form.elements[first];
        (el.length && !el.tagName ? el[0] : el).focus();
        return;
      }
      var btn = form.querySelector('button[type="submit"]');
      var label = btn.textContent;
      btn.disabled = true; btn.textContent = T.sending;
      var fd = new FormData(form);
      var data = {};
      fd.forEach(function (v, k) { data[k] = v; });
      data.estimate = (form.elements.include_estimate && form.elements.include_estimate.checked) ? lastEstimate : "";
      delete data.include_estimate;
      fetch(form.getAttribute("data-ajax"), {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(data)
      }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
        .then(function (res) {
          var success = res.ok && (res.body.success === true || res.body.success === "true");
          if (!success) throw new Error("not confirmed");
          var method = form.querySelector('input[name="contact_method"]:checked');
          var methodLabel = method ? method.getAttribute("data-label") : "";
          status.className = "form-status is-success";
          status.textContent = T.success.replace("{name}", data.name).replace("{method}", methodLabel);
          status.hidden = false;
          form.reset(); syncMethod();
          track("form_submit_success");
        })
        .catch(function () {
          status.className = "form-status is-error";
          status.innerHTML = T.error;
          status.hidden = false;
          track("form_submit_error");
        })
        .finally(function () { btn.disabled = false; btn.textContent = label; status.focus(); });
    });
  }

  /* Minimal event hooks — no analytics tool connected yet; events go to dataLayer if one is added */
  function track(name, props) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({ event: name, lang: doc.lang }, props || {}));
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest("a, button");
    if (!a) return;
    if (a.hasAttribute("data-cta")) track("cta_request_click", { location: a.getAttribute("data-cta") });
    var href = a.getAttribute("href") || "";
    if (href.indexOf("wa.me") > -1) track("whatsapp_click");
    if (href.indexOf("mailto:") === 0) track("email_click");
    if (a.closest(".lang")) track("language_switch");
  });
  var estStarted = false;
  if (est) est.addEventListener("change", function () { if (!estStarted) { estStarted = true; track("estimator_start"); } });

  /* Review-only grid overlay (?grid=1) */
  if (/[?&]grid=1/.test(window.location.search)) {
    var ov = document.createElement("div");
    ov.className = "grid-overlay"; ov.setAttribute("aria-hidden", "true");
    ov.innerHTML = '<div class="container"><div class="grid">' + new Array(13).join("<div></div>") + "</div></div>";
    document.body.appendChild(ov);
  }
})();
