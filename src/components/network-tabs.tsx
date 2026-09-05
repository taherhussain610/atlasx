"use client";

import { ChainMark } from "@/components/token-mark";
import { useAtlas } from "@/context/atlas-context";
import { CHAINS } from "@/lib/atlas";

export function NetworkTabs() {
  const { chainId, selectChain } = useAtlas();

  return (
    <div className="network-tabs" role="group" aria-label="Choose sandbox network">
      {CHAINS.map((chain) => (
        <button
          className={chain.id === chainId ? "is-active" : ""}
          type="button"
          key={chain.id}
          onClick={() => void selectChain(chain.id)}
        >
          <ChainMark chainId={chain.id} size="small" />
          <span>
            <strong>{chain.name}</strong>
            <small>{chain.network}</small>
          </span>
        </button>
      ))}
    </div>
  );
}
