"use client";

import { Icon } from "@/components/icons";
import { TokenMark } from "@/components/token-mark";
import { SandboxOrder, useAtlas } from "@/context/atlas-context";
import {
  ChainId,
  formatAmount,
  formatCurrency,
  getChain,
  getToken,
  TOKENS,
} from "@/lib/atlas";
import { FormEvent, useState } from "react";
import styles from "./advanced-order-desk.module.css";

export function AdvancedOrderDesk({
  chainId,
  kind,
}: {
  chainId: ChainId;
  kind: "limit" | "dca";
}) {
  const {
    balances,
    wallet,
    isWalletCompatible,
    orders,
    setWalletModalOpen,
    createOrder,
    executeOrder,
    cancelOrder,
  } = useAtlas();
  const tokens = TOKENS[chainId];
  const [fromToken, setFromToken] = useState(tokens[0].symbol);
  const [toToken, setToToken] = useState(tokens[1].symbol);
  const initialRate = getToken(chainId, fromToken).price / getToken(chainId, toToken).price;
  const [amount, setAmount] = useState("");
  const [targetRate, setTargetRate] = useState(initialRate.toFixed(6));
  const [intervalDays, setIntervalDays] = useState("7");
  const [executions, setExecutions] = useState("6");
  const [error, setError] = useState<string | null>(null);
  const chainOrders = orders.filter((order) => order.chainId === chainId);
  const amountNumber = Number(amount) || 0;
  const currentRate =
    getToken(chainId, fromToken).price / getToken(chainId, toToken).price;
  const targetRateNumber = Number(targetRate) || 0;
  const executionCount = Math.max(Math.trunc(Number(executions) || 0), 0);
  const projectedOutput =
    amountNumber * (kind === "limit" ? targetRateNumber : currentRate) * 0.997;
  const available = balances[chainId][fromToken] ?? 0;

  const resetRate = (nextFrom: string, nextTo: string) => {
    const rate = getToken(chainId, nextFrom).price / getToken(chainId, nextTo).price;
    setTargetRate(rate.toFixed(6));
  };

  const updateFromToken = (next: string) => {
    const nextTo = next === toToken ? fromToken : toToken;
    setFromToken(next);
    setToToken(nextTo);
    resetRate(next, nextTo);
    setError(null);
  };

  const updateToToken = (next: string) => {
    const nextFrom = next === fromToken ? toToken : fromToken;
    setFromToken(nextFrom);
    setToToken(next);
    resetRate(nextFrom, next);
    setError(null);
  };

  const switchPair = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    resetRate(toToken, fromToken);
    setError(null);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!wallet || !isWalletCompatible) {
      setWalletModalOpen(true);
      setError(`Connect a compatible wallet for ${getChain(chainId).name}.`);
      return;
    }
    try {
      createOrder({
        kind,
        fromToken,
        toToken,
        amount: amountNumber,
        targetRate: targetRateNumber,
        intervalDays: Number(intervalDays),
        totalExecutions: executionCount,
      });
      setAmount("");
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : "The order could not be created.",
      );
    }
  };

  const runAction = (action: "execute" | "cancel", order: SandboxOrder) => {
    setError(null);
    try {
      if (action === "execute") executeOrder(order.id);
      else cancelOrder(order.id);
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : "The order could not be updated.",
      );
    }
  };

  return (
    <div className={styles.layout}>
      <form className={styles.ticket} onSubmit={handleSubmit}>
        <div className={styles.ticketHeading}>
          <div>
            <span className="eyebrow">
              {kind === "limit" ? "Price-triggered execution" : "Scheduled accumulation"}
            </span>
            <h2>{kind === "limit" ? "Create limit order" : "Build DCA plan"}</h2>
          </div>
          <span className={styles.orderBadge}>{kind.toUpperCase()}</span>
        </div>

        <div className={styles.pairGrid}>
          <TokenPicker
            label="Pay with"
            chainId={chainId}
            symbol={fromToken}
            tokens={tokens}
            onChange={updateFromToken}
          />
          <button
            className={styles.switchPair}
            type="button"
            aria-label="Switch order assets"
            onClick={switchPair}
          >
            <Icon name="swap" size={16} />
          </button>
          <TokenPicker
            label="Receive"
            chainId={chainId}
            symbol={toToken}
            tokens={tokens}
            onChange={updateToToken}
          />
        </div>

        <label className={styles.field}>
          <span>
            <strong>{kind === "dca" ? "Amount per execution" : "Order amount"}</strong>
            <small>
              Balance {formatAmount(available)} {fromToken}
            </small>
          </span>
          <div>
            <input
              inputMode="decimal"
              placeholder="0.0"
              value={amount}
              onChange={(event) => {
                if (/^\d*\.?\d*$/.test(event.target.value)) setAmount(event.target.value);
                setError(null);
              }}
            />
            <button type="button" onClick={() => setAmount(String(available))}>
              Max
            </button>
            <strong>{fromToken}</strong>
          </div>
          <small>{formatCurrency(amountNumber * getToken(chainId, fromToken).price)}</small>
        </label>

        {kind === "limit" ? (
          <label className={styles.field}>
            <span>
              <strong>Target rate</strong>
              <small>
                Market {formatAmount(currentRate, 6)} {toToken}
              </small>
            </span>
            <div>
              <input
                inputMode="decimal"
                aria-label={`Target ${toToken} per ${fromToken}`}
                value={targetRate}
                onChange={(event) => {
                  if (/^\d*\.?\d*$/.test(event.target.value)) {
                    setTargetRate(event.target.value);
                  }
                  setError(null);
                }}
              />
              <strong>{toToken}</strong>
            </div>
            <small>
              {targetRateNumber > 0
                ? `${formatSignedPercent((targetRateNumber / currentRate - 1) * 100)} from market`
                : "Enter a target rate"}
            </small>
          </label>
        ) : (
          <div className={styles.scheduleGrid}>
            <label className={styles.field}>
              <span>
                <strong>Frequency</strong>
                <small>Between executions</small>
              </span>
              <div>
                <select
                  value={intervalDays}
                  onChange={(event) => setIntervalDays(event.target.value)}
                >
                  <option value="1">Daily</option>
                  <option value="7">Weekly</option>
                  <option value="14">Every 2 weeks</option>
                  <option value="30">Monthly</option>
                </select>
              </div>
            </label>
            <label className={styles.field}>
              <span>
                <strong>Executions</strong>
                <small>2–24 tranches</small>
              </span>
              <div>
                <input
                  type="number"
                  min="2"
                  max="24"
                  step="1"
                  value={executions}
                  onChange={(event) => setExecutions(event.target.value)}
                />
              </div>
            </label>
          </div>
        )}

        <div className={styles.preview}>
          <div>
            <span>Projected output</span>
            <strong>
              {formatAmount(projectedOutput, 6)} {toToken}
            </strong>
          </div>
          <div>
            <span>{kind === "limit" ? "Execution fee" : "Modeled budget"}</span>
            <strong>
              {kind === "limit"
                ? "0.30%"
                : `${formatAmount(amountNumber * executionCount)} ${fromToken}`}
            </strong>
          </div>
          <div>
            <span>Settlement</span>
            <strong>Sandbox only</strong>
          </div>
        </div>

        {error && <p className="form-error">{error}</p>}
        <button className="button button--primary button--full" type="submit">
          {!wallet
            ? "Connect wallet"
            : !isWalletCompatible
              ? "Switch wallet"
              : kind === "limit"
                ? "Place limit order"
                : "Activate DCA plan"}
        </button>
        <p className={styles.disclaimer}>
          <Icon name="shield" size={13} />
          Orders execute only when you trigger the next sandbox fill.
        </p>
      </form>

      <section className={`panel ${styles.ordersPanel}`}>
        <div className="panel-heading panel-heading--compact">
          <div>
            <span className="eyebrow">Execution manager</span>
            <h2>Orders on {getChain(chainId).name}</h2>
          </div>
          <span className="activity-count">{chainOrders.length}</span>
        </div>
        {chainOrders.length ? (
          <div className={styles.orderList}>
            <div className={styles.orderHead}>
              <span>Order</span>
              <span>Size</span>
              <span>Condition</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {chainOrders.map((order) => {
              const active = order.status === "open" || order.status === "active";
              return (
                <article className={styles.orderRow} key={order.id}>
                  <div className={styles.orderPair}>
                    <span>
                      <TokenMark chainId={chainId} symbol={order.fromToken} size="small" />
                      <TokenMark chainId={chainId} symbol={order.toToken} size="small" />
                    </span>
                    <span>
                      <strong>
                        {order.fromToken}/{order.toToken}
                      </strong>
                      <small>{order.kind.toUpperCase()}</small>
                    </span>
                  </div>
                  <div>
                    <strong>
                      {formatAmount(order.amount)} {order.fromToken}
                    </strong>
                    <small>{formatCurrency(order.amount * getToken(chainId, order.fromToken).price)}</small>
                  </div>
                  <div>
                    <strong>
                      {order.kind === "limit"
                        ? `${formatAmount(order.targetRate ?? 0, 6)} ${order.toToken}`
                        : `Every ${order.intervalDays}d`}
                    </strong>
                    <small>
                      {order.completedExecutions}/{order.totalExecutions} fills
                    </small>
                  </div>
                  <span className={`${styles.status} ${styles[`status${capitalize(order.status)}`]}`}>
                    {order.status}
                  </span>
                  <div className={styles.orderActions}>
                    {active && (
                      <>
                        <button
                          type="button"
                          onClick={() => runAction("execute", order)}
                        >
                          {order.kind === "limit" ? "Simulate fill" : "Run next"}
                        </button>
                        <button
                          className={styles.cancel}
                          type="button"
                          onClick={() => runAction("cancel", order)}
                        >
                          Cancel
                        </button>
                      </>
                    )}
                    {!active && <span>Completed</span>}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <span>
              <Icon name="activity" size={24} />
            </span>
            <h3>No advanced orders yet</h3>
            <p>Create a limit order or DCA plan to start modeling execution.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function TokenPicker({
  label,
  chainId,
  symbol,
  tokens,
  onChange,
}: {
  label: string;
  chainId: ChainId;
  symbol: string;
  tokens: Array<{ symbol: string; name: string }>;
  onChange: (symbol: string) => void;
}) {
  return (
    <label className={styles.tokenPicker}>
      <span>{label}</span>
      <div>
        <TokenMark chainId={chainId} symbol={symbol} />
        <span>
          <strong>{symbol}</strong>
          <small>{getToken(chainId, symbol).name}</small>
        </span>
        <select
          aria-label={`${label} token`}
          value={symbol}
          onChange={(event) => onChange(event.target.value)}
        >
          {tokens.map((token) => (
            <option value={token.symbol} key={token.symbol}>
              {token.symbol}
            </option>
          ))}
        </select>
        <Icon name="chevron" size={14} />
      </div>
    </label>
  );
}

function formatSignedPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function capitalize(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
