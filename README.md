# AtlasX

AtlasX is a cross-chain exchange sandbox for rehearsing swaps, liquidity
positions, and staking strategies across BNB Chain, TRON, Solana, and Abstract.
Sandbox actions never broadcast transactions or use real funds.

## Features

- Persistent browser-based balances and strategy history
- Swap routing with fee, slippage, price-impact, and minimum-output estimates
- Liquidity position creation and withdrawal
- Staking projections, reward claims, and unstaking
- MetaMask, Phantom, TronLink, and instant sandbox-wallet connections
- Server-only Tatum JSON-RPC health check
- Responsive interface for desktop and mobile

## Local setup

Requires Node.js 20.9 or later.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The app works without RPC configuration. In that case, the Network page reports
that it is running in sandbox-only mode.

## Tatum RPC configuration

Create a fresh Tatum API key and add the gateway URL and key to `.env.local`:

```dotenv
TATUM_RPC_URL=https://your-gateway.gateway.tatum.io/jsonrpc/
TATUM_API_KEY=replace-with-a-new-api-key
```

`TATUM_API_KEY` is read only by `GET /api/network/status`; it is never included
in the browser bundle. The route sends a fixed, read-only `eth_blockNumber`
request and does not accept methods or parameters from clients.

Do not reuse a key that has been shared publicly. Revoke exposed credentials in
the Tatum dashboard before configuring this project.

## Wallet behavior

AtlasX detects MetaMask-compatible EVM providers, Phantom, and TronLink in the
browser. Wallet connections identify the active sandbox portfolio and can
request the matching test network, but all swap, liquidity, and staking
operations remain local simulations. Use **Sandbox wallet** to try every flow
without installing an extension.

## Commands

```bash
npm run dev     # start the development server
npm run lint    # run ESLint
npm run build   # create a production build
npm start       # serve the production build
```
