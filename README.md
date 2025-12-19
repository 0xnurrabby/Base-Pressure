# Base Pressure — Farcaster Mini App (Base)

Deployed domain: https://base-pressure.vercel.app/

## Required: Farcaster manifest signature
The manifest at `/.well-known/farcaster.json` must include `accountAssociation` fields (`header`, `payload`, `signature`).
Generate them in Base Build's **Account association** tool and paste them into:
`/.well-known/farcaster.json`. (Manifest schema reference) citeturn4view0

## Contract
Writes onchain highscores using your contract:
`0xB331328F506f2D35125e367A190e914B1b6830cF` calling `logAction(bytes32,bytes)`.

## Builder Codes
This app uses the `dataSuffix` capability for Builder Code attribution (Builder Codes docs). citeturn3view0  
Replace:
`const BUILDER_CODE = "TODO_REPLACE_BUILDER_CODE";`
with your real code from base.dev.

## Local leaderboard
Daily / Weekly / All-time leaderboards are stored locally (device storage). Onchain leaderboard is recorded when you mint.
