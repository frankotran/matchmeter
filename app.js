/* MatchMeter app wiring — DOM, freemium gate, result rendering.
   Requires matcher.js (analyze, verdict) loaded first. */
'use strict';

/* ------------------------------------------------------------------
   CONFIG — swap in your real Stripe Payment Link when ready.
   Create one in Stripe Dashboard → Payment Links ($4.99 one-time).
------------------------------------------------------------------ */
const STRIPE_PAYMENT_URL = 'https://buy.stripe.com/00w14ngLnfWx44OcAbejK01';
const FREE_SCANS = 3;

/* ---------------- sample data ---------------- */
const SAMPLE_RESUME = `April Phan — Senior Data Analyst, Seattle WA
april.phan@email.com | linkedin.com/in/aprilphan

EXPERIENCE
Expedia Group — Senior Data Analyst (Oct 2024 – Feb 2026), Seattle
- Built Python and SQL reporting pipelines on Databricks, cutting manual reporting time by 60%
- Created Tableau dashboards tracking booking KPIs for 40+ stakeholders
- Partnered with finance on forecasting models; improved forecast accuracy by 18%
- Automated ETL workflows with PySpark and Airflow; enforced data quality checks

Expedia Group — Senior Financial Analyst (2021 – 2024), Seattle
- Built Hyperion financial models and monthly variance analysis for a $200M budget
- Automated close reporting with Power Query and Excel

SKILLS
Python, SQL, Databricks, PySpark, Tableau, Power BI, Excel, Airflow, dbt,
forecasting, A/B testing, data modeling, stakeholder management, communication

EDUCATION
M.S. Business Analytics — Seattle University (2021)`;

const SAMPLE_JD = `Senior Data Analyst — Seattle (Hybrid)

We're looking for a Senior Data Analyst to join our analytics team and turn data
into decisions across product and finance.

Responsibilities:
- Build and maintain SQL-based reporting pipelines and dashboards in Tableau
- Partner with finance and product stakeholders on forecasting and KPI reporting
- Design A/B tests and analyze experiment results
- Uphold data quality and data governance standards across pipelines

Requirements:
- 4+ years of experience with SQL and Python
- Strong experience with Tableau or Power BI
- Experience with Databricks and PySpark preferred
- Excellent communication and stakeholder management skills
- Experience with dbt and Airflow is a plus
- Solid grasp of statistical methods and forecasting`;

/* ---------------- storage (safe) ---------------- */
const store = {
  get(k, d) {
    try { const v = localStorage.getItem(k); return v === null ? d : v; }
    catch (e) { return d; }
  },
  set(k, v) {
    try { localStorage.setItem(k, v); } catch (e) { /* private mode */ }
  }
};

/* ---------------- dom ---------------- */
const $ = (id) => document.getElementById(id);
const resumeInput = $('resumeInput'), jdInput = $('jdInput');
const resumeCard = $('resumeCard'), jdCard = $('jdCard');

function wordCount(t) {
  const w = t.trim().split(/\s+/).filter(Boolean);
  return t.trim() ? w.length : 0;
}
function refreshCounts() {
  $('resumeCount').textContent = wordCount(resumeInput.value) + ' words';
  $('jdCount').textContent = wordCount(jdInput.value) + ' words';
  const jdWords = wordCount(jdInput.value);
  $('shortJdWarn').classList.toggle('show', jdWords > 0 && jdWords < 30);
}
[resumeInput, jdInput].forEach(el => el.addEventListener('input', () => {
  refreshCounts();
  resumeCard.classList.remove('error'); jdCard.classList.remove('error');
  $('resumeErr').textContent = ''; $('jdErr').textContent = '';
}));

/* ---------------- freemium ---------------- */
function scansUsed() { return parseInt(store.get('mm_scans', '0'), 10) || 0; }
function isUnlocked() { return store.get('mm_unlocked', '0') === '1'; }
function refreshScanUI() {
  const badge = $('scanBadge'), note = $('scanNote');
  if (isUnlocked()) {
    badge.textContent = 'Unlimited';
    badge.classList.remove('warn');
    note.textContent = 'Unlimited plan active — analyze as many postings as you like.';
  } else {
    const left = Math.max(0, FREE_SCANS - scansUsed());
    badge.textContent = left + ' free ' + (left === 1 ? 'scan' : 'scans') + ' left';
    badge.classList.toggle('warn', left === 0);
    note.textContent = left > 0
      ? left + ' of ' + FREE_SCANS + ' free scans remaining — no account needed.'
      : 'Free scans used up — unlock unlimited for a one-time $4.99.';
  }
}

/* ---------------- toolbar ---------------- */
$('sampleResumeBtn').addEventListener('click', () => { resumeInput.value = SAMPLE_RESUME; refreshCounts(); });
$('sampleJdBtn').addEventListener('click', () => { jdInput.value = SAMPLE_JD; refreshCounts(); });
$('clearResumeBtn').addEventListener('click', () => { resumeInput.value = ''; refreshCounts(); resumeInput.focus(); });
$('clearJdBtn').addEventListener('click', () => { jdInput.value = ''; refreshCounts(); jdInput.focus(); });
$('uploadResumeBtn').addEventListener('click', () => $('resumeFile').click());
$('resumeFile').addEventListener('change', (e) => {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => { resumeInput.value = String(reader.result || '').slice(0, 100000); refreshCounts(); };
  reader.onerror = () => { $('resumeErr').textContent = 'Could not read that file.'; };
  reader.readAsText(f);
  e.target.value = '';
});

/* ---------------- paywall ---------------- */
function showPaywall() { $('paywall').classList.add('show'); }
function hidePaywall() { $('paywall').classList.remove('show'); }
$('payBtn').addEventListener('click', () => {
  // Real Stripe link opens in a new tab; unlock happens on return via ?paid=1
  // or the "I already paid" button below.
});
$('alreadyPaidBtn').addEventListener('click', () => { unlock(); hidePaywall(); });
$('closePaywallBtn').addEventListener('click', hidePaywall);
$('paywall').addEventListener('click', (e) => { if (e.target === $('paywall')) hidePaywall(); });
function unlock() { store.set('mm_unlocked', '1'); refreshScanUI(); }
(function initPayBtn() {
  const a = $('payBtn');
  if (STRIPE_PAYMENT_URL.indexOf('REPLACE_WITH') === -1) a.href = STRIPE_PAYMENT_URL;
  else a.removeAttribute('href');
})();

/* ---------------- analysis ---------------- */
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

$('analyzeBtn').addEventListener('click', () => {
  const resume = resumeInput.value, jd = jdInput.value;
  let ok = true;
  if (wordCount(resume) < 10) {
    resumeCard.classList.add('error');
    $('resumeErr').textContent = 'Paste your resume text first (at least a few lines).';
    ok = false;
  }
  if (wordCount(jd) < 10) {
    jdCard.classList.add('error');
    $('jdErr').textContent = 'Paste the job description first (at least a few lines).';
    ok = false;
  }
  if (!ok) {
    (wordCount(resume) < 10 ? resumeInput : jdInput).focus();
    return;
  }
  if (!isUnlocked() && scansUsed() >= FREE_SCANS) { showPaywall(); return; }

  let result;
  try {
    result = analyze(resume, jd);
  } catch (err) {
    $('jdErr').textContent = 'Something went wrong analyzing that text. Try shorter inputs.';
    return;
  }
  if (result.error === 'EMPTY_JD') {
    jdCard.classList.add('error');
    $('jdErr').textContent = 'Could not find meaningful keywords in that job description.';
    return;
  }

  if (!isUnlocked()) store.set('mm_scans', String(scansUsed() + 1));
  refreshScanUI();
  render(result);
  $('results').classList.add('show');
  setTimeout(() => $('results').scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
});

function render(r) {
  const v = verdict(r.score);
  // ring
  const C = 326.7;
  const ring = $('scoreRing'), num = $('scoreNum');
  ring.style.strokeDashoffset = C;
  num.textContent = '0';
  requestAnimationFrame(() => {
    ring.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(.22,1,.36,1)';
    ring.style.strokeDashoffset = C - (C * r.score / 100);
    ring.style.stroke = r.score >= 55 ? '#34d399' : r.score >= 35 ? '#fbbf24' : '#fb7185';
    const t0 = performance.now();
    (function tick(t) {
      const p = Math.min((t - t0) / 1100, 1);
      num.textContent = Math.round((1 - Math.pow(1 - p, 3)) * r.score);
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  });

  $('verdictLabel').textContent = v.label;
  $('verdictSub').textContent = v.blurb;
  $('metaKeywords').textContent = r.jdKeywordCount;
  $('metaMatched').textContent = r.matched.length;
  $('metaMissing').textContent = r.allMissingCount;

  $('missCount').textContent = r.allMissingCount + ' missing';
  $('hitCount').textContent = r.matched.length + ' matched';

  $('missingKw').innerHTML = r.missing.length
    ? r.missing.map((m, i) =>
        `<span class="pill miss${i < 3 ? ' top' : ''}" title="Emphasized in the posting">${esc(m.term)}</span>`).join('')
    : '<span style="color:var(--muted);font-size:14px">None — you cover every keyword found. Nice.</span>';
  $('matchedKw').innerHTML = r.matched.length
    ? r.matched.slice(0, 24).map((m) =>
        `<span class="pill hit">${esc(m.term)}</span>`).join('') +
      (r.matched.length > 24 ? `<span class="pill hit">+${r.matched.length - 24} more</span>` : '')
    : '<span style="color:var(--muted);font-size:14px">No keyword overlap found.</span>';

  $('suggList').innerHTML = r.suggestions.length
    ? r.suggestions.map((s) =>
        `<div class="sugg-item"><b class="term">${esc(s.term)}</b><div class="tip">${esc(s.tip)}</div></div>`).join('')
    : '<div class="sugg-item">Nothing urgent — your resume already covers the posting\u2019s core vocabulary.</div>';

  const labels = { tech: 'Tools & tech', biz: 'Skills & methods', other: 'General keywords' };
  $('catBars').innerHTML = Object.keys(labels).map((k) => {
    const c = r.categories[k] || { matched: 0, total: 0 };
    const pct = c.total ? Math.round((c.matched / c.total) * 100) : 0;
    return `<div class="cat-row">
      <div class="cat-top"><span>${labels[k]}</span><span>${c.matched}/${c.total} · ${pct}%</span></div>
      <div class="bar"><div data-w="${pct}" style="width:0%"></div></div>
    </div>`;
  }).join('');
  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.querySelectorAll('#catBars .bar > div').forEach((d) => { d.style.width = d.getAttribute('data-w') + '%'; });
  }));

  window._lastMissing = r.missing.map((m) => m.term);
}

$('copyMissBtn').addEventListener('click', function () {
  const list = (window._lastMissing || []).join(', ');
  if (!list) return;
  const done = () => {
    const b = $('copyMissBtn');
    b.textContent = 'Copied ✓';
    setTimeout(() => { b.textContent = 'Copy list'; }, 1600);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(list).then(done).catch(() => fallbackCopy(list, done));
  } else fallbackCopy(list, done);
});
function fallbackCopy(text, done) {
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); done(); } catch (e) { /* noop */ }
  document.body.removeChild(ta);
}

/* ---------------- init ---------------- */
refreshCounts();
refreshScanUI();

// Auto-unlock when Stripe redirects back after successful payment (?paid=1).
(function handlePaidReturn() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('paid') === '1') {
      if (!isUnlocked()) unlock();
      params.delete('paid');
      const qs = params.toString();
      const clean = window.location.pathname + (qs ? '?' + qs : '') + window.location.hash;
      window.history.replaceState({}, '', clean);
      $('scanNote').textContent = 'Payment confirmed — unlimited plan active. Analyze away.';
    }
  } catch (e) { /* noop */ }
})();
