# Mindum Widget

The browser-side chat widget for Mindum. Embeds in customer Laravel apps via the SDK's `<x-mindum::widget />` Blade component.

**Status:** Placeholder. Real scaffolding lands in Phase 2C.1.

## What this is

- **Transport:** Vite-bundled vanilla JS + Alpine.js, target <50KB gzipped (NFR-005)
- **Auth model:** Browser never holds the customer's API key. Widget calls the customer's app at `/mindum/widget/token` (same origin) to mint a short-lived JWT, then uses that JWT for both `POST /api/widget/chat` and Reverb private-channel subscribe on `widget.{session_id}`.
- **Real-time:** Broadcasts from `WidgetMessageBroadcast` (event name `widget.message`) on a private Reverb channel. 2C renders responses; 2D streams tokens through the same hook.

## Phase 2C sub-phases

- **2C.0** (orchestrator + SDK side): SDK token-proxy + Blade component land in `mindum/laravel`. No widget code yet — verifiable with curl.
- **2C.1** (this repo): Vite scaffolding + floating bubble + POST chat. No WS, no markdown. Proves the auth flow in a real browser.
- **2C.2** (this repo): WS subscribe via `laravel-echo` + `pusher-js`, markdown rendering, sessionStorage, bundle-size CI gate.

See `Docs/Milestone_2_Plan.md` in the parent project for the full plan.
