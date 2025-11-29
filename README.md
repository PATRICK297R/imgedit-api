# Img-Edit Vercel API
This project provides an API route `/api/edit-img` suitable for deployment on Vercel.

## Features
- Accepts JSON POST `{ "image_url": "...", "prompt": "..." }`
- Header `x-api-key` required and must match one of `PREMIUM_KEYS` (env)
- Validates prompt (alphabet + spaces) and checks forbidden words
- Downloads image at `image_url`, sends to Google Generative AI (Gemini) and returns the result image as base64 in JSON
- Works on Vercel (serverless) — no local file storage required

## Deploy
1. Install Vercel CLI (for local testing): `npm i -g vercel`
2. Set env vars in Vercel dashboard:
   - PREMIUM_KEYS (comma separated)
   - GEMINI_API_KEY
   - BASE_URL (optional)
3. Deploy: `vercel`

## Example request
```
curl -X POST "https://<your-vercel-url>/api/edit-img" \
  -H "Content-Type: application/json" \
  -H "x-api-key: demo-premium-key-1" \
  -d '{"image_url":"https://example.com/cat.jpg","prompt":"happy cat"}'
```

Response on success:
```json
{
  "ok": true,
  "image_base64": "<base64string>",
  "mime": "image/jpeg"
}
```

## Notes
- This project expects `@google/generative-ai` usage similar to your code snippet. Make sure the SDK version and authentication match the official docs.
- If you want public URLs for images, integrate with external storage (S3/R2/Supabase/Vercel Blob) — I can add that if you want.
