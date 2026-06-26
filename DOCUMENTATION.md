# Doculoom — Complete Technical Documentation

> Owned and operated by **Livessa** (Quebec, Canada)  
> Last updated: June 2026

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Database Schema](#3-database-schema)
4. [Authentication & User Lifecycle](#4-authentication--user-lifecycle)
5. [Subscription & Payments (Stripe)](#5-subscription--payments-stripe)
6. [The Editor (Canvas)](#6-the-editor-canvas)
7. [Excel / Data Integration](#7-excel--data-integration)
8. [AI Features](#8-ai-features)
9. [PDF Export Pipeline](#9-pdf-export-pipeline)
10. [QR Codes](#10-qr-codes)
11. [Object Storage (User Uploads)](#11-object-storage-user-uploads)
12. [Templates](#12-templates)
13. [API Reference](#13-api-reference)
14. [Frontend Routes & Pages](#14-frontend-routes--pages)
15. [Environment Variables (Secrets)](#15-environment-variables-secrets)
16. [Server Startup & Monitoring](#16-server-startup--monitoring)

---

## 1. Overview

Doculoom is a browser-based SaaS application for creating professional **spec sheets and product catalogs** by combining custom visual designs with data from Excel/CSV files. It is the simpler alternative to InDesign for data-driven document production.

### Core Workflow

```
Upload Excel → Build canvas design → Bind data fields → Preview per row → Export PDF(s)
```

A user uploads a spreadsheet, designs a page on the canvas, maps spreadsheet columns to canvas placeholders, previews how each row renders, then exports either a single PDF or a bulk ZIP of one PDF per data row.

---

## 2. Architecture

### Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Routing | Wouter |
| State | Zustand (`canvas-store.ts`) |
| UI Components | shadcn/ui (Radix UI primitives) + Tailwind CSS |
| Data Fetching | TanStack Query v5 |
| Backend | Express.js + TypeScript (tsx runtime) |
| Database | Neon PostgreSQL via Drizzle ORM |
| Auth | Clerk (`@clerk/clerk-react` + `@clerk/express`) |
| Payments | Stripe Subscriptions |
| AI | Google Gemini 2.5 Flash Lite |
| PDF Rendering | Puppeteer-core + system Chromium |
| ZIP Creation | JSZip |
| Job Queue | BullMQ + Upstash Redis |
| File Uploads | Replit Object Storage (signed PUT URLs) |
| Logging | Pino (structured JSON) |
| Error Tracking | Sentry |

### How Frontend and Backend Connect

Both frontend and backend run on **port 5000**. Vite serves the React app; Express handles all `/api/*`, `/public-objects/*`, `/objects/*`, `/q/:id`, and `/health` routes. No proxy or separate ports are needed.

### Request Authentication

Every protected API route extracts the Clerk user from `getAuth(req)` (middleware injected by `clerkMiddleware()` in `server/index.ts`). The frontend sends `Authorization: Bearer <clerk_token>` or relies on the Clerk cookie — Clerk middleware handles both.

---

## 3. Database Schema

All tables are defined in `shared/schema.ts` and synced via `npm run db:push` (Drizzle Kit).

### `users`

Stores every registered user. Created lazily on first `POST /api/users/sync`.

| Column | Type | Purpose |
|---|---|---|
| `id` | varchar(255) PK | Clerk user ID |
| `email` | varchar(255) | Primary email from Clerk |
| `normalized_email` | varchar(255) | Normalized email for abuse detection (dots/plus stripped) |
| `device_fingerprint` | varchar(255) | Browser fingerprint for abuse detection |
| `stripe_customer_id` | varchar(255) | Stripe customer object ID |
| `stripe_subscription_id` | varchar(255) | Active Stripe subscription ID |
| `plan` | varchar(50) | `"free"`, `"pro"`, `"scale"`, etc. |
| `plan_status` | varchar(50) | `"active"`, `"canceled"`, `"past_due"` |
| `pdf_usage_count` | integer | Monthly PDF export count |
| `pdf_usage_reset_date` | timestamp | When PDF count resets |
| `ai_credits` | integer | Remaining AI credits (deducted per operation) |
| `ai_credits_limit` | integer | Monthly ceiling (refills on billing cycle) |
| `ai_credits_reset_date` | timestamp | When credits last reset |

### `saved_designs`

Stores canvas designs per user.

| Column | Type | Purpose |
|---|---|---|
| `id` | varchar(36) PK | UUID |
| `user_id` | varchar(255) | Owner (Clerk user ID) |
| `name` | varchar(255) | Display name |
| `description` | text | Optional description |
| `canvas_width/height` | integer | Canvas dimensions in px |
| `page_count` | integer | Number of pages |
| `background_color` | varchar(50) | Canvas background hex |
| `elements` | jsonb | Array of `CanvasElement` objects |
| `type` | varchar(20) | `"single"` or `"catalog"` |
| `catalog_data` | jsonb | Catalog-specific configuration |

### `templates`

Admin-created shared design templates (visible to all users). Same structure as `saved_designs` but without `user_id`. Created/edited/deleted by admin only.

### `export_jobs`

Tracks async PDF export jobs so clients can poll for completion.

| Column | Type | Purpose |
|---|---|---|
| `id` | varchar(36) PK | UUID, also used as cache key |
| `user_id` | varchar(255) | Owner |
| `type` | varchar(50) | `"pdf_single"`, `"pdf_bulk"`, `"pdf_catalog"` |
| `status` | varchar(20) | `"pending"`, `"completed"`, `"failed"` |
| `progress` | integer | 0–100 |
| `display_filename` | text | Filename shown to user |
| `file_name` | text | Internal filename |
| `result_url` | text | Legacy field (unused) |
| `error` | text | Error message if failed |

### `qr_codes`

Trackable short-redirect QR codes. Accessible at `/q/:id`.

| Column | Type | Purpose |
|---|---|---|
| `id` | varchar(12) PK | Short random ID |
| `user_id` | varchar(255) | Owner |
| `design_id` | varchar(36) | Associated design (optional) |
| `destination_url` | text | Where the QR redirects |
| `scan_count` | integer | Total scans |

### `product_knowledge`

AI-generated content cache. Saves enriched/standardized field values per product key so Scale plan users don't re-spend credits on the same products.

| Column | Type | Purpose |
|---|---|---|
| `id` | varchar(36) PK | UUID |
| `user_id` | varchar(255) | Owner |
| `key_name` | varchar(255) | Column name acting as the product key (e.g. "SKU") |
| `product_key` | varchar(255) | The actual key value (e.g. "ABC-123") |
| `field_type` | varchar(50) | Content type (e.g. "marketing", "standardize") |
| `content` | text | The saved AI-generated content |

Unique constraint on `(user_id, product_key, field_type)` — upsert on repeat enrichment.

### `ai_logs`

Full audit log of every Gemini API call.

| Column | Type | Purpose |
|---|---|---|
| `user_id` | varchar(255) | Who called it |
| `request_type` | varchar(50) | `"enrich"`, `"standardize"`, `"map"` |
| `prompt_content` | text | Full prompt sent |
| `generated_response` | text | Full response received |
| `token_cost` | integer | Internal credits charged |
| `prompt_tokens` | integer | Actual Gemini prompt tokens used |
| `completion_tokens` | integer | Actual Gemini completion tokens used |

---

## 4. Authentication & User Lifecycle

### Clerk Configuration

Two Clerk instances are used:
- **Development**: keys prefixed with `_DEV` (`CLERK_SECRET_KEY_DEV`, `VITE_CLERK_PUBLISHABLE_KEY_DEV`)
- **Production**: base keys (`CLERK_SECRET_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`)

The server reads `NODE_ENV` at startup to decide which key to use. The frontend uses `VITE_CLERK_PUBLISHABLE_KEY_DEV` in development via `vite.config.ts`.

### User Sync Flow

Every time a signed-in user loads the app, `App.tsx` calls `POST /api/users/sync`:

1. Clerk verifies the JWT.
2. If the user doesn't exist in the DB yet, Clerk is queried for their email.
3. **Anti-abuse checks**: the normalized email and device fingerprint are checked against existing users and Stripe customers. If a match is found (possible trial abuse), the new account receives 0 AI credits instead of 5,000.
4. The user record is created or returned.

### Admin Access

Any route calling `checkAdmin(userId)` (in `server/middleware/auth.ts`) compares the user's Clerk ID against the `ADMIN_EMAIL` environment variable. Admins can create/edit/delete templates.

---

## 5. Subscription & Payments (Stripe)

### Plans

| Plan | AI Credits/Month | Features |
|---|---|---|
| Free | 5,000 | Basic export, limited designs |
| Pro | 100,000 | QR codes, priority export |
| Scale | 1,000,000 | AI knowledge base, bulk enrichment |

Actual price IDs and product names are configured in the **Stripe Dashboard**. The app fetches them live from `GET /api/plans` — no hardcoded prices.

### Checkout Flow (Register-First)

```
/pricing → select plan
  → /registration?plan=X&priceId=Y  (Clerk signup)
  → /checkout  (after auth)
  → Stripe Checkout (hosted page)
  → /checkout/success?session_id=...
  → Webhook: checkout.session.completed → DB updated
```

1. User picks a plan on `/pricing`.
2. URL params carry `plan` and `priceId` into the registration page.
3. After signing up, the `/checkout` page calls `POST /api/checkout`, which:
   - Ensures the user has a Stripe Customer ID (creates one if not).
   - Creates a Stripe Checkout Session for the chosen `priceId`.
   - Returns the Stripe-hosted checkout URL.
4. The browser redirects to Stripe's hosted page.
5. After payment, Stripe redirects to `/checkout/success`.
6. Stripe fires a webhook to `POST /api/stripe/webhook`.

### Stripe Webhook Events Handled

| Event | Action |
|---|---|
| `checkout.session.completed` | Retrieves subscription, reads `planId` from product metadata, updates user's plan and credits in DB |
| `customer.subscription.created` / `updated` | Updates plan name, status, and credit limit |
| `customer.subscription.deleted` | Reverts user to free plan, reduces credits to free tier |
| `invoice.payment_succeeded` | Refills AI credits to plan limit (monthly reset) |
| `invoice.payment_failed` | Sets `plan_status = "past_due"` |

### Customer Portal

`POST /api/customer-portal` creates a Stripe Customer Portal session. Users are redirected there to manage their subscription (cancel, upgrade, update payment method). After completing, Stripe redirects back to `/editor`.

### Key Selection (Dev vs. Prod)

`server/stripeClient.ts` always reads `STRIPE_SECRET_KEY`. In the Replit environment, you set the appropriate key for your environment. The `_DEV` variants (`STRIPE_SECRET_KEY_DEV`, `VITE_STRIPE_PUBLISHABLE_KEY_DEV`) are available for development testing with Stripe's test mode.

---

## 6. The Editor (Canvas)

The editor is the core of the application, living at `/editor`. It is protected — unauthenticated users are redirected to `/login`.

### State Management

All canvas state lives in `client/src/stores/canvas-store.ts` (Zustand). Key state:

- `elements[]` — all canvas elements
- `selectedElementIds[]` — current selection
- `canvasSize` — width/height in pixels
- `zoom` — current zoom level (25%–200%)
- `showGrid`, `snapToGrid` — grid options
- `excelData` — uploaded spreadsheet data
- `currentRowIndex` — which data row is being previewed
- `history[]` / `historyIndex` — undo/redo stack

### Canvas Element Types

Every element on the canvas is a `CanvasElement` object with a `type` field:

| Type | Description |
|---|---|
| `text` | Static text block with full typography controls |
| `shape` | Rectangle, circle, or line with fill/stroke/opacity |
| `image` | Image from URL or uploaded file (via Object Storage) |
| `dataField` | Bound to an Excel column — renders the value for the current row |
| `table` | Multi-column data grid bound to Excel, supports grouping |
| `qrcode` | Renders a QR code from a stored `qrCodeId` |
| `toc-list` | Table of Contents for catalog designs |

### Element Properties

Every element shares base properties:
- `position` (x, y) — top-left corner in px
- `dimension` (width, height) — in px
- `rotation` — degrees
- `zIndex` — layering order
- `locked` — prevents selection/movement
- `visible` — show/hide toggle

Type-specific properties:
- `textStyle` — font family, size, weight, color, alignment, line height, letter spacing
- `shapeStyle` — fill color, stroke color, stroke width, border radius, opacity
- `shapeType` — `"rectangle"`, `"circle"`, `"line"`
- `dataBinding` — Excel column header name (for `dataField`)
- `format` — data formatting rules (number, date, casing, units, etc.)
- `tableSettings` — columns, grouping, header/row styles, colors, borders
- `tocSettings` — title, grouping field, chapter style, leader style
- `imageSrc` — URL or `/objects/` path
- `isImageField` — if true, the `dataField` is treated as an image URL
- `qrCodeId` — links to a `qr_codes` record

### Panels

The editor UI is split into three zones:

**Left Panel** — Tool palette:
- Select tool, Text tool, Shape tools (rectangle, circle, line), Image tool, Data Field tool, Table tool, QR Code tool, TOC tool

**Canvas** — Main editing area with:
- Drag-to-move elements
- Resize handles (8-point)
- Snap-to-grid (10px default)
- Multi-select (Shift+click, Ctrl+A)
- Keyboard shortcuts: Delete, Ctrl+Z (undo), Ctrl+Y (redo), Ctrl+C/V (copy/paste), arrow keys (nudge)

**Right Panel** — Four tabs:
- **Properties** — Edit selected element(s): position, size, text style, shape style, data formatting
- **Data** — Upload Excel/CSV, browse rows, drag column headers onto canvas
- **Export** — Configure and trigger PDF export
- **Designs** — Save, load, and delete named designs

### Page Sizes

| Name | Width (px) | Height (px) |
|---|---|---|
| Letter | 816 | 1056 |
| A4 | 794 | 1123 |
| Legal | 816 | 1344 |

At 96dpi, 816px = 8.5 inches (standard US Letter).

---

## 7. Excel / Data Integration

### Supported Formats

`.xlsx`, `.xls`, `.csv` — parsed client-side by the `xlsx` library (`client/src/lib/excel-parser.ts`). No file is uploaded to the server for parsing.

### How Data Binding Works

1. User uploads a file in the **Data tab**.
2. The parser extracts column headers and all rows as `Record<string, string>`.
3. Headers appear as draggable chips in the Data tab.
4. Dragging a header onto the canvas creates a `dataField` element with `dataBinding = headerName`.
5. When the canvas renders (for preview or export), each `dataField` looks up `excelData.rows[currentRowIndex][dataBinding]` and renders that value.
6. The `format` object on the element controls how the value is displayed (number formatting, date formats, text casing, units, etc.).

### Image Fields

If a column contains image URLs (or Object Storage paths), the user can mark the `dataField` as `isImageField = true`. On export, the element renders as an `<img>` tag instead of text.

### Row Navigation

The Data tab has prev/next buttons and a row counter. Changing `currentRowIndex` in the Zustand store causes the canvas to re-render with new values.

---

## 8. AI Features

All AI routes are under `/api/ai` and require authentication. They all use **Google Gemini 2.5 Flash Lite** with `temperature: 0` for deterministic output and `responseMimeType: "application/json"` for structured responses.

### Credit System

AI credits are an internal currency:
- Free plan: 5,000 credits (non-refilling)
- Pro plan: 100,000 credits/month (refilled on each invoice payment)
- Scale plan: 1,000,000 credits/month

Credits are deducted **before** the Gemini call via `checkAndDeductAiCredits()`. If insufficient, the request returns `403 Insufficient AI Credits`.

### `POST /api/ai/enrich-data`

Generates marketing copy, technical descriptions, or custom text for each row in a dataset.

- **Input**: `rows[]` (data objects), `config` (enrichment type + tone), `anchorColumn` (product key column), `customFieldName`
- **Cost**: 100 credits × number of rows (max 50 rows per call)
- **Process**: Batches all rows in a single Gemini prompt with strict instructions to treat each row independently. Retries up to 3× on rate limits.
- **Knowledge Base**: For Scale users, results are saved to `product_knowledge` table keyed by `anchorColumn` value, so the same product won't need re-enrichment in future sessions.
- **Output**: Array of generated strings, one per row.

### `POST /api/ai/standardize`

Normalizes column values to a consistent format (e.g., unit standardization, casing, removing extra text).

- **Input**: `values[]`, `config` or `instruction`, `keys[]`, `keyName`, `fieldName`
- **Cost**: 25 credits × number of values (max 1,000)
- **Knowledge Base**: Same auto-save as enrich for Scale users.
- **Output**: Array of standardized strings.

### `POST /api/ai/map-fields`

Intelligently maps source Excel column headers to canvas data field names.

- **Input**: `sourceHeaders[]`, `targetVariables[]`
- **No credit cost** (lightweight utility)
- **Output**: Array of `{source, target, confidence}` match objects.

### `POST /api/ai/analyze-layout`

Analyzes a screenshot of an existing document (PDF page rendered as an image) to detect images, tables, and text regions for auto-layout reconstruction.

- **Input**: `image` (base64 data URL of a page screenshot)
- **No credit cost**
- **Output**: `{images: [{box_2d, label}], tables: [{box_2d, rows, cols}], text_regions: [{box_2d, type, content}]}`
- `box_2d` is `[ymin, xmin, ymax, xmax]` in 0–1000 scale.

### `GET/POST/PUT/DELETE /api/ai/knowledge`

CRUD operations on the `product_knowledge` table. Only the owner can access their own entries. Scale plan required to write; any authenticated user can read their own.

---

## 9. PDF Export Pipeline

### Why a Queue?

Rendering a PDF requires launching a headless Chromium process. Doing this inline (inside the HTTP request handler) causes two problems at scale:

1. **OOM crashes** — if several users export at the same time, multiple Chromium instances start simultaneously and exhaust available RAM.
2. **Request timeouts** — large catalogs can take 30–90 seconds to render, far beyond a typical HTTP timeout.

The solution is a **BullMQ job queue backed by Upstash Redis**. Export routes now enqueue a job and return a `jobId` immediately. A dedicated worker picks up jobs one at a time (`concurrency: 1`), so only a single Chromium process ever runs regardless of how many users export simultaneously.

### Architecture

```
Client → POST /api/export/async/pdf
              │
              ├─ Create export_jobs row (status: "pending")
              └─ pdfQueue.add("render", jobData)  ──→  Upstash Redis
                                                              │
                                                   BullMQ worker picks up job
                                                   (concurrency: 1 — one at a time)
                                                              │
                                                   Puppeteer renders HTML → Buffer
                                                              │
                                                   exportCache.set(jobId, buffer)
                                                   (in-memory Map, 1-hour TTL)
                                                              │
                                                   export_jobs row updated
                                                   (status: "completed")

Client → polls GET /api/jobs/:id  →  { status: "completed", downloadUrl }
Client → GET /api/export/download/:id  →  buffer streamed  →  file saved
                                          buffer deleted from cache
```

### Key Files

| File | Purpose |
|---|---|
| `server/queue/pdfQueue.ts` | Defines the BullMQ `Queue` and the `redisConnection` config (TLS via `rediss://` URL). Also exports the `PdfJobData` type used by both the route and the worker. |
| `server/queue/pdfWorker.ts` | Defines the BullMQ `Worker` (`concurrency: 1`). On job pickup, calls the appropriate renderer (`renderHtmlToPdf` or `renderHtmlsToBulkZip`), saves the buffer to the in-memory cache, and updates the DB job record. On failure, marks the job as `"failed"` and re-throws so BullMQ handles the retry. |
| `server/routes/export.ts` | Thin Express routes. Creates the DB record, adds the job to `pdfQueue`, and returns `{ jobId }`. No rendering happens here. |
| `server/utils/pdfRenderer.ts` | The actual Puppeteer/Chromium rendering logic. Called only from the worker. |
| `server/utils/exportStorage.ts` | In-memory `Map<jobId, Buffer>` cache with 1-hour TTL and a 15-minute cleanup interval. |

### Queue Configuration

```
Queue name:   pdf-export
Concurrency:  1  (never more than one Chromium at a time)
Retries:      2 attempts, 3-second fixed backoff
Retention:    last 50 completed + last 50 failed job records kept in Redis
```

### Redis Connection (Upstash)

BullMQ uses **ioredis** under the hood. The connection is configured via `REDIS_URL`, which must use the `rediss://` scheme (double-s) to enable TLS — required by Upstash:

```
rediss://default:<password>@<host>.upstash.io:6379
```

Two ioredis options are set specifically for Upstash compatibility:
- `maxRetriesPerRequest: null` — required by BullMQ (prevents ioredis from timing out waiting for a response)
- `enableReadyCheck: false` — prevents connection errors on Upstash's serverless Redis

### Export Types

| Type | Input | Output | Route |
|---|---|---|---|
| `pdf_single` | One HTML string | Single PDF | `POST /api/export/async/pdf` |
| `pdf_catalog` | Array of HTML items | ZIP of PDFs | `POST /api/export/async/pdf` (with `items[]`) |
| `pdf_bulk` | Array of HTML items (one per data row) | ZIP of PDFs | `POST /api/export/async/bulk` |

### Rendering (`server/utils/pdfRenderer.ts`)

**Single PDF**: `renderHtmlToPdf(html, options)`
1. Kills any stale Chromium processes (`pkill -f chromium`).
2. Launches Chromium with `puppeteer-core` using the system Chromium binary found via `which chromium`.
3. Opens a new page, sets viewport to canvas dimensions, loads HTML via `page.setContent()` with `waitUntil: "domcontentloaded"`.
4. Waits 500ms for fonts/images to render.
5. Calls `page.pdf()` with exact pixel dimensions and `printBackground: true`.
6. Closes browser, returns `Buffer`.

**Bulk/Catalog ZIP**: `renderHtmlsToBulkZip(htmlItems, options)`
1. Launches one Chromium instance.
2. Loops through all items, opening and closing a new page per item.
3. Collects all PDF buffers.
4. Uses `JSZip` to build the ZIP in memory.
5. Closes browser, returns ZIP `Buffer`.

### In-Memory Cache (`server/utils/exportStorage.ts`)

After rendering, the buffer is stored in a `Map<jobId, CachedExport>` with a 1-hour TTL. A cleanup interval runs every 15 minutes to evict expired entries.

On download (`GET /api/export/download/:id`):
1. Verifies auth and job ownership.
2. Retrieves buffer from cache.
3. If cache miss (server restarted or >1h elapsed), returns `410 Gone` — user must re-export.
4. Streams buffer with `Content-Disposition: attachment`.
5. Deletes buffer from cache immediately after serving (frees RAM).

### Startup Cleanup

On every server start, `storage.failStaleExportJobs()` marks all `status = "pending"` DB job records as `"failed"`. This handles the case where the server restarted while a render was in progress — those jobs will never complete and clients would poll forever without this cleanup.

### Worker Lifecycle

The worker is started by `startPdfWorker()` in `server/index.ts` during the boot sequence. On `SIGTERM` or `SIGINT`, `stopPdfWorker()` is called before the HTTP server closes, allowing any in-progress render to finish before the process exits.

### Client-Side Polling (`ExportTab.tsx`)

1. After starting an export, the client polls `GET /api/jobs/:id` every 3 seconds.
2. 5-minute client-side timeout — if the job hasn't completed in 5 minutes, polling stops with an error message.
3. On `status = "completed"`, `triggerDownload()` creates a temporary `<a>` element and clicks it to download the file.

### Chromium Launch Flags

```
--no-sandbox
--disable-setuid-sandbox
--disable-dev-shm-usage
--disable-gpu
--disable-extensions
--no-zygote
--disable-web-security
--font-render-hinting=none
```

These are required for headless Chrome in a Linux container environment without a display server.

---

## 10. QR Codes

QR codes are **Pro plan** features. Each QR code is a short-URL redirect:

1. User creates a QR code via `POST /api/qrcodes` with a destination URL.
2. The DB stores the QR code with a random 12-character ID.
3. The canvas `qrcode` element references this ID.
4. On export, the element renders a QR code image pointing to `https://yourdomain.com/q/{id}`.
5. When someone scans the code, `GET /q/:id` does a 302 redirect to `destinationUrl`.
6. Each scan increments `scan_count`.

Users can update the destination URL at any time without regenerating the QR code image — the short URL stays the same.

---

## 11. Object Storage (User Uploads)

Used for user-uploaded images placed on the canvas. **Not** used for export files.

### Upload Flow

1. Client calls `POST /api/objects/upload` → server calls Replit Object Storage sidecar to get a signed PUT URL.
2. Client uploads the file directly to the signed URL (PUT to `PRIVATE_OBJECT_DIR/uploads/{uuid}`).
3. Client calls `PUT /api/objects/uploaded` with the GCS URL → server normalizes it to `/objects/{uuid}` path.
4. The `/objects/` path is stored in the canvas element's `imageSrc`.

### Serving Files

- `GET /objects/:path` — serves private user files (no auth required currently; path obscurity provides access control).
- `GET /public-objects/:path` — serves files from `PUBLIC_OBJECT_SEARCH_PATHS`.

---

## 12. Templates

Templates are admin-created shared canvas designs. They are:
- Stored in the `templates` table (no `user_id`).
- Readable by all users (`GET /api/templates`).
- Writable only by the admin (`POST`, `PUT`, `DELETE /api/templates/:id` — requires `ADMIN_EMAIL` match).

When a user loads a template in the editor, the template's elements are copied into their canvas state (not linked — changes don't affect the template).

---

## 13. API Reference

### Commerce Routes (`/api`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/plans` | None | List active Stripe prices |
| GET | `/api/stripe/config` | None | Get Stripe publishable key |
| GET | `/api/subscription` | Required | Get current user's plan and credits |
| POST | `/api/checkout` | Required | Create Stripe checkout session |
| POST | `/api/customer-portal` | Required | Create Stripe customer portal session |
| POST | `/api/users/sync` | Required | Sync/create user record from Clerk |
| POST | `/api/stripe/webhook` | Stripe sig | Stripe webhook receiver |

### Asset Routes (`/api`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/templates` | None | List all templates |
| GET | `/api/templates/:id` | None | Get a single template |
| POST | `/api/templates` | Admin | Create a template |
| PUT | `/api/templates/:id` | Admin | Update a template |
| DELETE | `/api/templates/:id` | Admin | Delete a template |
| GET | `/api/designs` | Required | List user's saved designs |
| GET | `/api/designs/:id` | Required | Get a specific design |
| POST | `/api/designs` | Required | Save current design |
| PUT | `/api/designs/:id` | Required | Update a design |
| DELETE | `/api/designs/:id` | Required | Delete a design |
| GET | `/api/qrcodes` | Required | List user's QR codes |
| POST | `/api/qrcodes` | Pro+ | Create a QR code |
| PUT | `/api/qrcodes/:id` | Required | Update QR destination URL |
| POST | `/api/objects/upload` | Required | Get signed upload URL |
| PUT | `/api/objects/uploaded` | Required | Normalize uploaded file path |

### Export Routes (`/api/export`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/export/async/pdf` | Required | Start single or catalog export job |
| POST | `/api/export/async/bulk` | Required | Start bulk (one PDF per row) export job |
| GET | `/api/export/download/:id` | Required | Download completed export file |
| GET | `/api/export/history` | Required | Get user's export history |

### Job Routes (`/api/jobs`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/jobs/:id` | Required | Poll export job status |

### AI Routes (`/api/ai`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/ai/enrich-data` | Required | AI data enrichment |
| POST | `/api/ai/standardize` | Required | AI value standardization |
| POST | `/api/ai/map-fields` | Required | AI column mapping |
| POST | `/api/ai/analyze-layout` | Required | AI document layout analysis |
| GET | `/api/ai/knowledge` | Required | List product knowledge entries |
| POST | `/api/ai/knowledge/check` | Scale | Check existing knowledge matches |
| PUT | `/api/ai/knowledge/:id` | Required | Update knowledge entry |
| DELETE | `/api/ai/knowledge/:id` | Required | Delete knowledge entry |

### System Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | None | Health check (DB + Stripe status) |
| GET | `/q/:id` | None | QR code redirect |
| GET | `/public-objects/*` | None | Serve public object storage files |
| GET | `/objects/*` | None | Serve private object storage files |

---

## 14. Frontend Routes & Pages

| Path | Component | Access | Description |
|---|---|---|---|
| `/` | `Homepage` | Public | Marketing landing page |
| `/solutions` | `Solutions` | Public | Use-case / solutions page |
| `/features` | `Features` | Public | Feature breakdown page |
| `/pricing` | `Pricing` | Public | Plan comparison + checkout trigger |
| `/demo` | `Demo` | Public | Interactive demo or video |
| `/templates` | `TemplateLibrary` | Public | Browse available templates |
| `/privacy` | `Privacy` | Public | Privacy policy |
| `/terms` | `Terms` | Public | Terms of service |
| `/login` | `Login` | Public | Clerk sign-in UI |
| `/registration` | `Registration` | Public | Clerk sign-up UI (receives `plan`, `priceId` params) |
| `/checkout` | `Checkout` | Auth | Creates Stripe session, redirects to Stripe |
| `/checkout/success` | `CheckoutSuccess` | Auth | Post-payment confirmation page |
| `/editor` | `Editor` | **Auth required** | The main canvas editor |
| `*` | `NotFound` | Public | 404 page |

### Persistent UI Elements

- **SupportWidget** — Floating support button visible on all pages.
- **CookieBanner** — GDPR cookie consent banner. Accept/decline does not reload the page.

---

## 15. Environment Variables (Secrets)

### Required in All Environments

| Variable | Where Used | Purpose |
|---|---|---|
| `DATABASE_URL` | `server/storage.ts` | Neon PostgreSQL connection string. If missing in production, the server throws a fatal error on startup. Used for all data persistence. |
| `CLERK_SECRET_KEY` | `server/index.ts`, `server/routes/commerce.ts` | Clerk backend secret key for production. Used to verify JWTs and look up users via the Clerk API. |
| `VITE_CLERK_PUBLISHABLE_KEY` | `client/src/main.tsx` | Clerk frontend publishable key for production. Used to initialize the Clerk React SDK and display sign-in/sign-up UI. |
| `STRIPE_SECRET_KEY` | `server/stripeClient.ts` | Stripe secret key (live mode for production). Used for all Stripe API calls: creating customers, checkout sessions, retrieving subscriptions, and customer portal sessions. |
| `VITE_STRIPE_PUBLISHABLE_KEY` | `client/src/pages/Checkout.tsx` | Stripe publishable key (live mode). Used client-side to initialize Stripe.js. |
| `STRIPE_WEBHOOK_SECRET` | `server/webhookHandlers.ts` | Stripe webhook signing secret. Used to verify that webhook events actually came from Stripe (prevents spoofed events). Must match the secret shown in the Stripe Dashboard for the registered webhook endpoint. |

### Development-Only Keys

Used in `NODE_ENV=development` to sandbox testing away from live data. The code falls back to the production key if the `_DEV` variant is absent.

| Variable | Purpose |
|---|---|
| `CLERK_SECRET_KEY_DEV` | Clerk backend key for the development Clerk instance. Prevents dev users from appearing in the production Clerk dashboard. |
| `VITE_CLERK_PUBLISHABLE_KEY_DEV` | Clerk frontend key for the development Clerk instance. Must match `CLERK_SECRET_KEY_DEV`. |
| `STRIPE_SECRET_KEY_DEV` | Stripe secret key for Stripe test mode. Allows testing payment flows without real charges. |
| `VITE_STRIPE_PUBLISHABLE_KEY_DEV` | Stripe publishable key for test mode. Must match `STRIPE_SECRET_KEY_DEV`. |
| `STRIPE_WEBHOOK_SECRET_DEV` | Webhook signing secret for Stripe test mode webhooks (used with Stripe CLI local forwarding). |

### AI

| Variable | Where Used | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | `server/routes/ai.ts` | Google Gemini API key. Required for all AI features (enrichment, standardization, field mapping, layout analysis). If missing, AI routes will accept requests but fail at call time. |

### Object Storage (Auto-Set by Replit)

These are set automatically when you provision Object Storage from the Replit Object Storage panel. Do not set them manually.

| Variable | Purpose |
|---|---|
| `DEFAULT_OBJECT_STORAGE_BUCKET_ID` | The GCS bucket ID for this Replit's object storage. |
| `PUBLIC_OBJECT_SEARCH_PATHS` | Comma-separated paths for publicly accessible files (e.g., `/bucket-id/public`). Used by `GET /public-objects/*`. |
| `PRIVATE_OBJECT_DIR` | The private directory path (e.g., `/bucket-id/.private`). Used to construct upload URLs for user file uploads. |

### Job Queue (Redis)

| Variable | Where Used | Purpose |
|---|---|---|
| `REDIS_URL` | `server/queue/pdfQueue.ts` | Upstash Redis connection string. Must use the `rediss://` scheme (double-s) for TLS. Obtain from the Upstash dashboard under **Connect → ioredis**. If missing, the PDF worker does not start and all export jobs will remain pending indefinitely. |

### Admin & App Config

| Variable | Where Used | Purpose |
|---|---|---|
| `ADMIN_EMAIL` | `server/routes/commerce.ts`, `server/middleware/auth.ts` | Email address of the admin user. Routes protected by `checkAdmin()` (template CRUD) compare the requesting user's Clerk email against this value. Also exempts the admin from anti-abuse checks during user sync. |

### Error Tracking (Optional)

| Variable | Purpose |
|---|---|
| `VITE_SENTRY_DSN` | Sentry Data Source Name for frontend error tracking. If missing, Sentry is not initialized on the client. |
| `SENTRY_DSN` | Sentry DSN for server-side error tracking. If missing, Sentry Express integration is skipped. |

### Summary Table

| Variable | Required in Prod | Required in Dev |
|---|---|---|
| `DATABASE_URL` | ✅ Fatal if missing | ✅ |
| `CLERK_SECRET_KEY` | ✅ | Fallback if no `_DEV` |
| `CLERK_SECRET_KEY_DEV` | — | ✅ |
| `VITE_CLERK_PUBLISHABLE_KEY` | ✅ | Fallback if no `_DEV` |
| `VITE_CLERK_PUBLISHABLE_KEY_DEV` | — | ✅ |
| `STRIPE_SECRET_KEY` | ✅ | Fallback if no `_DEV` |
| `STRIPE_SECRET_KEY_DEV` | — | ✅ |
| `VITE_STRIPE_PUBLISHABLE_KEY` | ✅ | Fallback if no `_DEV` |
| `VITE_STRIPE_PUBLISHABLE_KEY_DEV` | — | ✅ |
| `STRIPE_WEBHOOK_SECRET` | ✅ | Fallback if no `_DEV` |
| `STRIPE_WEBHOOK_SECRET_DEV` | — | ✅ (Stripe CLI) |
| `GEMINI_API_KEY` | ✅ (AI features) | ✅ |
| `REDIS_URL` | ✅ (PDF export) | ✅ |
| `ADMIN_EMAIL` | ✅ | ✅ |
| `DEFAULT_OBJECT_STORAGE_BUCKET_ID` | Auto (Replit) | Auto (Replit) |
| `PUBLIC_OBJECT_SEARCH_PATHS` | Auto (Replit) | Auto (Replit) |
| `PRIVATE_OBJECT_DIR` | Auto (Replit) | Auto (Replit) |
| `VITE_SENTRY_DSN` | Optional | Optional |
| `SENTRY_DSN` | Optional | Optional |

---

## 16. Server Startup & Monitoring

### Startup Sequence (`server/index.ts`)

1. Configure Clerk middleware (`clerkMiddleware()`).
2. Initialize Sentry.
3. Parse raw body for Stripe webhooks (must happen before `express.json()`).
4. Mount `express.json()` and `express.urlencoded()`.
5. Add request logging middleware (Pino).
6. Run parallel system checks:
   - **Database**: attempts a probe query; throws if `DATABASE_URL` is missing in production.
   - **Ghostscript**: checks if `gs` binary is available (used for CMYK-safe PDF processing).
7. **Stale job cleanup**: marks all `status = "pending"` export jobs as `"failed"` (handles mid-render server restarts).
8. **Start PDF worker** (`startPdfWorker()`): connects to Upstash Redis via `REDIS_URL` and begins listening for jobs on the `pdf-export` queue.
9. Register all API routes.
10. Mount Sentry error handler.
11. Start HTTP server on port 5000.
12. Register `SIGTERM`/`SIGINT` handlers: on shutdown signal, `stopPdfWorker()` is called to drain the worker (lets any in-progress render finish), then the HTTP server is closed. A 10-second hard timeout forces exit if something hangs.

### Logging

All server files import from `server/utils/logger.ts` (Pino). Logs are structured JSON with colorized pretty-printing in development. Long base64 strings in response bodies are truncated via `sanitizeData()` to keep logs readable.

### Health Check

`GET /health` returns:
```json
{
  "uptime": 123.4,
  "timestamp": 1700000000000,
  "status": "OK",
  "checks": {
    "database": "connected",
    "stripe": "configured"
  }
}
```
Returns `503` if the database check fails.
