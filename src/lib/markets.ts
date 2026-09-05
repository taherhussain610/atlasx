export type MarketCategory = "layer-1" | "stablecoin" | "platform";

export type MarketAsset = {
  id: string;
  providerId: string | null;
  symbol: string;
  name: string;
  category: MarketCategory;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  liquidity: number;
  accent: string;
};

export type MarketSnapshot = {
  markets: MarketAsset[];
  source: "coingecko" | "sandbox";
  updatedAt: number;
};

export const MARKET_ASSETS: MarketAsset[] = [
  {
    id: "bnb",
    providerId: "binancecoin",
    symbol: "BNB",
    name: "BNB",
    category: "layer-1",
    price: 586.42,
    change24h: 2.84,
    volume24h: 1_840_000_000,
    marketCap: 85_600_000_000,
    liquidity: 4_820_000,
    accent: "#f3ba2f",
  },
  {
    id: "tron",
    providerId: "tron",
    symbol: "TRX",
    name: "TRON",
    category: "layer-1",
    price: 0.286,
    change24h: 1.17,
    volume24h: 762_000_000,
    marketCap: 24_700_000_000,
    liquidity: 3_240_000,
    accent: "#ff4b55",
  },
  {
    id: "solana",
    providerId: "solana",
    symbol: "SOL",
    name: "Solana",
    category: "layer-1",
    price: 142.58,
    change24h: -1.46,
    volume24h: 3_920_000_000,
    marketCap: 74_200_000_000,
    liquidity: 6_910_000,
    accent: "#9b7bff",
  },
  {
    id: "ethereum",
    providerId: "ethereum",
    symbol: "ETH",
    name: "Ethereum",
    category: "layer-1",
    price: 3238.1,
    change24h: 0.92,
    volume24h: 18_600_000_000,
    marketCap: 389_400_000_000,
    liquidity: 8_740_000,
    accent: "#92f47c",
  },
  {
    id: "tether",
    providerId: "tether",
    symbol: "USDT",
    name: "Tether",
    category: "stablecoin",
    price: 1,
    change24h: 0.01,
    volume24h: 64_200_000_000,
    marketCap: 118_300_000_000,
    liquidity: 12_800_000,
    accent: "#26a17b",
  },
  {
    id: "usd-coin",
    providerId: "usd-coin",
    symbol: "USDC",
    name: "USD Coin",
    category: "stablecoin",
    price: 1,
    change24h: -0.01,
    volume24h: 8_700_000_000,
    marketCap: 34_900_000_000,
    liquidity: 11_600_000,
    accent: "#2775ca",
  },
  {
    id: "atlasx",
    providerId: null,
    symbol: "ATX",
    name: "AtlasX",
    category: "platform",
    price: 0.142,
    change24h: 4.72,
    volume24h: 4_860_000,
    marketCap: 71_000_000,
    liquidity: 1_210_000,
    accent: "#8e7cff",
  },
];

export function formatMarketPrice(value: number): string {
  const maximumFractionDigits = value >= 100 ? 2 : value >= 1 ? 3 : 5;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits,
    minimumFractionDigits: value >= 1 ? 2 : 3,
  }).format(value);
}

export function marketProviderIds(): string {
  return MARKET_ASSETS.flatMap((market) => market.providerId ?? []).join(",");
}
