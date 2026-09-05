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
import { FormEvent, useState } from "react";

export default function LiquidityPage() {
  const { chainId } = useAtlas();

  return (
    <div className="flow-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Liquidity studio</span>
          <h1>Build a position</h1>
          <p>Model pool exposure and fee yield before deploying real capital.</p>
        </div>
        <div className="header-stat">
          <span>AtlasX sandbox TVL</span>
          <strong>$47.8M</strong>
          <small>Across 12 practice pools</small>
        </div>
      </header>
      <NetworkTabs />
      <LiquidityWorkspace key={chainId} chainId={chainId} />
    </div>
  );
}

function LiquidityWorkspace({ chainId }: { chainId: ChainId }) {
  const {
    balances,
    wallet,
    isWalletCompatible,
    liquidityPositions,
    setWalletModalOpen,
    addLiquidity,
    withdrawLiquidity,
  } = useAtlas();
  const tokens = TOKENS[chainId];
  const defaultQuote = tokens.find((token) => token.symbol === "USDC") ?? tokens[1];
  const [tokenA, setTokenA] = useState(tokens[0].symbol);
  const [tokenB, setTokenB] = useState(defaultQuote.symbol);
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numericA = Number(amountA) || 0;
  const numericB = Number(amountB) || 0;
  const tokenAData = getToken(chainId, tokenA);
  const tokenBData = getToken(chainId, tokenB);
  const valueUsd = numericA * tokenAData.price + numericB * tokenBData.price;
  const positions = liquidityPositions.filter(
    (position) => position.chainId === chainId,
  );

  const updateAmountA = (value: string) => {
    if (!/^\d*\.?\d*$/.test(value)) return;
    setAmountA(value);
    const numberValue = Number(value);
    setAmountB(
      numberValue > 0
        ? ((numberValue * tokenAData.price) / tokenBData.price).toFixed(4)
        : "",
    );
    setError(null);
  };

  const updateAmountB = (value: string) => {
    if (!/^\d*\.?\d*$/.test(value)) return;
    setAmountB(value);
    setError(null);
  };

  const selectTokenA = (next: string) => {
    if (next === tokenB) setTokenB(tokenA);
    setTokenA(next);
    setAmountA("");
    setAmountB("");
  };

  const selectTokenB = (next: string) => {
    if (next === tokenA) setTokenA(tokenB);
    setTokenB(next);
    setAmountA("");
    setAmountB("");
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!wallet || !isWalletCompatible) {
      setWalletModalOpen(true);
      setError(`Connect a compatible wallet for ${getChain(chainId).name}.`);
      return;
    }
    setProcessing(true);
    await new Promise((resolve) => setTimeout(resolve, 650));
    try {
      addLiquidity(tokenA, tokenB, numericA, numericB);
      setAmountA("");
      setAmountB("");
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "The position could not be created.",
      );
    } finally {
      setProcessing(false);
    }
  };

  return (
    <>
      <div className="liquidity-layout">
        <form className="liquidity-card" onSubmit={handleSubmit}>
          <div className="card-title-row">
            <div>
              <h2>Add liquidity</h2>
              <span>50 / 50 weighted position</span>
            </div>
            <span className="fee-tier">0.30% fee tier</span>
          </div>

          <LiquidityAmount
            chainId={chainId}
            symbol={tokenA}
            value={amountA}
            balance={balances[chainId][tokenA] ?? 0}
            tokens={tokens.map((token) => token.symbol)}
            label="First asset"
            onValue={updateAmountA}
            onToken={selectTokenA}
            onMax={() => updateAmountA(String(balances[chainId][tokenA] ?? 0))}
          />

          <div className="pair-plus">+</div>

          <LiquidityAmount
            chainId={chainId}
            symbol={tokenB}
            value={amountB}
            balance={balances[chainId][tokenB] ?? 0}
            tokens={tokens.map((token) => token.symbol)}
            label="Second asset"
            onValue={updateAmountB}
            onToken={selectTokenB}
            onMax={() => updateAmountB(String(balances[chainId][tokenB] ?? 0))}
          />

          <div className="position-preview">
            <div>
              <span>Position value</span>
              <strong>{formatCurrency(valueUsd)}</strong>
            </div>
            <div>
              <span>Estimated pool share</span>
              <strong>{valueUsd ? `${((valueUsd / 2_500_000) * 100).toFixed(4)}%` : "—"}</strong>
            </div>
            <div>
              <span>Est. fee APR</span>
              <strong className="value-good">14.2%</strong>
            </div>
          </div>

          {error && <p className="form-error">{error}</p>}
          <button
            className="button button--primary button--full liquidity-submit"
            type="submit"
            disabled={processing}
          >
            {processing
              ? "Creating position…"
              : !wallet
                ? "Connect wallet"
                : numericA <= 0 || numericB <= 0
                  ? "Enter token amounts"
                  : "Add sandbox liquidity"}
          </button>
          <p className="sandbox-disclaimer">
            <Icon name="shield" size={13} />
            Your sandbox balances update instantly.
          </p>
        </form>

        <section className="panel pools-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Top routes</span>
              <h2>{getChain(chainId).name} pools</h2>
            </div>
            <span className="status-chip status-chip--success">
              <span className="status-dot" />
              Live model
            </span>
          </div>
          <div className="pool-table">
            <div className="pool-table__head">
              <span>Pool</span>
              <span>TVL</span>
              <span>Volume 24h</span>
              <span>APR</span>
            </div>
            {Object.entries(POOL_LIQUIDITY[chainId]).map(
              ([pair, liquidity], index) => {
                const [first, second] = pair.split("-");
                const apr = [14.2, 8.7, 22.4][index] ?? 11.6;
                return (
                  <div className="pool-row" key={pair}>
                    <div className="pool-pair">
                      <span className="token-pair">
                        <TokenMark chainId={chainId} symbol={first} size="small" />
                        <TokenMark chainId={chainId} symbol={second} size="small" />
                      </span>
                      <span>
                        <strong>{first}/{second}</strong>
                        <small>0.30% fee</small>
                      </span>
                    </div>
                    <strong>{formatCurrency(liquidity, true)}</strong>
                    <strong>{formatCurrency(liquidity * (0.08 + index * 0.025), true)}</strong>
                    <strong className="value-good">{apr}%</strong>
                  </div>
                );
              },
            )}
          </div>
          <div className="pool-insight">
            <Icon name="sparkles" size={18} />
            <p>
              <strong>Practice impermanent loss safely</strong>
              Add and remove positions as prices move. Your strategy journal keeps
              the complete history.
            </p>
          </div>
        </section>
      </div>

      <section className="panel positions-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Portfolio</span>
            <h2>Your liquidity positions</h2>
          </div>
          <span className="activity-count">{positions.length}</span>
        </div>
        {positions.length ? (
          <div className="position-list">
            {positions.map((position) => (
              <article className="position-row" key={position.id}>
                <div className="pool-pair">
                  <span className="token-pair">
                    <TokenMark
                      chainId={position.chainId}
                      symbol={position.tokenA}
                      size="small"
                    />
                    <TokenMark
                      chainId={position.chainId}
                      symbol={position.tokenB}
                      size="small"
                    />
                  </span>
                  <span>
                    <strong>{position.tokenA}/{position.tokenB}</strong>
                    <small>Active sandbox position</small>
                  </span>
                </div>
                <div>
                  <span>Deposited</span>
                  <strong>
                    {formatAmount(position.amountA)} {position.tokenA} +{" "}
                    {formatAmount(position.amountB)} {position.tokenB}
                  </strong>
                </div>
                <div>
                  <span>Value</span>
                  <strong>{formatCurrency(position.valueUsd)}</strong>
                </div>
                <div>
                  <span>Pool share</span>
                  <strong>{position.share.toFixed(4)}%</strong>
                </div>
                <button
                  className="button button--secondary"
                  type="button"
                  onClick={() => {
                    try {
                      withdrawLiquidity(position.id);
                    } catch {
                      setWalletModalOpen(true);
                    }
                  }}
                >
                  Withdraw
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state empty-state--short">
            <span>
              <Icon name="liquidity" size={24} />
            </span>
            <h3>No positions on {getChain(chainId).name}</h3>
            <p>Use the form above to model your first liquidity position.</p>
          </div>
        )}
      </section>
    </>
  );
}

function LiquidityAmount({
  chainId,
  symbol,
  value,
  balance,
  tokens,
  label,
  onValue,
  onToken,
  onMax,
}: {
  chainId: ChainId;
  symbol: string;
  value: string;
  balance: number;
  tokens: string[];
  label: string;
  onValue: (value: string) => void;
  onToken: (value: string) => void;
  onMax: () => void;
}) {
  return (
    <div className="amount-box liquidity-amount">
      <div className="amount-box__label">
        <span>{label}</span>
        <span>
          Balance: {formatAmount(balance)} {symbol}
        </span>
      </div>
      <div className="amount-box__input">
        <input
          aria-label={`${label} amount`}
          inputMode="decimal"
          placeholder="0.0"
          value={value}
          onChange={(event) => onValue(event.target.value)}
        />
        <button className="max-button" type="button" onClick={onMax}>
          Max
        </button>
        <label className="token-select">
          <TokenMark chainId={chainId} symbol={symbol} size="small" />
          <select
            aria-label={`${label} token`}
            value={symbol}
            onChange={(event) => onToken(event.target.value)}
          >
            {tokens.map((token) => (
              <option value={token} key={token}>
                {token}
              </option>
            ))}
          </select>
          <Icon name="chevron" size={14} />
        </label>
      </div>
      <span className="amount-box__usd">
        {formatCurrency((Number(value) || 0) * getToken(chainId, symbol).price)}
      </span>
    </div>
  );
}
