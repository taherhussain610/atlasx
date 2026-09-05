"use client";

import { Icon } from "@/components/icons";
import { ChainMark } from "@/components/token-mark";
import { useAtlas } from "@/context/atlas-context";
import { CHAINS, ChainId, formatAmount, getChain } from "@/lib/atlas";
import { useEffect, useState } from "react";

type GatewayStatus = {
  configured: boolean;
  healthy: boolean;
  source: "sandbox" | "tatum";
  blockNumber: number | null;
  latencyMs: number | null;
};

type RequestState = {
  loading: boolean;
  data: GatewayStatus | null;
};

async function fetchGatewayStatus(signal?: AbortSignal): Promise<GatewayStatus> {
  const response = await fetch("/api/network/status", {
    cache: "no-store",
    signal,
  });
  return (await response.json()) as GatewayStatus;
}

const NETWORK_METRICS: Record<
  ChainId,
  { blockTime: string; validators: string; finality: string; routeCount: number }
> = {
  bnb: { blockTime: "0.75 sec", validators: "21", finality: "~3 sec", routeCount: 18 },
  tron: { blockTime: "3 sec", validators: "27", finality: "~1 min", routeCount: 14 },
  solana: { blockTime: "0.4 sec", validators: "1,300+", finality: "~13 sec", routeCount: 22 },
  abstract: { blockTime: "1 sec", validators: "ZK rollup", finality: "~1 sec", routeCount: 12 },
};

export default function NetworkPage() {
  const { chainId, selectChain } = useAtlas();
  const [request, setRequest] = useState<RequestState>({
    loading: true,
    data: null,
  });

  const loadGatewayStatus = async () => {
    setRequest((current) => ({ ...current, loading: true }));
    try {
      const data = await fetchGatewayStatus();
      setRequest({ loading: false, data });
    } catch {
      setRequest({
        loading: false,
        data: {
          configured: true,
          healthy: false,
          source: "tatum",
          blockNumber: null,
          latencyMs: null,
        },
      });
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void fetchGatewayStatus(controller.signal)
      .then((data) => setRequest({ loading: false, data }))
      .catch((error: unknown) => {
        if ((error as { name?: string }).name === "AbortError") return;
        setRequest({
          loading: false,
          data: {
            configured: true,
            healthy: false,
            source: "tatum",
            blockNumber: null,
            latencyMs: null,
          },
        });
      });
    return () => controller.abort();
  }, []);

  const selectedChain = getChain(chainId);
  const selectedMetrics = NETWORK_METRICS[chainId];
  const gateway = request.data;

  return (
    <div className="flow-page network-page">
      <header className="page-header">
        <div>
          <span className="eyebrow">Network command center</span>
          <h1>One router, four ecosystems</h1>
          <p>Inspect sandbox environments and verify the server-side RPC connection.</p>
        </div>
        <div className="network-health-summary">
          <span className="network-health-summary__dots">
            {CHAINS.map((chain) => (
              <i style={{ "--dot-color": chain.accent } as React.CSSProperties} key={chain.id} />
            ))}
          </span>
          <span>
            <strong>4 networks operational</strong>
            Sandbox routing is ready
          </span>
        </div>
      </header>

      <section className="network-card-grid">
        {CHAINS.map((chain) => {
          const metrics = NETWORK_METRICS[chain.id];
          const active = chain.id === chainId;
          return (
            <button
              className={`network-card ${active ? "is-active" : ""}`}
              type="button"
              key={chain.id}
              onClick={() => void selectChain(chain.id)}
            >
              <div className="network-card__top">
                <ChainMark chainId={chain.id} size="large" />
                <span className="status-chip status-chip--success">
                  <span className="status-dot" />
                  Online
                </span>
              </div>
              <div className="network-card__name">
                <strong>{chain.name}</strong>
                <span>{chain.network}</span>
              </div>
              <div className="network-card__stats">
                <span>
                  <small>Block time</small>
                  <strong>{metrics.blockTime}</strong>
                </span>
                <span>
                  <small>Routes</small>
                  <strong>{metrics.routeCount}</strong>
                </span>
              </div>
              <span className="network-card__select">
                {active ? "Selected" : "Select network"}
                <span>→</span>
              </span>
            </button>
          );
        })}
      </section>

      <div className="network-detail-grid">
        <section className="panel network-detail">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Selected environment</span>
              <h2>{selectedChain.name}</h2>
            </div>
            <ChainMark chainId={chainId} />
          </div>
          <div className="network-detail__body">
            <div className="network-ident">
              <div className="network-ident__graphic" aria-hidden="true">
                <span />
                <span />
                <span />
                <ChainMark chainId={chainId} size="large" />
              </div>
              <div>
                <span className="status-chip status-chip--success">
                  <span className="status-dot" />
                  Sandbox online
                </span>
                <h3>{selectedChain.network}</h3>
                <p>
                  Practice routes mirror the token and execution model for{" "}
                  {selectedChain.name}, while keeping every action off-chain.
                </p>
              </div>
            </div>
            <div className="detail-stat-grid">
              <div>
                <span>Native asset</span>
                <strong>{selectedChain.nativeSymbol}</strong>
              </div>
              <div>
                <span>Block time</span>
                <strong>{selectedMetrics.blockTime}</strong>
              </div>
              <div>
                <span>Finality</span>
                <strong>{selectedMetrics.finality}</strong>
              </div>
              <div>
                <span>Validators</span>
                <strong>{selectedMetrics.validators}</strong>
              </div>
            </div>
            <a
              className="button button--secondary button--full"
              href={selectedChain.explorerUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open testnet explorer
              <Icon name="external" size={14} />
            </a>
          </div>
        </section>

        <section className="panel gateway-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Server-side connection</span>
              <h2>Tatum JSON-RPC gateway</h2>
            </div>
            <button
              className="icon-button"
              type="button"
              aria-label="Refresh RPC status"
              disabled={request.loading}
              onClick={() => void loadGatewayStatus()}
            >
              <Icon name="reset" size={16} />
            </button>
          </div>
          <div className="gateway-panel__body">
            <div
              className={`gateway-status ${
                gateway?.healthy ? "gateway-status--healthy" : "gateway-status--offline"
              }`}
            >
              <div className="gateway-status__pulse">
                <span />
                <Icon name="network" size={27} />
              </div>
              <div>
                <span className="eyebrow">
                  {request.loading
                    ? "Checking gateway"
                    : gateway?.healthy
                      ? "Connection healthy"
                      : "Connection unavailable"}
                </span>
                <h3>
                  {request.loading
                    ? "Running eth_blockNumber…"
                    : gateway?.configured
                      ? gateway.healthy
                        ? "RPC responded successfully"
                        : "RPC needs attention"
                      : "Sandbox-only mode"}
                </h3>
                <p>
                  {gateway?.configured
                    ? "The API key remains on the server and is never sent to the browser."
                    : "Add server environment variables to enable live block-height checks."}
                </p>
              </div>
            </div>
            <div className="gateway-metrics">
              <div>
                <span>Latest block</span>
                <strong>
                  {request.loading
                    ? "—"
                    : gateway?.blockNumber
                      ? `#${formatAmount(gateway.blockNumber, 0)}`
                      : "Not configured"}
                </strong>
              </div>
              <div>
                <span>Response time</span>
                <strong>
                  {gateway?.latencyMs !== null && gateway?.latencyMs !== undefined
                    ? `${gateway.latencyMs} ms`
                    : "—"}
                </strong>
              </div>
              <div>
                <span>Method</span>
                <strong>eth_blockNumber</strong>
              </div>
              <div>
                <span>Credential exposure</span>
                <strong className="value-good">Server only</strong>
              </div>
            </div>
            <div className="gateway-code">
              <div>
                <span className="code-dot code-dot--red" />
                <span className="code-dot code-dot--amber" />
                <span className="code-dot code-dot--green" />
                <small>RPC request</small>
              </div>
              <code>
                <span>&#123;</span>
                <span>&nbsp;&nbsp;&quot;jsonrpc&quot;: &quot;2.0&quot;,</span>
                <span>&nbsp;&nbsp;&quot;method&quot;: &quot;eth_blockNumber&quot;</span>
                <span>&#125;</span>
              </code>
            </div>
          </div>
        </section>
      </div>

      <section className="network-safety">
        <Icon name="shield" size={21} />
        <div>
          <strong>Sandbox boundary enforced</strong>
          <span>
            Portfolio actions are stored only in this browser. The RPC route is
            read-only and accepts no methods or parameters from clients.
          </span>
        </div>
      </section>
    </div>
  );
}
