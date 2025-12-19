# Base Pressure — Farcaster + Base Mini App (nurrabby.com)

This project is a production-ready Mini App that:
- Uses `@farcaster/miniapp-sdk` and always calls `sdk.actions.ready()`
- Publishes `/.well-known/farcaster.json`
- Ships 3:2 embed image at `/assets/embed-3x2.png`
- Connects to the host-provided Ethereum provider (EIP-1193)
- Sends an onchain tx to `0xB331328F506f2D35125e367A190e914B1b6830cF` calling:
  `logAction(bytes32 action, bytes data)`
- Uses Base Builder Codes (ERC-8021) via `Attribution.toDataSuffix`

## Local dev
```bash
npm i
npm run dev
```

## Build
```bash
npm run build
npm run preview
```

## IMPORTANT
1) Replace `BUILDER_CODE` in `src/main.js` with your real Base Builder Code.
2) Generate and paste your real `accountAssociation` values into `public/.well-known/farcaster.json`
   (Base Build can generate this for you).
