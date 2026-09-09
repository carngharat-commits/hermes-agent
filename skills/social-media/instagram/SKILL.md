---
name: instagram
description: "Publish photo/carousel posts to Instagram via the Meta Graph API's Content Publishing endpoints, with a mandatory human-approval step before anything goes live."
version: 1.0.0
author: Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [Instagram, Meta, Social-Media, Graph-API]
    requires_toolsets: [terminal]
    related_skills: [xurl]
required_environment_variables:
  - name: INSTAGRAM_ACCESS_TOKEN
    prompt: "Enter your Instagram/Meta long-lived access token"
    help: "Generate it via the one-time setup below — paste it only into this prompt, never into a chat message"
    required_for: "Authenticating Graph API calls"
  - name: INSTAGRAM_BUSINESS_ACCOUNT_ID
    prompt: "Enter your Instagram Business Account ID (the numeric ig-user-id)"
    help: "Found via GET /me/accounts?fields=instagram_business_account during setup"
    required_for: "Selecting which Instagram account to publish to"
---

# Instagram — Content Publishing via the Meta Graph API

Publishes feed posts (single image or carousel) to an Instagram Professional
account using Meta's Graph API "Content Publishing" endpoints. This is a
**publish-only** integration — it cannot read DMs, comments, or your feed
beyond basic account/media metadata.

## Hard constraints of this API (know these before promising anything)

- The IG account must be a **Professional account** (Business or Creator)
  linked to a **Facebook Page**. Personal accounts cannot use this API at all.
- Every feed post needs an **image or video** — there is no text-only post.
  If the user only gives you text, you must produce or source an image first
  (e.g. the agent's own image-generation tool, or a simple text-card graphic).
- The image must sit at a **public HTTPS URL** at the moment you create the
  media container — Instagram fetches it from there. You cannot upload raw
  bytes directly. If you don't already have a public host for the image, say
  so and ask the user how they'd like to host it (their own site/CDN, or a
  quick upload to an image host they control).
- Captions: max 2,200 characters, up to 30 hashtags.
- Rate limit: 25 published posts per rolling 24h per IG user.
- A media container that's created but never published expires after ~24h.
- Access tokens expire. A long-lived token lasts ~60 days and must be
  refreshed; a Page access token generated from it typically does not expire
  as long as the user stays active on the app — see setup step 5.

## Secret Safety (MANDATORY)

- **Never** print, log, or echo `INSTAGRAM_ACCESS_TOKEN` to chat — not even
  partially. When showing a command you ran, redact the token
  (`access_token=***`).
- **Never** ask the user to paste the token or app secret into chat. All app
  creation, OAuth consent, and token generation happen in the user's own
  browser, outside the agent session.
- Store credentials only via the env var prompts above (persisted the same
  way as every other skill's secrets) — never write them into a file inside
  a repo, a script argument that gets logged, or shell history you show the
  user.
- To confirm credentials work without exposing them, call the account info
  endpoint (below) — its response never contains the token.

## One-Time User Setup (the user does this themselves, outside the agent)

1. Make sure the Instagram account is a **Professional account** (Instagram
   app → Settings → Account type → Switch to Professional Account → Business
   or Creator).
2. Link it to a **Facebook Page** (Instagram app → Settings → Linked accounts,
   or via Meta Business Suite → Settings → Accounts).
3. Create a Meta developer app at https://developers.facebook.com/apps
   (type: **Business**), then add the **Instagram Graph API** product to it.
4. Open the Graph API Explorer (https://developers.facebook.com/tools/explorer),
   select the app, and generate a **User Access Token** with these scopes:
   `instagram_basic`, `instagram_content_publish`, `pages_show_list`,
   `pages_read_engagement`, `business_management`.
5. Exchange it for a long-lived token (also done by the user, in their own
   terminal or the Explorer, not in this chat):
   ```
   GET https://graph.facebook.com/v21.0/oauth/access_token
       ?grant_type=fb_exchange_token
       &client_id={app-id}&client_secret={app-secret}
       &fb_exchange_token={short-lived-token}
   ```
6. Find the Instagram Business Account ID:
   ```
   GET https://graph.facebook.com/v21.0/me/accounts?fields=name,instagram_business_account{id,username}
   ```
   The `id` under `instagram_business_account` is `INSTAGRAM_BUSINESS_ACCOUNT_ID`.
7. Provide both values when this skill's env var prompts ask for them.
8. Long-lived user tokens expire in ~60 days — the user should redo step 5
   periodically (or use a system user + never-expiring token from Meta
   Business Suite if they want a permanent setup).

## Quick Reference

All calls use `${INSTAGRAM_ACCESS_TOKEN}` and `${INSTAGRAM_BUSINESS_ACCOUNT_ID}`
from the environment — never inline the literal token in a command you show
the user.

| Action | Call |
|---|---|
| Create image container | `POST /{ig-id}/media` with `image_url`, `caption` |
| Create carousel item | `POST /{ig-id}/media` with `image_url`, `is_carousel_item=true` |
| Create carousel container | `POST /{ig-id}/media` with `media_type=CAROUSEL`, `children=[...]`, `caption` |
| Check container status | `GET /{creation-id}?fields=status_code` |
| Publish | `POST /{ig-id}/media_publish` with `creation_id` |
| Account info | `GET /{ig-id}?fields=username,media_count` |
| Recent media | `GET /{ig-id}/media?fields=caption,permalink,timestamp` |
| Confirm a publish | `GET /{media-id}?fields=permalink,timestamp,caption` |

### Create the container (single image)

```bash
curl -s -X POST "https://graph.facebook.com/v21.0/${INSTAGRAM_BUSINESS_ACCOUNT_ID}/media" \
  -d "image_url=https://example.com/path/to/image.jpg" \
  -d "caption=$(cat caption.txt)" \
  -d "access_token=${INSTAGRAM_ACCESS_TOKEN}"
# -> {"id": "<creation-id>"}
```

### Publish (only after the user has approved the exact caption + image)

```bash
curl -s -X POST "https://graph.facebook.com/v21.0/${INSTAGRAM_BUSINESS_ACCOUNT_ID}/media_publish" \
  -d "creation_id=<creation-id>" \
  -d "access_token=${INSTAGRAM_ACCESS_TOKEN}"
# -> {"id": "<media-id>"}
```

## Publishing Workflow — approval is mandatory

Never publish anything on this account without the user explicitly approving
that specific post. There is no "auto-publish" mode for this skill.

1. Draft the caption text. For factual/regulatory content (news, prices,
   rules), cite the source and add a short disclaimer rather than stating it
   as your own claim.
2. Produce or source the image and get it to a public URL.
3. Create the media container (step above) — this only stages a draft, it
   does not go live.
4. Show the user the **exact caption text** and the image (or its URL) and
   ask a direct yes/no: "Post this to Instagram now?" Do not proceed on
   anything short of a clear yes.
5. Only then call `media_publish` with the `creation_id`.
6. Confirm success by fetching the new media's `permalink` and share that
   back to the user.

## Pitfalls

- **Error code 190** — token expired or invalid. Re-run the long-lived token
  exchange (setup step 5); don't ask the user for the token in chat, point
  them to redo the setup step.
- **Container creation fails / times out** — the `image_url` usually isn't
  actually publicly reachable (localhost, auth-gated, or still uploading).
  Verify with a plain `curl -I <image_url>` first.
- **Error code 4 / subcode 2207042** — hit the 25-posts/24h cap; wait for the
  window to roll over, don't retry immediately.
- **Container sat too long** — containers expire ~24h after creation if never
  published; recreate it rather than reusing a stale `creation_id`.
- **Carousel captions** — set the caption only on the parent `CAROUSEL`
  container, not on the individual `is_carousel_item` children.

## Verification

After every publish, `GET /{media-id}?fields=permalink,timestamp,caption` and
show the user the permalink — that's the proof it's actually live, not just
that the API call returned 200.
