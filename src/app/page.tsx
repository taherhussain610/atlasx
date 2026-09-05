"use client";

import { Icon } from "@/components/icons";
import { ChainMark, TokenMark } from "@/components/token-mark";
import { useAtlas } from "@/context/atlas-context";
import {
  CHAINS,
  formatAmount,
  formatCurrency,
  getChain,
  getToken,
} from "@/lib/atlas";
import Link from "next/link";

export default function OverviewPage() {
  const { balances, chainId, activity, liquidityPositions, stakePositions } =
    useAtlas();
  const chain = getChain(chainId);
  const chainBalance = balances[chainId];
  const walletValue = Object.entries(chainBalance).reduce(
    (total, [symbol, amount]) => total + amount * getToken(chainId, symbol).price,
    0,
  );
  const liquidityValue = liquidityPositions.reduce(
    (total, position) => total + position.valueUsd,
    0,
  );
  const stakeValue = stakePositions.reduce(
    (total, position) =>
      total + position.amount * getToken(position.chainId, position.token).price,
    0,
  );
  const volume = activity
    .filter((item) => item.type === "swap")
    .reduce((total, item) => total + item.valueUsd, 0);

  return (
    <div className="page-stack">
      <section className="hero">
        <div className="hero__content">
          <span className="eyebrow">
            <span className="status-dot" />
            Cross-chain strategy lab
          </span>
          <h1>
            Explore every route.
            <br />
            <span>Risk nothing.</span>
          </h1>
          <p>
            Rehearse swaps, liquidity strategies, and staking across four networks
            with a realistic, persistent sandbox portfolio.
          </p>
          <div className="hero__actions">
            <Link className="button button--primary" href="/swap">
              Start trading
              <span aria-hidden="true">→</span>
            </Link>
            <Link className="button button--secondary" href="/network">
              Explore networks
            </Link>
          </div>
        </div>
        <div className="hero__visual" aria-hidden="true">
          <div className="orbit orbit--outer">
            {CHAINS.map((item, index) => (
              <span
                className="orbit__node"
                style={{ "--node-index": index } as React.CSSProperties}
                key={item.id}
              >
                <ChainMark chainId={item.id} />
              </span>
            ))}
          </div>
          <div className="orbit orbit--inner" />
          <div className="hero__core">
            <span className="brand__mark">
              <span />
              <span />
              <span />
            </span>
          </div>
          <div className="route-line route-line--one" />
          <div className="route-line route-line--two" />
        </div>
      </section>

      <section className="metric-grid">
        <article className="metric-card">
          <span className="metric-card__icon metric-card__icon--violet">
            <Icon name="wallet" />
          </span>
          <div>
            <span>Sandbox portfolio</span>
            <strong>{formatCurrency(walletValue + liquidityValue + stakeValue)}</strong>
            <small>{chain.name} selected</small>
          </div>
        </article>
        <article className="metric-card">
          <span className="metric-card__icon metric-card__icon--cyan">
            <Icon name="swap" />
          </span>
          <div>
            <span>Practice volume</span>
            <strong>{formatCurrency(volume)}</strong>
            <small>{activity.filter((item) => item.type === "swap").length} swaps</small>
          </div>
        </article>
        <article className="metric-card">
          <span className="metric-card__icon metric-card__icon--green">
            <Icon name="liquidity" />
          </span>
          <div>
            <span>Liquidity supplied</span>
            <strong>{formatCurrency(liquidityValue)}</strong>
            <small>{liquidityPositions.length} active positions</small>
          </div>
        </article>
        <article className="metric-card">
          <span className="metric-card__icon metric-card__icon--amber">
            <Icon name="stake" />
          </span>
          <div>
            <span>Assets staked</span>
            <strong>{formatCurrency(stakeValue)}</strong>
            <small>{stakePositions.length} active stakes</small>
          </div>
        </article>
      </section>

      <div className="dashboard-grid">
        <section className="panel portfolio-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Current network</span>
              <h2>Your sandbox assets</h2>
            </div>
            <Link href="/swap" className="text-link">
              Trade assets <span>→</span>
            </Link>
          </div>
          <div className="asset-list">
            {Object.entries(chainBalance).map(([symbol, amount]) => {
              const token = getToken(chainId, symbol);
              return (
                <div className="asset-row" key={symbol}>
                  <TokenMark chainId={chainId} symbol={symbol} />
                  <div className="asset-row__name">
                    <strong>{symbol}</strong>
                    <span>{token.name}</span>
                  </div>
                  <div className="asset-row__amount">
                    <strong>{formatAmount(amount)}</strong>
                    <span>{formatCurrency(amount * token.price)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Live journal</span>
              <h2>Recent activity</h2>
            </div>
            <span className="activity-count">{activity.length}</span>
          </div>
          {activity.length ? (
            <div className="activity-list">
              {activity.slice(0, 5).map((item) => (
                <div className="activity-row" key={item.id}>
                  <span className={`activity-icon activity-icon--${item.type}`}>
                    <Icon
                      name={
                        item.type === "liquidity"
                          ? "liquidity"
                          : item.type === "stake"
                            ? "stake"
                            : item.type === "reward"
                              ? "sparkles"
                              : "swap"
                      }
                      size={17}
                    />
                  </span>
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.detail}</span>
                  </div>
                  <div className="activity-row__meta">
                    <ChainMark chainId={item.chainId} size="small" />
                    <time dateTime={new Date(item.timestamp).toISOString()}>
                      {new Intl.DateTimeFormat("en", {
                        hour: "numeric",
                        minute: "2-digit",
                      }).format(item.timestamp)}
                    </time>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <span>
                <Icon name="activity" size={26} />
              </span>
              <h3>Your strategy journal is ready</h3>
              <p>Completed sandbox actions will appear here.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
