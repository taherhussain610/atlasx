# AtlasX

AtlasX is a cross-chain exchange sandbox for rehearsing swaps, liquidity
positions, and staking strategies across BNB Chain, TRON, Solana, and Abstract.
Sandbox actions never broadcast transactions or use real funds.

## Features

- Persistent browser-based balances and strategy history with optional MySQL sync
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

## MySQL configuration

AtlasX can save each browser's sandbox portfolio to MySQL while retaining
`localStorage` as an automatic fallback. Only simulated balances, orders,
positions, and activity are stored. Wallet addresses, wallet credentials, and
real transactions are never written to the database.

Set the following server-only environment variables in `.env.local` locally and
in the application settings for `atlasx.online`:

```dotenv
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=u340208828_atlasx
MYSQL_USER=u340208828_atlasx
MYSQL_PASSWORD=your-database-password
MYSQL_SSL=false
MYSQL_MAX_PORTFOLIOS=100
MYSQL_PORTFOLIO_RETENTION_DAYS=90
```

Use the database hostname shown in the hosting control panel if it is not
`localhost`. Set `MYSQL_SSL=true` only when the database endpoint supports a
certificate trusted by Node.js. Never prefix these variables with
`NEXT_PUBLIC_`, and never commit the real password.

The server creates the `atlasx_sandbox_portfolios` table on the first sync. The
same idempotent statement is available in [`database/schema.sql`](database/schema.sql)
for manual setup. Each browser receives a random, HTTP-only portfolio cookie,
and `GET`/`PUT /api/portfolio` loads or replaces that browser's latest snapshot.
Writes use revision checks so one tab cannot silently overwrite another. New
portfolio creation is serialized and bounded by `MYSQL_MAX_PORTFOLIOS`, while
inactive rows are removed after `MYSQL_PORTFOLIO_RETENTION_DAYS`.
If MySQL is unavailable or not configured, AtlasX continues using browser
storage without interrupting sandbox trading.

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
