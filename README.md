# MatchMeter

**Will your resume survive the ATS?** Paste your resume + any job description → get a 0–100 match score, missing keywords, and concrete fix suggestions. 100% client-side — nothing is ever uploaded.

## $0 stack

- **Hosting:** GitHub Pages (free)
- **Backend:** none — all matching runs in `matcher.js` in the browser
- **Payments:** Stripe Payment Link ($4.99 one-time) + `localStorage` freemium gate (3 free scans)

## Files

| File | Purpose |
|---|---|
| `index.html` | Landing page (hero, how it works, pricing, FAQ) |
| `app.html` | The analyzer tool |
| `styles.css` | All styling |
| `matcher.js` | Pure matching engine (no DOM — unit-testable with node) |
| `app.js` | UI wiring, freemium gate, rendering |

## Going live — Stripe

1. Stripe Dashboard → Payment Links → create **$4.99 one-time** link.
2. In `app.js`, set `STRIPE_PAYMENT_URL` to the new link.
3. Commit + push. The paywall "Unlock" button and "I already paid" flow handle the rest.

The unlock is honor-system (`localStorage`) — fine for a $4.99 MVP with no backend. If abuse ever matters, add Stripe webhooks + a tiny worker later.

## Local test

```bash
node --check matcher.js && node --check app.js
```

## Deploy

Push to the `matchmeter` repo's `main` branch with GitHub Pages serving from root.
