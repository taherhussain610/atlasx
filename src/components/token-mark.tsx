import { ChainId, getChain, getToken } from "@/lib/atlas";

export function TokenMark({
  chainId,
  symbol,
  size = "medium",
}: {
  chainId: ChainId;
  symbol: string;
  size?: "small" | "medium" | "large";
}) {
  const token = getToken(chainId, symbol);
  return (
    <span
      className={`token-mark token-mark--${size}`}
      style={{ "--token-color": token.color } as React.CSSProperties}
      aria-hidden="true"
    >
      {symbol.slice(0, 2)}
    </span>
  );
}

export function ChainMark({
  chainId,
  size = "medium",
}: {
  chainId: ChainId;
  size?: "small" | "medium" | "large";
}) {
  const chain = getChain(chainId);
  return (
    <span
      className={`chain-mark chain-mark--${size}`}
      style={{ "--chain-color": chain.accent } as React.CSSProperties}
      aria-hidden="true"
    >
      {chain.id === "abstract" ? "A" : chain.name.slice(0, 1)}
    </span>
  );
}
