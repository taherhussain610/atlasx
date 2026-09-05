import {
  MARKET_ASSETS,
  MarketAsset,
  MarketSnapshot,
  marketProviderIds,
} from "@/lib/markets";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type ProviderMarket = {
  usd?: unknown;
  usd_24h_change?: unknown;
  usd_24h_vol?: unknown;
  usd_market_cap?: unknown;
};

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function mergeProviderMarket(
  market: MarketAsset,
  provider: Record<string, ProviderMarket>,
): MarketAsset {
  if (!market.providerId) return market;
  const live = provider[market.providerId];
  if (!live) return market;

  return {
    ...market,
    price: Math.max(finiteNumber(live.usd, market.price), 0),
    change24h: finiteNumber(live.usd_24h_change, market.change24h),
    volume24h: Math.max(finiteNumber(live.usd_24h_vol, market.volume24h), 0),
    marketCap: Math.max(finiteNumber(live.usd_market_cap, market.marketCap), 0),
  };
}

function response(snapshot: MarketSnapshot) {
  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}

export async function GET() {
  const updatedAt = Date.now();
  const fallback: MarketSnapshot = {
    markets: MARKET_ASSETS,
    source: "sandbox",
    updatedAt,
  };

  try {
    const endpoint = new URL("https://api.coingecko.com/api/v3/simple/price");
    endpoint.searchParams.set("ids", marketProviderIds());
    endpoint.searchParams.set("vs_currencies", "usd");
    endpoint.searchParams.set("include_24hr_change", "true");
    endpoint.searchParams.set("include_24hr_vol", "true");
    endpoint.searchParams.set("include_market_cap", "true");

    const upstream = await fetch(endpoint, {
      headers: { accept: "application/json" },
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(4_000),
    });
    if (!upstream.ok) return response(fallback);

    const payload: unknown = await upstream.json();
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return response(fallback);
    }

    const provider = payload as Record<string, ProviderMarket>;
    const hasLiveMarket = MARKET_ASSETS.some(
      (market) => market.providerId && provider[market.providerId],
    );
    if (!hasLiveMarket) return response(fallback);

    return response({
      markets: MARKET_ASSETS.map((market) => mergeProviderMarket(market, provider)),
      source: "coingecko",
      updatedAt,
    });
  } catch {
    return response(fallback);
  }
}
