# 0007. Notifications through ntfy, with signed action links

- Status: Accepted
- Date: 2026-11-27

## Context
Alerts need to reach the phone and the Mac, and be readable on a Garmin watch that mirrors phone notifications. Native push needs an app. Buttons like "I'm going" and the evening rating must work without a login screen.

## Decision
Send notifications with ntfy (free, iOS and Android apps): each user has a private, random topic. Titles carry the essentials in the first ~40 characters, in plain text, so they read on a watch. Action buttons call the Worker with a signed token that works for one event only. All sending goes through one `notify(user, message)` function.

## Consequences
- No app to build; watches show the text, buttons work on the phone.
- The public ntfy server has rate limits; moving to web push or a self-hosted ntfy only changes `notify` (ADR 0010).
- Token signing keys are Worker secrets, never in the repository.
