# AtlasX

AtlasX is a cross-chain exchange sandbox for rehearsing swaps, liquidity
positions, and staking strategies across BNB Chain, TRON, Solana, and Abstract.
Sandbox actions never broadcast transactions or use real funds.

## Features

- Persistent browser-based balances and strategy history
- Swap routing with fee, slippage, price-impact, and minimum-output estimates
- Live reference markets with search, watchlists, chart ranges, depth, and trade tape
- Persistent sandbox limit orders and scheduled DCA plans with manual fill simulation
- Liquidity position creation and withdrawal
- Staking projections, reward claims, and unstaking
- MetaMask, Phantom, TronLink, and instant sandbox-wallet connections
- Server-only Tatum JSON-RPC health check
- Server-side CoinGecko reference pricing with a deterministic offline fallback
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

The Markets page requests reference prices through `GET /api/markets`. The
server uses CoinGecko when it is reachable and automatically returns the bundled
sandbox snapshot when the upstream service is unavailable. No market-data key
is required.

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

## Advanced order behavior

Limit and DCA orders are saved with the rest of the browser portfolio. They do
not broadcast transactions or run in the background. Use **Simulate fill** or
**Run next** from the order manager to execute a sandbox fill against the
selected portfolio.

For support, email [info@atlasx.online](mailto:info@atlasx.online).

## Commands

```bash
npm run dev     # start the development server
npm run lint    # run ESLint
npm run build   # create a production build
npm start       # serve the production build
```
