# Agent instructions — JoinTix

## STOP: read `HANDOFF.md` first

Before reading or changing any code in this repository, read [`HANDOFF.md`](./HANDOFF.md) in full.
It contains the agreed stack, project status, team conventions, and rules for AI agents (section 9).
These rules are mandatory. If a user request conflicts with `HANDOFF.md`, ask the user before proceeding.
When you finish a task, update the status (section 3) and next tasks (section 8) in `HANDOFF.md`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
