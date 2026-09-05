export type ChainId = "bnb" | "tron" | "solana" | "abstract";
export type WalletKind = "evm" | "solana" | "tron" | "sandbox";

export type Chain = {
  id: ChainId;
  name: string;
  network: string;
  nativeSymbol: string;
  walletKind: Exclude<WalletKind, "sandbox">;
  accent: string;
  chainId?: number;
  rpcUrl?: string;
  explorerUrl: string;
};

export type Token = {
  symbol: string;
  name: string;
  price: number;
  color: string;
};

export const CHAINS: Chain[] = [
  {
    id: "bnb",
    name: "BNB Chain",
    network: "Testnet",
    nativeSymbol: "tBNB",
    walletKind: "evm",
    accent: "#f3ba2f",
    chainId: 97,
    rpcUrl: "https://data-seed-prebsc-1-s1.bnbchain.org:8545",
    explorerUrl: "https://testnet.bscscan.com",
  },
  {
    id: "tron",
    name: "TRON",
    network: "Nile",
    nativeSymbol: "TRX",
    walletKind: "tron",
    accent: "#ff4b55",
    explorerUrl: "https://nile.tronscan.org",
  },
  {
    id: "solana",
    name: "Solana",
    network: "Devnet",
    nativeSymbol: "SOL",
    walletKind: "solana",
    accent: "#9b7bff",
    explorerUrl: "https://explorer.solana.com/?cluster=devnet",
  },
  {
    id: "abstract",
    name: "Abstract",
    network: "Testnet",
    nativeSymbol: "ETH",
    walletKind: "evm",
    accent: "#92f47c",
    chainId: 11124,
    rpcUrl: "https://api.testnet.abs.xyz",
    explorerUrl: "https://explorer.testnet.abs.xyz",
  },
];

export const TOKENS: Record<ChainId, Token[]> = {
  bnb: [
    { symbol: "tBNB", name: "Testnet BNB", price: 586.42, color: "#f3ba2f" },
    { symbol: "USDT", name: "Tether USD", price: 1, color: "#26a17b" },
    { symbol: "USDC", name: "USD Coin", price: 1, color: "#2775ca" },
    { symbol: "ATX", name: "AtlasX", price: 0.142, color: "#8e7cff" },
  ],
  tron: [
    { symbol: "TRX", name: "TRON", price: 0.286, color: "#ff4b55" },
    { symbol: "USDT", name: "Tether USD", price: 1, color: "#26a17b" },
    { symbol: "USDC", name: "USD Coin", price: 1, color: "#2775ca" },
    { symbol: "ATX", name: "AtlasX", price: 0.142, color: "#8e7cff" },
  ],
  solana: [
    { symbol: "SOL", name: "Solana", price: 142.58, color: "#9b7bff" },
    { symbol: "USDC", name: "USD Coin", price: 1, color: "#2775ca" },
    { symbol: "USDT", name: "Tether USD", price: 1, color: "#26a17b" },
    { symbol: "ATX", name: "AtlasX", price: 0.142, color: "#8e7cff" },
  ],
  abstract: [
    { symbol: "ETH", name: "Ether", price: 3238.1, color: "#92f47c" },
    { symbol: "USDC", name: "USD Coin", price: 1, color: "#2775ca" },
    { symbol: "USDT", name: "Tether USD", price: 1, color: "#26a17b" },
    { symbol: "ATX", name: "AtlasX", price: 0.142, color: "#8e7cff" },
  ],
};

export const INITIAL_BALANCES: Record<ChainId, Record<string, number>> = {
  bnb: { tBNB: 12.48, USDT: 12450, USDC: 8850, ATX: 42000 },
  tron: { TRX: 28500, USDT: 7200, USDC: 4850, ATX: 28000 },
  solana: { SOL: 84.32, USDC: 9300, USDT: 5400, ATX: 35000 },
  abstract: { ETH: 4.82, USDC: 6800, USDT: 3200, ATX: 51000 },
};

export const POOL_LIQUIDITY: Record<ChainId, Record<string, number>> = {
  bnb: { "tBNB-USDT": 4_820_000, "USDC-USDT": 7_150_000, "ATX-USDT": 980_000 },
  tron: { "TRX-USDT": 3_240_000, "USDC-USDT": 5_680_000, "ATX-USDT": 740_000 },
  solana: { "SOL-USDC": 6_910_000, "USDC-USDT": 8_420_000, "ATX-USDC": 1_210_000 },
  abstract: { "ETH-USDC": 2_870_000, "USDC-USDT": 4_310_000, "ATX-USDC": 860_000 },
};

export const STAKING_OPTIONS = [
  { days: 30, label: "Flexible", apr: 7.5 },
  { days: 90, label: "Growth", apr: 12.8 },
  { days: 180, label: "Max yield", apr: 18.6 },
] as const;

export function getChain(id: ChainId): Chain {
  return CHAINS.find((chain) => chain.id === id) ?? CHAINS[0];
}

export function getToken(chainId: ChainId, symbol: string): Token {
  return TOKENS[chainId].find((token) => token.symbol === symbol) ?? TOKENS[chainId][0];
}

export function formatAmount(value: number, maximumFractionDigits = 4): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatCurrency(value: number, compact = false): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 2,
  }).format(Number.isFinite(value) ? value : 0);
}

export function shortenAddress(address: string): string {
  if (address.length < 13) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
