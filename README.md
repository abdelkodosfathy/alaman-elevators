# Alaman Elevators: Configurator Platform

Customers configure an elevator or escalator part by part and get an instant price estimate, then submit a quote request and download it as PDF. Prices, options and compatibility rules are data, edited from the admin panel, and everything is exposed over a versioned REST API so other platforms (mobile app, CRM, WhatsApp gateway, partners) can integrate.

```
apps/
  api/   NestJS + Prisma + PostgreSQL   REST API  →  http://localhost:4000/api/v1   (Swagger: /api/docs)
  web/   Next.js 15 + Tailwind          Customer configurator + admin panel → http://localhost:3000
index.html, system.html                 Original marketing site / prototype
```

## Run locally

```bash
npm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
npm run db:start          # local PostgreSQL without Docker (or: docker compose up -d)
npm run db:setup          # in a second terminal: migrations + demo catalog
npm run dev:api           # API on :4000
npm run dev:web           # web on :3000
npm test                  # pricing engine tests
```

Admin panel: `http://localhost:3000/admin`, login from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `apps/api/.env` (created on first start). Change them and `JWT_SECRET` before deploying.

## Data model

`Product` → `Step` → `Attribute` → `Option`, plus `OptionRule`.

- **Attribute input types**: `SINGLE` (pick one), `MULTI` (pick many), `NUMBER` (stops, rise in meters). A NUMBER attribute has `includedUnits` covered by the base price and a `unitPrice` per extra unit.
- **Option price types**: `FIXED`, `PER_UNIT` (price × a NUMBER attribute, e.g. landing doors × stops), `PERCENT` (of the subtotal, e.g. extended warranty).
- **Rules**: `EXCLUDES` / `REQUIRES` between option codes. Enforced by the API; the UI mirrors them (earlier choices win, later ones auto-adjust).

A new product line (e.g. dumbwaiter, car lift) is just new rows. No code changes needed.

## REST API (v1)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/catalog/products` | Product lines |
| GET | `/catalog/products/:slug` | Full configurator: steps, attributes, options, rules |
| POST | `/pricing/estimate` | `{ productSlug, selections }` → breakdown, VAT, total, range, issues |
| POST | `/quotes` | Submit a quote (re-priced server side). `source` tags the calling platform |
| GET | `/quotes/:token` · `/quotes/:token/pdf` | Public quote view / PDF |
| POST | `/admin/auth/login` | Bearer token for admin routes |
| GET/PATCH | `/admin/quotes`, `/admin/stats` | Quote pipeline |
| PATCH/POST/DELETE | `/admin/products`, `/admin/attributes`, `/admin/options`, `/admin/rules` | Catalog & pricing |
| CRUD | `/admin/webhooks` | Outgoing integrations |

`selections` is keyed by attribute key: an option code for SINGLE, an array of codes for MULTI, a number for NUMBER. Omitted keys fall back to catalog defaults.

### Webhooks

Events `quote.created` and `quote.status_changed` are POSTed as JSON to registered URLs with headers `X-Alaman-Event` and `X-Alaman-Signature` (hex HMAC-SHA256 of the raw body using the webhook secret).

## 3D cabin model

The configurator shows the elevator interior in real-time 3D (three.js / React Three Fiber). The car is modelled in Blender by script, so it is reproducible and versioned like code:

```bash
npm run models -w @alaman/web                      # all sizes (needs Blender 4.x)
npm run models -w @alaman/web -- --sizes 630       # one size
npm run models -w @alaman/web -- --compress-only   # re-compress existing raw exports
```

- `apps/web/blender/build_cabin.py` builds one car per rated load (320–1600 kg) with bevelled panels, door, ceilings, handrails and car panel, bakes ambient occlusion into a shared atlas and exports a GLB. `build-models.mjs` then meshopt-compresses it into `apps/web/public/models/cabin/` (~0.6 MB model + ~0.4 MB AO per size; only the selected size is downloaded).
- Finishes are not baked: the web app applies wall/floor/ceiling/handrail materials by material name and toggles option nodes (door type, ceiling style, buttons per stop, extras…) by node name. Those names are the contract between `build_cabin.py` and `ModelCabin.tsx`.
- If a model file is missing the viewer falls back to a lighter procedural cabin, and to a 2D illustration without WebGL.
- Set `BLENDER=/path/to/blender` if Blender isn't installed in its default location. Baking runs on the GPU when Cycles finds one; on CPU allow ~8 minutes per size.

## Notes

- Seed prices are indicative placeholders; set real prices from the admin panel.
- PDFs are rendered with headless Chrome (Puppeteer) for correct Arabic shaping.
