# PDF Worker v2 — Deployment Guide

This replaces the old Cloud Run worker (`pdf-worker-597705611716.us-central1.run.app`)
with a version that has **zero Google Cloud Storage dependency**.
HTML is received inline; the finished PDF/ZIP is POSTed back to the app.

## What changed from v1

| v1 (old) | v2 (new) |
|---|---|
| Read HTML from GCS bucket `doculoom-exports/inputs/` | Receives HTML inline in the request body |
| Write PDF to GCS bucket `doculoom-exports/exports/` | POSTs PDF binary to the app's callback URL |
| Required `GCLOUD_KEY_JSON` service account | No GCS credentials needed |

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Port to listen on (default: 8080) |
| `PUPPETEER_EXECUTABLE_PATH` | No | Override Chromium path (auto-detected on Cloud Run) |

The worker has **no secrets** of its own. Authentication to the app is handled by
`WORKER_SECRET` — a shared secret you set in **both** places:
- Set `WORKER_SECRET` in the Replit app's secrets
- Pass it in `workerSecret` field of the `/process-job` request (the app does this automatically)

---

## Build & deploy to Cloud Run

```bash
cd pdf-worker

# Install deps and compile
npm install
npm run build

# Build and push the Docker image
gcloud builds submit --tag gcr.io/YOUR_PROJECT/doculoom-pdf-worker

# Deploy (replace YOUR_PROJECT and YOUR_REGION)
gcloud run deploy doculoom-pdf-worker \
  --image gcr.io/YOUR_PROJECT/doculoom-pdf-worker \
  --platform managed \
  --region YOUR_REGION \
  --memory 2Gi \
  --cpu 2 \
  --concurrency 4 \
  --timeout 300 \
  --allow-unauthenticated
```

Once deployed, copy the service URL and update `PDF_WORKER_URL` in the Replit app's secrets.

---

## Alternative: deploy anywhere (Fly.io, Railway, Render, etc.)

Because the worker has no GCS dependency, it runs on any platform that supports Docker.
All that's required is:
- 2 GB RAM minimum (Puppeteer/Chromium)
- Outbound HTTP to your Replit app's domain
- `PORT` environment variable (most platforms set this automatically)

---

## API reference

### `POST /process-job`

Trigger an async PDF render. The worker responds immediately with `{ jobId, status: "processing" }`
and POSTs the result to `callbackUrl` when done.

**Request body (JSON):**
```json
{
  "jobId": "abc123",
  "callbackUrl": "https://your-app.replit.app/api/export/worker/complete",
  "workerSecret": "your-shared-secret",
  "data": {
    "type": "pdf_single | pdf_catalog | pdf_bulk",
    "html": "<html>...</html>",
    "items": ["<html>page 1</html>", "<html>page 2</html>"],
    "htmlItems": ["<html>item 1</html>"],
    "width": 816,
    "height": 1056,
    "scale": 1,
    "colorModel": "rgb",
    "fileName": "export.pdf"
  }
}
```

- For `pdf_single`: use `html` (single string)
- For `pdf_catalog`: use `items` (array of HTML chunks, delivered as a merged PDF or ZIP)
- For `pdf_bulk`: use `htmlItems` (array, each becomes its own PDF inside a ZIP)

**Callback (POSTed to `callbackUrl`):**
```
Headers:
  X-Job-Id: abc123
  X-Job-Type: pdf_single
  X-File-Name: export.pdf
  X-Worker-Secret: your-shared-secret
Body: raw PDF binary
```

On failure, the callback is called with `X-Job-Error` header instead of a binary body.

---

### `POST /preview`

Synchronous screenshot (unchanged from v1).

**Request:** `{ html, width?, height? }`
**Response:** raw PNG binary
