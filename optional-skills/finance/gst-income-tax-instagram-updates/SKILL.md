---
name: gst-income-tax-instagram-updates
description: "Watch official Indian GST and Income Tax sources for new notifications/circulars, verify anything you saw from Grok or elsewhere, and draft an Instagram post for your approval. Pairs with the instagram skill to publish once you say go."
version: 1.0.0
author: Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [blueprint, finance, india, tax, gst, income-tax, instagram, social-media]
    related_skills: [instagram]
    requires_toolsets: [web]
    blueprint:
      schedule: "0 9 * * 1-5"
      deliver: origin
      prompt: |
        Check official Indian tax sources for anything new since the last run:
        - Income Tax Dept press releases: https://incometaxindia.gov.in/Pages/press-releases.aspx
        - CBDT circulars/notifications: https://incometaxindia.gov.in/Pages/communications.aspx
        - GST Council updates: https://gstcouncil.gov.in/
        - CBIC (GST) notifications/circulars: https://www.cbic.gov.in/
        - GST portal "What's New": https://www.gst.gov.in/newsandupdates
        Only surface a genuinely new circular, notification, rate change, or
        due-date extension — dedupe against items already drafted in previous
        runs. If nothing new, respond with exactly [SILENT].
        For each new item: verify it on the official page itself (never take
        a secondhand summary, including anything from Grok/X, at face value —
        confirm it against the primary source above before drafting anything).
        Then draft a short, factual Instagram caption in plain language that
        cites the circular/notification number and date, links the source,
        and ends with "Not tax advice — verify on the official portal." Also
        suggest a simple one-line image concept (e.g. a text card with the
        headline number and date). Load the `instagram` skill and prepare
        everything needed to publish, but do NOT call media_publish — send
        the draft caption and image plan to the user and wait for their
        explicit go-ahead before publishing anything.
      no_agent: false
required_environment_variables:
  - name: INSTAGRAM_ACCESS_TOKEN
    optional: true
    prompt: "Enter your Instagram/Meta long-lived access token (only needed once you're ready to publish — drafting works without it)"
    help: "See the instagram skill's one-time setup section"
    required_for: "Actually publishing an approved draft to Instagram"
  - name: INSTAGRAM_BUSINESS_ACCOUNT_ID
    optional: true
    prompt: "Enter your Instagram Business Account ID (only needed to publish)"
    help: "See the instagram skill's one-time setup section"
    required_for: "Actually publishing an approved draft to Instagram"
---

# GST & Income Tax → Instagram Updates

Watches official Indian tax sources for genuinely new updates and turns them
into an Instagram-ready draft — caption, source citation, and an image
concept — that you approve before anything is posted. This skill never
publishes on its own; it only drafts and asks.

## When to use

- You want a standing check for new GST/Income Tax circulars, notifications,
  rate changes, or due-date extensions, delivered as a ready-to-post
  Instagram draft.
- You saw something from Grok (or anywhere else — X, a forwarded message, a
  news site) about a tax change and want it turned into an Instagram post —
  but verified against the official source first, since secondhand summaries
  (including from an LLM) can be stale or wrong.

## Turning this into a recurring check

This is a **Blueprint** skill — installing it does not schedule anything by
itself. After it's loaded, run `/suggestions` to review and accept it (or
just ask "set up my GST/tax Instagram updates" and Hermes will offer to
schedule it). The default cadence is weekday mornings; change the time or
days any time with `/cron`.

## What each scheduled run does

1. Reads the official sources listed in this skill's blueprint prompt —
   never an aggregator, and never an LLM's own recollection, for the
   underlying facts.
2. Skips anything already drafted in a previous run.
3. Nothing new → stays silent. You won't get pinged for no reason.
4. Something new → verifies it on the official page, drafts a caption +
   image concept, and sends it to you. It stops there and waits.

## Ad hoc use — checking something you saw from Grok

You don't have to wait for the scheduled run. Paste what Grok (or anyone
else) told you, with a note like "check this against the official GST portal
and draft an Instagram post if it's real." Hermes will:

1. Look up the claim on the relevant official source (gst.gov.in /
   cbic.gov.in / incometaxindia.gov.in / gstcouncil.gov.in).
2. Tell you plainly if it can't confirm it — an unverified claim should not
   turn into a post, no matter where it came from.
3. If confirmed, draft the caption and image concept the same way as a
   scheduled run, then wait for your approval.

## Publishing an approved draft

Drafting needs nothing beyond web access. Publishing uses the `instagram`
skill, which needs a one-time Meta/Instagram developer setup done by you,
outside this chat (see that skill's setup section) — do that whenever you're
ready; nothing here is blocked on it in the meantime.

## Content rules for tax posts specifically

- Always cite the circular/notification number, date, and a source link in
  the caption.
- Always end with: "Not tax advice — verify on the official portal."
- Never state an effective date, rate, or amount that wasn't confirmed on
  the primary source.
- Write for a general audience, not tax professionals — plain language over
  jargon.
- If a claim can't be verified, say so to the user instead of softening it
  into a post anyway.
