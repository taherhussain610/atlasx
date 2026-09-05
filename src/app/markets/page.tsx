"use client";

import { Icon } from "@/components/icons";
import {
  MARKET_ASSETS,
  MarketAsset,
  MarketSnapshot,
  formatMarketPrice,
} from "@/lib/markets";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./markets.module.css";

type MarketFilter = "all" | "watchlist" | "layer-1" | "stablecoin" | "platform";
type ChartRange = "1H" | "1D" | "1W" | "1M";

const FILTERS: Array<{ id: MarketFilter; label: string }> = [
  { id: "all", label: "All markets" },
  { id: "watchlist", label: "Watchlist" },
  { id: "layer-1", label: "Layer 1" },
  { id: "stablecoin", label: "Stablecoins" },
  { id: "platform", label: "AtlasX" },
];

const CHART_RANGES: ChartRange[] = ["1H", "1D", "1W", "1M"];
const WATCHLIST_KEY = "atlasx-market-watchlist-v1";

async function fetchMarkets(signal?: AbortSignal): Promise<MarketSnapshot> {
  const response = await fetch("/api/markets", { cache: "no-store", signal });
  if (!response.ok) throw new Error("Market data is temporarily unavailable.");
  return (await response.json()) as MarketSnapshot;
}

function buildSeries(market: MarketAsset, range: ChartRange): number[] {
  const seed = market.id
    .split("")
    .reduce((total, character) => total + character.charCodeAt(0), 0);
  const rangeScale = { "1H": 0.28, "1D": 1, "1W": 1.9, "1M": 3.2 }[range];
  const change = (market.change24h / 100) * rangeScale;
  const opening = market.price / Math.max(1 + change, 0.1);

  return Array.from({ length: 48 }, (_, index) => {
    const progress = index / 47;
    const wave =
      Math.sin(progress * 12 + seed) * 0.006 * rangeScale +
      Math.cos(progress * 25 + seed / 3) * 0.003 * rangeScale;
    const value = opening + (market.price - opening) * progress;
    return Math.max(value * (1 + wave * Math.sin(progress * Math.PI)), 0);
  });
}

function chartPath(values: number[], width: number, height: number): string {
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const spread = Math.max(maximum - minimum, maximum * 0.005, 0.00001);

  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - minimum) / spread) * height;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

export default function MarketsPage() {
  const [markets, setMarkets] = useState(MARKET_ASSETS);
  const [source, setSource] = useState<MarketSnapshot["source"]>("sandbox");
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<MarketFilter>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("bnb");
  const [range, setRange] = useState<ChartRange>("1D");
  const [watchlist, setWatchlist] = useState<string[]>(["bnb", "solana", "atlasx"]);
  const [sessionStartedAt] = useState(() => Date.now());

  const loadMarkets = async (signal?: AbortSignal) => {
    setRefreshing(true);
    setError(null);
    try {
      const snapshot = await fetchMarkets(signal);
      setMarkets(snapshot.markets);
      setSource(snapshot.source);
      setUpdatedAt(snapshot.updatedAt);
    } catch (requestError) {
      if ((requestError as { name?: string }).name === "AbortError") return;
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Market data is temporarily unavailable.",
      );
    } finally {
      if (!signal?.aborted) setRefreshing(false);
    }
  };

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(WATCHLIST_KEY);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
          queueMicrotask(() => setWatchlist(parsed));
        }
      }
    } catch {
      window.localStorage.removeItem(WATCHLIST_KEY);
    }

    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void loadMarkets(controller.signal);
    });
    return () => controller.abort();
  }, []);

  const selected = markets.find((market) => market.id === selectedId) ?? markets[0];
  const normalizedQuery = query.trim().toLowerCase();
  const filteredMarkets = markets.filter((market) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "watchlist"
        ? watchlist.includes(market.id)
        : market.category === filter);
    const matchesQuery =
      !normalizedQuery ||
      market.name.toLowerCase().includes(normalizedQuery) ||
      market.symbol.toLowerCase().includes(normalizedQuery);
    return matchesFilter && matchesQuery;
  });
  const marketCap = markets.reduce((total, market) => total + market.marketCap, 0);
  const volume = markets.reduce((total, market) => total + market.volume24h, 0);
  const gainers = markets.filter((market) => market.change24h >= 0).length;
  const series = useMemo(() => buildSeries(selected, range), [range, selected]);
  const line = chartPath(series, 720, 218);
  const area = `${line} L 720 218 L 0 218 Z`;
  const positive = selected.change24h >= 0;

  const toggleWatchlist = (marketId: string) => {
    setWatchlist((current) => {
      const next = current.includes(marketId)
        ? current.filter((item) => item !== marketId)
        : [...current, marketId];
      window.localStorage.setItem(WATCHLIST_KEY, JSON.stringify(next));
      return next;
    });
  };

  const orderBook = Array.from({ length: 5 }, (_, index) => {
    const distance = (index + 1) * Math.max(selected.price * 0.0008, 0.00001);
    return {
      ask: selected.price + distance,
      bid: Math.max(selected.price - distance, 0),
      askSize: ((index + 2) * 173.42 * (selected.price < 2 ? 18 : 1)) / (index + 1),
      bidSize: ((index + 3) * 146.18 * (selected.price < 2 ? 19 : 1)) / (index + 1),
    };
  });

  return (
    <div className="flow-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Market intelligence</span>
          <h1>Trading workspace</h1>
          <p>Monitor live prices, compare liquidity, and inspect sandbox depth.</p>
        </div>
        <div className={styles.feedStatus}>
          <span className="status-dot" />
          <span>
            <strong>{source === "coingecko" ? "Live market feed" : "Sandbox feed"}</strong>
            <small>
              {updatedAt
                ? `Updated ${new Intl.DateTimeFormat("en", {
                    hour: "numeric",
                    minute: "2-digit",
                  }).format(updatedAt)}`
                : "Connecting…"}
            </small>
          </span>
          <button
            className="icon-button"
            type="button"
            aria-label="Refresh market data"
            disabled={refreshing}
            onClick={() => void loadMarkets()}
          >
            <Icon name="reset" size={15} />
          </button>
        </div>
      </header>

      <section className={styles.marketMetrics} aria-label="Market summary">
        <div>
          <span>Tracked market cap</span>
          <strong>{formatCompactCurrency(marketCap)}</strong>
          <small>Across {markets.length} assets</small>
        </div>
        <div>
          <span>24h volume</span>
          <strong>{formatCompactCurrency(volume)}</strong>
          <small>Live and modeled venues</small>
        </div>
        <div>
          <span>Advancing assets</span>
          <strong>
            {gainers}/{markets.length}
          </strong>
          <small>{Math.round((gainers / markets.length) * 100)}% market breadth</small>
        </div>
        <div>
          <span>AtlasX liquidity</span>
          <strong>
            {formatCompactCurrency(
              markets.reduce((total, market) => total + market.liquidity, 0),
            )}
          </strong>
          <small>Sandbox route depth</small>
        </div>
      </section>

      {error && <p className="form-error">{error} Showing the last sandbox snapshot.</p>}

      <div className={styles.workspace}>
        <section className={`panel ${styles.marketPanel}`}>
          <div className={styles.marketToolbar}>
            <div className={styles.filterTabs} role="tablist" aria-label="Market filter">
              {FILTERS.map((item) => (
                <button
                  className={filter === item.id ? styles.activeTab : ""}
                  type="button"
                  role="tab"
                  aria-selected={filter === item.id}
                  key={item.id}
                  onClick={() => setFilter(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <label className={styles.search}>
              <Icon name="search" size={15} />
              <span className={styles.srOnly}>Search markets</span>
              <input
                type="search"
                placeholder="Search asset"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          </div>

          <div className={styles.tableScroll}>
            <table className={styles.marketTable}>
              <thead>
                <tr>
                  <th aria-label="Watchlist" />
                  <th>Asset</th>
                  <th>Price</th>
                  <th>24h</th>
                  <th>Market cap</th>
                  <th>Volume</th>
                  <th>Route depth</th>
                  <th aria-label="Action" />
                </tr>
              </thead>
              <tbody>
                {filteredMarkets.map((market) => {
                  const watched = watchlist.includes(market.id);
                  return (
                    <tr
                      className={market.id === selected.id ? styles.selectedRow : ""}
                      key={market.id}
                      onClick={() => setSelectedId(market.id)}
                    >
                      <td>
                        <button
                          className={`${styles.star} ${watched ? styles.starred : ""}`}
                          type="button"
                          aria-label={`${watched ? "Remove" : "Add"} ${market.name} ${
                            watched ? "from" : "to"
                          } watchlist`}
                          aria-pressed={watched}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleWatchlist(market.id);
                          }}
                        >
                          ★
                        </button>
                      </td>
                      <td>
                        <span className={styles.assetCell}>
                          <span
                            className={styles.assetMark}
                            style={{ "--asset-accent": market.accent } as React.CSSProperties}
                          >
                            {market.symbol.slice(0, 1)}
                          </span>
                          <span>
                            <strong>{market.symbol}</strong>
                            <small>{market.name}</small>
                          </span>
                        </span>
                      </td>
                      <td>
                        <strong>{formatMarketPrice(market.price)}</strong>
                      </td>
                      <td>
                        <strong className={market.change24h >= 0 ? "value-good" : "value-warning"}>
                          {formatChange(market.change24h)}
                        </strong>
                      </td>
                      <td>{formatCompactCurrency(market.marketCap)}</td>
                      <td>{formatCompactCurrency(market.volume24h)}</td>
                      <td>{formatCompactCurrency(market.liquidity)}</td>
                      <td>
                        <Link
                          className={styles.tradeLink}
                          href="/swap"
                          onClick={(event) => event.stopPropagation()}
                        >
                          Trade
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!filteredMarkets.length && (
              <div className={styles.noResults}>
                <Icon name="search" size={20} />
                <strong>No matching markets</strong>
                <span>Change the filter or search phrase.</span>
              </div>
            )}
          </div>
        </section>

        <aside className={`panel ${styles.marketDetail}`}>
          <div className={styles.detailHeading}>
            <span className={styles.assetCell}>
              <span
                className={`${styles.assetMark} ${styles.assetMarkLarge}`}
                style={{ "--asset-accent": selected.accent } as React.CSSProperties}
              >
                {selected.symbol.slice(0, 1)}
              </span>
              <span>
                <strong>
                  {selected.symbol}
                  <small>/ USD</small>
                </strong>
                <small>{selected.name}</small>
              </span>
            </span>
            <Link className="button button--primary" href="/swap">
              Open trade
            </Link>
          </div>
          <div className={styles.priceRow}>
            <div>
              <strong>{formatMarketPrice(selected.price)}</strong>
              <span className={positive ? "value-good" : "value-warning"}>
                {formatChange(selected.change24h)} today
              </span>
            </div>
            <div className={styles.rangeTabs} aria-label="Chart range">
              {CHART_RANGES.map((item) => (
                <button
                  className={range === item ? styles.activeRange : ""}
                  type="button"
                  key={item}
                  onClick={() => setRange(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className={`${styles.chart} ${positive ? styles.chartPositive : styles.chartNegative}`}>
            <svg
              role="img"
              aria-label={`${selected.name} ${range} modeled price chart`}
              viewBox="0 0 720 240"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="market-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[40, 90, 140, 190].map((y) => (
                <line x1="0" x2="720" y1={y} y2={y} key={y} />
              ))}
              <path className={styles.chartArea} d={area} />
              <path className={styles.chartLine} d={line} />
              <circle cx="720" cy={lineEndY(series, 218)} r="4" />
            </svg>
          </div>
          <div className={styles.detailStats}>
            <div>
              <span>24h high</span>
              <strong>{formatMarketPrice(selected.price * (1 + Math.abs(selected.change24h) / 160))}</strong>
            </div>
            <div>
              <span>24h low</span>
              <strong>{formatMarketPrice(selected.price * (1 - Math.abs(selected.change24h) / 140))}</strong>
            </div>
            <div>
              <span>Volume</span>
              <strong>{formatCompactCurrency(selected.volume24h)}</strong>
            </div>
            <div>
              <span>Route depth</span>
              <strong>{formatCompactCurrency(selected.liquidity)}</strong>
            </div>
          </div>
        </aside>
      </div>

      <div className={styles.depthGrid}>
        <section className={`panel ${styles.depthPanel}`}>
          <div className="panel-heading panel-heading--compact">
            <div>
              <span className="eyebrow">Liquidity map</span>
              <h2>Order book</h2>
            </div>
            <span className="status-chip status-chip--success">
              <span className="status-dot" />
              Simulated
            </span>
          </div>
          <div className={styles.bookHeader}>
            <span>Price (USD)</span>
            <span>Size ({selected.symbol})</span>
            <span>Total</span>
          </div>
          <div className={styles.bookRows}>
            {[...orderBook].reverse().map((row, index) => (
              <div className={styles.askRow} key={`ask-${index}`}>
                <strong>{formatBookPrice(row.ask)}</strong>
                <span>{formatBookSize(row.askSize)}</span>
                <span>{formatCompactCurrency(row.ask * row.askSize)}</span>
                <i style={{ width: `${30 + index * 12}%` }} />
              </div>
            ))}
            <div className={styles.spreadRow}>
              <strong>{formatMarketPrice(selected.price)}</strong>
              <span>
                Spread {selected.price >= 1 ? "0.08%" : "0.02%"}
              </span>
            </div>
            {orderBook.map((row, index) => (
              <div className={styles.bidRow} key={`bid-${index}`}>
                <strong>{formatBookPrice(row.bid)}</strong>
                <span>{formatBookSize(row.bidSize)}</span>
                <span>{formatCompactCurrency(row.bid * row.bidSize)}</span>
                <i style={{ width: `${78 - index * 10}%` }} />
              </div>
            ))}
          </div>
        </section>

        <section className={`panel ${styles.depthPanel}`}>
          <div className="panel-heading panel-heading--compact">
            <div>
              <span className="eyebrow">Execution tape</span>
              <h2>Recent trades</h2>
            </div>
            <span className={styles.livePill}>Live model</span>
          </div>
          <div className={styles.tradeHead}>
            <span>Time</span>
            <span>Price</span>
            <span>Amount</span>
            <span>Value</span>
          </div>
          <div className={styles.tradeRows}>
            {Array.from({ length: 8 }, (_, index) => {
              const isBuy = index % 3 !== 1;
              const price = selected.price * (1 + (isBuy ? 1 : -1) * index * 0.00013);
              const amount = ((index + 2) * 37.42) / Math.max(selected.price / 100, 0.5);
              return (
                <div key={index}>
                  <time>
                    {new Intl.DateTimeFormat("en", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    }).format((updatedAt ?? sessionStartedAt) - index * 17_000)}
                  </time>
                  <strong className={isBuy ? "value-good" : "value-warning"}>
                    {formatBookPrice(price)}
                  </strong>
                  <span>{formatBookSize(amount)}</span>
                  <span>{formatCompactCurrency(amount * price)}</span>
                </div>
              );
            })}
          </div>
          <div className={styles.dataNote}>
            <Icon name="shield" size={16} />
            <span>
              Live reference prices are supplied server-side by CoinGecko. Order book
              depth and trade tape remain deterministic sandbox models.
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}

function formatCompactCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatChange(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatBookPrice(value: number): string {
  return value >= 100 ? value.toFixed(2) : value >= 1 ? value.toFixed(3) : value.toFixed(5);
}

function formatBookSize(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(value);
}

function lineEndY(values: number[], height: number): number {
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const spread = Math.max(maximum - minimum, maximum * 0.005, 0.00001);
  return height - ((values[values.length - 1] - minimum) / spread) * height;
}
