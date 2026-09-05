"use client";

import { Icon } from "@/components/icons";
import { NetworkTabs } from "@/components/network-tabs";
import { TokenMark } from "@/components/token-mark";
import { useAtlas } from "@/context/atlas-context";
import {
  ChainId,
  formatAmount,
  formatCurrency,
  getChain,
  getToken,
  POOL_LIQUIDITY,
  TOKENS,
} from "@/lib/atlas";
import { FormEvent, useMemo, useState } from "react";

export default function SwapPage() {
  const { chainId } = useAtlas();

  return (
    <div className="flow-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Universal router</span>
          <h1>Swap assets</h1>
          <p>Compare the route, tune execution, and practice with sandbox balances.</p>
        </div>
        <div className="header-badge">
          <Icon name="shield" size={17} />
          <span>
            <strong>Sandbox protected</strong>
            No transaction is broadcast
          </span>
        </div>
      </header>
      <NetworkTabs />
      <SwapForm key={chainId} chainId={chainId} />
    </div>
  );
}

function SwapForm({ chainId }: { chainId: ChainId }) {
  const {
    balances,
    wallet,
    isWalletCompatible,
    setWalletModalOpen,
    executeSwap,
  } = useAtlas();
  const tokens = TOKENS[chainId];
  const [fromSymbol, setFromSymbol] = useState(tokens[0].symbol);
  const [toSymbol, setToSymbol] = useState(tokens[1].symbol);
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState(0.5);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountNumber = Number(amount) || 0;
  const fromToken = getToken(chainId, fromSymbol);
  const toToken = getToken(chainId, toSymbol);
  const available = balances[chainId][fromSymbol] ?? 0;
  const pairKey = `${fromSymbol}-${toSymbol}`;
  const reversePairKey = `${toSymbol}-${fromSymbol}`;
  const liquidity =
    POOL_LIQUIDITY[chainId][pairKey] ??
    POOL_LIQUIDITY[chainId][reversePairKey] ??
    1_200_000;
  const inputValue = amountNumber * fromToken.price;
  const priceImpact = Math.min((inputValue / liquidity) * 100, 8);
  const feeRate = 0.003;
  const outputAmount =
    amountNumber > 0
      ? (inputValue / toToken.price) * (1 - feeRate) * (1 - priceImpact / 100)
      : 0;
  const minimumReceived = outputAmount * (1 - slippage / 100);
  const routeTokens = useMemo(() => {
    if (fromSymbol.includes("USD") || toSymbol.includes("USD")) {
      return [fromSymbol, toSymbol];
    }
    const bridge = tokens.some((token) => token.symbol === "USDC") ? "USDC" : "USDT";
    return [fromSymbol, bridge, toSymbol];
  }, [fromSymbol, toSymbol, tokens]);

  const switchTokens = () => {
    setFromSymbol(toSymbol);
    setToSymbol(fromSymbol);
    setAmount(outputAmount ? outputAmount.toFixed(6) : "");
    setError(null);
  };

  const updateFromToken = (next: string) => {
    setFromSymbol(next);
    if (next === toSymbol) {
      setToSymbol(fromSymbol);
    }
    setError(null);
  };

  const updateToToken = (next: string) => {
    setToSymbol(next);
    if (next === fromSymbol) {
      setFromSymbol(toSymbol);
    }
    setError(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!wallet || !isWalletCompatible) {
      setWalletModalOpen(true);
      setError(`Connect a compatible wallet for ${getChain(chainId).name}.`);
      return;
    }
    if (amountNumber <= 0) {
      setError("Enter an amount to swap.");
      return;
    }
    if (amountNumber > available) {
      setError(`Your sandbox balance has ${formatAmount(available)} ${fromSymbol}.`);
      return;
    }
    setProcessing(true);
    await new Promise((resolve) => setTimeout(resolve, 650));
    try {
      executeSwap(fromSymbol, toSymbol, amountNumber, outputAmount);
      setAmount("");
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : "The swap could not be completed.",
      );
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="trade-layout">
      <form className="swap-card" onSubmit={handleSubmit}>
        <div className="card-title-row">
          <div>
            <h2>Swap</h2>
            <span>{getChain(chainId).name} sandbox</span>
          </div>
          <button
            className={`icon-button ${settingsOpen ? "is-active" : ""}`}
            type="button"
            aria-label="Swap settings"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((open) => !open)}
          >
            <span className="settings-glyph">⌁</span>
          </button>
        </div>

        {settingsOpen && (
          <div className="swap-settings">
            <span>Maximum slippage</span>
            <div>
              {[0.1, 0.5, 1].map((value) => (
                <button
                  className={slippage === value ? "is-active" : ""}
                  type="button"
                  key={value}
                  onClick={() => setSlippage(value)}
                >
                  {value}%
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="amount-box">
          <div className="amount-box__label">
            <span>You pay</span>
            <span>
              Balance: {formatAmount(available)} {fromSymbol}
            </span>
          </div>
          <div className="amount-box__input">
            <input
              aria-label={`Amount of ${fromSymbol} to swap`}
              inputMode="decimal"
              placeholder="0.0"
              value={amount}
              onChange={(event) => {
                const value = event.target.value;
                if (/^\d*\.?\d*$/.test(value)) setAmount(value);
                setError(null);
              }}
            />
            <button
              className="max-button"
              type="button"
              onClick={() => setAmount(String(available))}
            >
              Max
            </button>
            <label className="token-select">
              <TokenMark chainId={chainId} symbol={fromSymbol} size="small" />
              <select
                aria-label="Token to sell"
                value={fromSymbol}
                onChange={(event) => updateFromToken(event.target.value)}
              >
                {tokens.map((token) => (
                  <option value={token.symbol} key={token.symbol}>
                    {token.symbol}
                  </option>
                ))}
              </select>
              <Icon name="chevron" size={14} />
            </label>
          </div>
          <span className="amount-box__usd">{formatCurrency(inputValue)}</span>
        </div>

        <div className="swap-direction">
          <button type="button" onClick={switchTokens} aria-label="Switch swap tokens">
            <Icon name="arrow" size={17} />
          </button>
        </div>

        <div className="amount-box amount-box--output">
          <div className="amount-box__label">
            <span>You receive</span>
            <span>
              Balance: {formatAmount(balances[chainId][toSymbol] ?? 0)} {toSymbol}
            </span>
          </div>
          <div className="amount-box__input">
            <input
              aria-label={`Estimated ${toSymbol} received`}
              placeholder="0.0"
              value={outputAmount ? outputAmount.toFixed(6) : ""}
              readOnly
            />
            <label className="token-select">
              <TokenMark chainId={chainId} symbol={toSymbol} size="small" />
              <select
                aria-label="Token to receive"
                value={toSymbol}
                onChange={(event) => updateToToken(event.target.value)}
              >
                {tokens.map((token) => (
                  <option value={token.symbol} key={token.symbol}>
                    {token.symbol}
                  </option>
                ))}
              </select>
              <Icon name="chevron" size={14} />
            </label>
          </div>
          <span className="amount-box__usd">
            {formatCurrency(outputAmount * toToken.price)}
          </span>
        </div>

        {amountNumber > 0 && (
          <div className="quote-summary">
            <div>
              <span>Rate</span>
              <strong>
                1 {fromSymbol} = {formatAmount(fromToken.price / toToken.price, 6)}{" "}
                {toSymbol}
              </strong>
            </div>
            <div>
              <span>Price impact</span>
              <strong className={priceImpact > 1 ? "value-warning" : "value-good"}>
                {priceImpact.toFixed(2)}%
              </strong>
            </div>
          </div>
        )}

        {error && <p className="form-error">{error}</p>}
        <button
          className="button button--primary button--full swap-submit"
          type="submit"
          disabled={processing}
        >
          {processing
            ? "Routing sandbox swap…"
            : !wallet
              ? "Connect wallet"
              : !isWalletCompatible
                ? "Switch wallet"
                : amountNumber <= 0
                  ? "Enter an amount"
                  : "Review sandbox swap"}
        </button>
        <p className="sandbox-disclaimer">
          <Icon name="shield" size={13} />
          Simulated execution. No approval or gas is required.
        </p>
      </form>

      <aside className="route-panel">
        <div className="panel-heading panel-heading--compact">
          <div>
            <span className="eyebrow">AtlasX smart route</span>
            <h2>Route preview</h2>
          </div>
          <span className="status-chip status-chip--success">
            <span className="status-dot" />
            Ready
          </span>
        </div>
        <div className="route-content">
          <div className="route-visual">
            {routeTokens.map((symbol, index) => (
              <div className="route-step" key={`${symbol}-${index}`}>
                <TokenMark chainId={chainId} symbol={symbol} />
                <span>
                  <strong>{symbol}</strong>
                  <small>{index === 0 ? "Input" : index === routeTokens.length - 1 ? "Output" : "Bridge"}</small>
                </span>
                {index < routeTokens.length - 1 && (
                  <div className="route-connector">
                    <span />
                    <small>{index === 0 ? "0.05%" : "0.30%"}</small>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="route-stat-grid">
            <div>
              <span>Minimum received</span>
              <strong>
                {formatAmount(minimumReceived, 6)} {toSymbol}
              </strong>
            </div>
            <div>
              <span>Liquidity available</span>
              <strong>{formatCurrency(liquidity, true)}</strong>
            </div>
            <div>
              <span>Route fee</span>
              <strong>{formatCurrency(inputValue * feeRate)}</strong>
            </div>
            <div>
              <span>Expected time</span>
              <strong>~2 sec</strong>
            </div>
          </div>
          <div className="route-note">
            <Icon name="sparkles" size={18} />
            <p>
              <strong>Best sandbox route selected</strong>
              AtlasX evaluates direct and stablecoin paths to minimize simulated
              slippage.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
