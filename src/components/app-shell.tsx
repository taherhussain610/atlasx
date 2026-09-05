"use client";

import { AtlasLogo, Icon } from "@/components/icons";
import { ChainMark } from "@/components/token-mark";
import {
  supportedChains,
  useAtlas,
  walletLabel,
} from "@/context/atlas-context";
import { CHAINS, ChainId, getChain, shortenAddress, WalletKind } from "@/lib/atlas";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";

const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: "overview" },
  { href: "/swap", label: "Swap", icon: "swap" },
  { href: "/liquidity", label: "Liquidity", icon: "liquidity" },
  { href: "/staking", label: "Staking", icon: "stake" },
  { href: "/network", label: "Network", icon: "network" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const {
    chainId,
    wallet,
    walletModalOpen,
    toast,
    setWalletModalOpen,
    selectChain,
    resetSandbox,
  } = useAtlas();
  const [networkOpen, setNetworkOpen] = useState(false);
  const chain = getChain(chainId);

  useEffect(() => {
    setNetworkOpen(false);
  }, [pathname]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="sidebar__brand" aria-label="AtlasX overview">
          <AtlasLogo />
        </Link>
        <nav className="sidebar__nav" aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                href={item.href}
                className={`nav-link ${active ? "nav-link--active" : ""}`}
                key={item.href}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar__footer">
          <div className="sandbox-card">
            <span className="sandbox-card__icon">
              <Icon name="sparkles" size={17} />
            </span>
            <div>
              <strong>Sandbox mode</strong>
              <span>No real funds at risk</span>
            </div>
          </div>
          <button className="text-button" type="button" onClick={resetSandbox}>
            <Icon name="reset" size={16} />
            Reset portfolio
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <Link href="/" className="topbar__mobile-brand" aria-label="AtlasX overview">
            <AtlasLogo compact />
          </Link>
          <div className="mode-pill">
            <span className="status-dot" />
            Sandbox
          </div>
          <div className="topbar__actions">
            <div className="network-switcher">
              <button
                className="network-button"
                type="button"
                aria-expanded={networkOpen}
                onClick={() => setNetworkOpen((open) => !open)}
              >
                <ChainMark chainId={chainId} size="small" />
                <span>
                  <strong>{chain.name}</strong>
                  <small>{chain.network}</small>
                </span>
                <Icon name="chevron" size={16} />
              </button>
              {networkOpen && (
                <>
                  <button
                    className="popover-scrim"
                    type="button"
                    aria-label="Close network menu"
                    onClick={() => setNetworkOpen(false)}
                  />
                  <div className="network-menu">
                    <div className="menu-label">Sandbox network</div>
                    {CHAINS.map((item) => (
                      <button
                        className={item.id === chainId ? "is-selected" : ""}
                        type="button"
                        key={item.id}
                        onClick={() => {
                          void selectChain(item.id);
                          setNetworkOpen(false);
                        }}
                      >
                        <ChainMark chainId={item.id} size="small" />
                        <span>
                          <strong>{item.name}</strong>
                          <small>{item.network}</small>
                        </span>
                        {item.id === chainId && <span className="menu-check">✓</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <button
              className={`wallet-button ${wallet ? "wallet-button--connected" : ""}`}
              type="button"
              onClick={() => setWalletModalOpen(true)}
            >
              <Icon name="wallet" size={18} />
              {wallet ? (
                <span>
                  <strong>{shortenAddress(wallet.address)}</strong>
                  <small>{wallet.name}</small>
                </span>
              ) : (
                <strong>Connect wallet</strong>
              )}
            </button>
          </div>
        </header>

        <main className="page-container">{children}</main>
      </div>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              href={item.href}
              className={active ? "is-active" : ""}
              key={item.href}
            >
              <Icon name={item.icon} size={19} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {walletModalOpen && <WalletModal currentChain={chainId} />}
      {toast && (
        <div className="toast" role="status">
          <span>✓</span>
          {toast}
        </div>
      )}
    </div>
  );
}

function WalletModal({ currentChain }: { currentChain: ChainId }) {
  const {
    wallet,
    detectedWallets,
    isWalletCompatible,
    setWalletModalOpen,
    connectWallet,
    disconnectWallet,
  } = useAtlas();
  const requiredWallet = getChain(currentChain).walletKind;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setWalletModalOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setWalletModalOpen]);

  const options: Array<{
    kind: WalletKind;
    description: string;
    detected: boolean;
    badge?: string;
  }> = [
    {
      kind: "sandbox",
      description: "Practice instantly with a funded demo address",
      detected: true,
      badge: "Recommended",
    },
    {
      kind: "evm",
      description: supportedChains("evm"),
      detected: detectedWallets.evm,
    },
    {
      kind: "solana",
      description: supportedChains("solana"),
      detected: detectedWallets.solana,
    },
    {
      kind: "tron",
      description: supportedChains("tron"),
      detected: detectedWallets.tron,
    },
  ];

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setWalletModalOpen(false);
      }}
    >
      <section
        className="wallet-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-modal-title"
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow">Wallet access</span>
            <h2 id="wallet-modal-title">
              {wallet ? "Connected wallet" : "Connect to AtlasX"}
            </h2>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="Close wallet dialog"
            onClick={() => setWalletModalOpen(false)}
          >
            <Icon name="close" />
          </button>
        </div>

        {wallet ? (
          <div className="connected-wallet">
            <div className="connected-wallet__mark">
              <Icon name="wallet" size={28} />
            </div>
            <span className="status-chip status-chip--success">
              <span className="status-dot" />
              Connected
            </span>
            <h3>{wallet.name}</h3>
            <code>{wallet.address}</code>
            {!isWalletCompatible && (
              <p className="inline-notice inline-notice--warning">
                This wallet does not support {getChain(currentChain).name}. Connect a{" "}
                {requiredWallet.toUpperCase()} wallet or use the sandbox wallet.
              </p>
            )}
            <button className="button button--secondary button--full" onClick={disconnectWallet}>
              Disconnect
            </button>
          </div>
        ) : (
          <>
            <p className="modal-copy">
              Wallets are used only to identify your sandbox portfolio. AtlasX will
              never request a mainnet transaction in sandbox mode.
            </p>
            <div className="wallet-options">
              {options.map((option) => {
                const recommended =
                  option.kind === requiredWallet || option.kind === "sandbox";
                return (
                  <button
                    className={`wallet-option ${
                      recommended ? "wallet-option--recommended" : ""
                    }`}
                    type="button"
                    key={option.kind}
                    onClick={() => void connectWallet(option.kind)}
                  >
                    <WalletGlyph kind={option.kind} />
                    <span className="wallet-option__copy">
                      <span>
                        <strong>{walletLabel(option.kind)}</strong>
                        {option.badge && <em>{option.badge}</em>}
                      </span>
                      <small>{option.description}</small>
                    </span>
                    <span
                      className={`detection-dot ${
                        option.detected ? "detection-dot--on" : ""
                      }`}
                      title={option.detected ? "Detected" : "Not detected"}
                    />
                  </button>
                );
              })}
            </div>
            <div className="modal-security">
              <Icon name="shield" size={18} />
              <span>
                <strong>Non-custodial by design</strong>
                Your keys remain inside your wallet.
              </span>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function WalletGlyph({ kind }: { kind: WalletKind }) {
  const labels: Record<WalletKind, string> = {
    sandbox: "AX",
    evm: "M",
    solana: "P",
    tron: "T",
  };
  return <span className={`wallet-glyph wallet-glyph--${kind}`}>{labels[kind]}</span>;
}
