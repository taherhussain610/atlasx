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
  STAKING_OPTIONS,
  TOKENS,
} from "@/lib/atlas";
import { FormEvent, useState } from "react";

export default function StakingPage() {
  const { chainId } = useAtlas();

  return (
    <div className="flow-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Yield simulator</span>
          <h1>Stake with confidence</h1>
          <p>Compare lock periods and model rewards across every AtlasX network.</p>
        </div>
        <div className="header-stat">
          <span>Highest sandbox APR</span>
          <strong>18.6%</strong>
          <small>180-day strategy</small>
        </div>
      </header>
      <NetworkTabs />
      <StakingWorkspace key={chainId} chainId={chainId} />
    </div>
  );
}

function StakingWorkspace({ chainId }: { chainId: ChainId }) {
  const {
    balances,
    wallet,
    isWalletCompatible,
    stakePositions,
    setWalletModalOpen,
    createStake,
    claimStakeRewards,
    unstake,
  } = useAtlas();
  const tokens = TOKENS[chainId];
  const defaultToken = tokens.find((token) => token.symbol === "ATX") ?? tokens[0];
  const [symbol, setSymbol] = useState(defaultToken.symbol);
  const [amount, setAmount] = useState("");
  const [optionIndex, setOptionIndex] = useState(1);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedOption = STAKING_OPTIONS[optionIndex];
  const amountNumber = Number(amount) || 0;
  const token = getToken(chainId, symbol);
  const positions = stakePositions.filter((position) => position.chainId === chainId);
  const projectedReward =
    amountNumber * (selectedOption.apr / 100) * (selectedOption.days / 365);
  const stakedValue = positions.reduce(
    (total, position) =>
      total + position.amount * getToken(chainId, position.token).price,
    0,
  );

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
      createStake(
        symbol,
        amountNumber,
        selectedOption.apr,
        selectedOption.days,
      );
      setAmount("");
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : "The stake could not be created.",
      );
    } finally {
      setProcessing(false);
    }
  };

  return (
    <>
      <div className="staking-layout">
        <form className="staking-card" onSubmit={handleSubmit}>
          <div className="card-title-row">
            <div>
              <h2>Create a stake</h2>
              <span>Rewards accrue in the deposited asset</span>
            </div>
            <span className="status-chip status-chip--success">
              <span className="status-dot" />
              Active
            </span>
          </div>

          <div className="stake-token-picker">
            <span>Asset</span>
            <div>
              {tokens.map((item) => (
                <button
                  className={item.symbol === symbol ? "is-active" : ""}
                  type="button"
                  key={item.symbol}
                  onClick={() => {
                    setSymbol(item.symbol);
                    setAmount("");
                    setError(null);
                  }}
                >
                  <TokenMark chainId={chainId} symbol={item.symbol} size="small" />
                  {item.symbol}
                </button>
              ))}
            </div>
          </div>

          <div className="amount-box stake-amount">
            <div className="amount-box__label">
              <span>Amount to stake</span>
              <span>
                Balance: {formatAmount(balances[chainId][symbol] ?? 0)} {symbol}
              </span>
            </div>
            <div className="amount-box__input">
              <input
                aria-label={`Amount of ${symbol} to stake`}
                inputMode="decimal"
                placeholder="0.0"
                value={amount}
                onChange={(event) => {
                  if (/^\d*\.?\d*$/.test(event.target.value)) {
                    setAmount(event.target.value);
                  }
                  setError(null);
                }}
              />
              <button
                className="max-button"
                type="button"
                onClick={() => setAmount(String(balances[chainId][symbol] ?? 0))}
              >
                Max
              </button>
              <span className="asset-suffix">
                <TokenMark chainId={chainId} symbol={symbol} size="small" />
                {symbol}
              </span>
            </div>
            <span className="amount-box__usd">
              {formatCurrency(amountNumber * token.price)}
            </span>
          </div>

          <div className="lock-options">
            <span>Strategy</span>
            <div>
              {STAKING_OPTIONS.map((option, index) => (
                <button
                  className={optionIndex === index ? "is-active" : ""}
                  type="button"
                  key={option.days}
                  onClick={() => setOptionIndex(index)}
                >
                  <span>{option.label}</span>
                  <strong>{option.days} days</strong>
                  <em>{option.apr}% APR</em>
                </button>
              ))}
            </div>
          </div>

          <div className="reward-preview">
            <div className="reward-preview__ring">
              <span>{selectedOption.apr}%</span>
              <small>APR</small>
            </div>
            <div>
              <span>Projected reward</span>
              <strong>
                +{formatAmount(projectedReward, 6)} {symbol}
              </strong>
              <small>
                {formatCurrency(projectedReward * token.price)} over{" "}
                {selectedOption.days} days
              </small>
            </div>
          </div>

          {error && <p className="form-error">{error}</p>}
          <button
            className="button button--primary button--full staking-submit"
            type="submit"
            disabled={processing}
          >
            {processing
              ? "Activating strategy…"
              : !wallet
                ? "Connect wallet"
                : amountNumber <= 0
                  ? "Enter an amount"
                  : `Stake ${symbol} in sandbox`}
          </button>
        </form>

        <aside className="staking-overview">
          <div className="yield-hero">
            <span className="eyebrow">Your modeled yield</span>
            <strong>{formatCurrency(stakedValue)}</strong>
            <span>Currently staked on {getChain(chainId).name}</span>
            <div className="yield-bars" aria-hidden="true">
              {[36, 49, 43, 68, 60, 84, 76, 96].map((height, index) => (
                <span style={{ height: `${height}%` }} key={index} />
              ))}
            </div>
          </div>
          <div className="staking-benefits">
            <div>
              <span className="benefit-icon">
                <Icon name="activity" size={18} />
              </span>
              <p>
                <strong>Real-time reward model</strong>
                Rewards accrue from the moment each position is created.
              </p>
            </div>
            <div>
              <span className="benefit-icon">
                <Icon name="shield" size={18} />
              </span>
              <p>
                <strong>Safe early exits</strong>
                Test unstaking at any point without a real penalty.
              </p>
            </div>
            <div>
              <span className="benefit-icon">
                <Icon name="network" size={18} />
              </span>
              <p>
                <strong>Chain-specific balances</strong>
                Compare the same strategy across all four networks.
              </p>
            </div>
          </div>
        </aside>
      </div>

      <section className="panel positions-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Rewards center</span>
            <h2>Your active stakes</h2>
          </div>
          <span className="activity-count">{positions.length}</span>
        </div>
        {positions.length ? (
          <div className="position-list">
            {positions.map((position) => {
              const dailyReward = position.amount * (position.apr / 100) / 365;
              const unlockAt =
                position.startedAt + position.lockDays * 24 * 60 * 60 * 1000;
              return (
                <article className="position-row stake-position-row" key={position.id}>
                  <div className="pool-pair">
                    <TokenMark
                      chainId={position.chainId}
                      symbol={position.token}
                    />
                    <span>
                      <strong>{position.token}</strong>
                      <small>{position.lockDays}-day strategy</small>
                    </span>
                  </div>
                  <div>
                    <span>Principal</span>
                    <strong>
                      {formatAmount(position.amount)} {position.token}
                    </strong>
                  </div>
                  <div>
                    <span>Daily rewards</span>
                    <strong className="value-good">
                      +{formatAmount(dailyReward, 6)} {position.token}
                    </strong>
                  </div>
                  <div>
                    <span>Unlock date</span>
                    <strong>
                      {new Intl.DateTimeFormat("en", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      }).format(unlockAt)}
                    </strong>
                  </div>
                  <div className="position-actions">
                    <button
                      className="button button--secondary"
                      type="button"
                      onClick={() => {
                        try {
                          claimStakeRewards(position.id);
                        } catch (actionError) {
                          setError(
                            actionError instanceof Error
                              ? actionError.message
                              : "Rewards are not ready.",
                          );
                        }
                      }}
                    >
                      Claim
                    </button>
                    <button
                      className="button button--ghost"
                      type="button"
                      onClick={() => {
                        try {
                          unstake(position.id);
                        } catch {
                          setWalletModalOpen(true);
                        }
                      }}
                    >
                      Unstake
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-state empty-state--short">
            <span>
              <Icon name="stake" size={24} />
            </span>
            <h3>No active stakes on {getChain(chainId).name}</h3>
            <p>Choose an asset and strategy to start modeling rewards.</p>
          </div>
        )}
      </section>
    </>
  );
}
