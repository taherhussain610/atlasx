"use client";

import {
  CHAINS,
  ChainId,
  getChain,
  getToken,
  WalletKind,
} from "@/lib/atlas";
import {
  Activity,
  CreateOrderInput,
  freshSandboxState,
  LiquidityPosition,
  MAX_SANDBOX_COLLECTION_SIZE,
  parseSandboxState,
  SandboxOrder,
  SandboxState,
  StakePosition,
} from "@/lib/sandbox-state";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Eip1193Provider = {
  request: (request: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (value: unknown) => void) => void;
  removeListener?: (event: string, handler: (value: unknown) => void) => void;
};

type SolanaProvider = {
  isPhantom?: boolean;
  publicKey?: { toString: () => string };
  connect: () => Promise<{ publicKey?: { toString: () => string } }>;
};

type TronLinkProvider = {
  request: (request: { method: string }) => Promise<unknown>;
};

type TronWebProvider = {
  defaultAddress?: { base58?: string };
};

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
    solana?: SolanaProvider;
    tronLink?: TronLinkProvider;
    tronWeb?: TronWebProvider;
  }
}

export type WalletSession = {
  kind: WalletKind;
  name: string;
  address: string;
  sandbox: boolean;
};

export type {
  Activity,
  CreateOrderInput,
  LiquidityPosition,
  SandboxOrder,
  SandboxState,
  StakePosition,
} from "@/lib/sandbox-state";

type DetectedWallets = {
  evm: boolean;
  solana: boolean;
  tron: boolean;
};

export type PersistenceMode = "checking" | "browser" | "mysql" | "conflict";

type AtlasContextValue = SandboxState & {
  chainId: ChainId;
  wallet: WalletSession | null;
  walletModalOpen: boolean;
  detectedWallets: DetectedWallets;
  persistenceMode: PersistenceMode;
  toast: string | null;
  isWalletCompatible: boolean;
  setWalletModalOpen: (open: boolean) => void;
  selectChain: (chainId: ChainId) => Promise<void>;
  connectWallet: (kind: WalletKind) => Promise<void>;
  disconnectWallet: () => void;
  executeSwap: (from: string, to: string, amountIn: number, amountOut: number) => void;
  createOrder: (input: CreateOrderInput) => void;
  executeOrder: (orderId: string) => void;
  cancelOrder: (orderId: string) => void;
  addLiquidity: (tokenA: string, tokenB: string, amountA: number, amountB: number) => void;
  withdrawLiquidity: (positionId: string) => void;
  createStake: (token: string, amount: number, apr: number, lockDays: number) => void;
  claimStakeRewards: (positionId: string) => void;
  unstake: (positionId: string) => void;
  resetSandbox: () => void;
};

const STORAGE_KEY = "atlasx-sandbox-v1";
const STORAGE_UPDATED_AT_KEY = "atlasx-sandbox-updated-at-v1";

type LocalPortfolio = {
  state: SandboxState;
  updatedAt: number;
  exists: boolean;
};

function localPortfolio(): LocalPortfolio {
  const fallback = freshSandboxState();
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return { state: fallback, updatedAt: 0, exists: false };

    const state = parseSandboxState(JSON.parse(stored) as unknown);
    if (!state) throw new Error("Invalid local portfolio.");
    const storedUpdatedAt = Number(
      window.localStorage.getItem(STORAGE_UPDATED_AT_KEY),
    );
    return {
      state,
      updatedAt:
        Number.isSafeInteger(storedUpdatedAt) && storedUpdatedAt > 0
          ? storedUpdatedAt
          : Date.now(),
      exists: true,
    };
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(STORAGE_UPDATED_AT_KEY);
    return { state: fallback, updatedAt: 0, exists: false };
  }
}

function remotePortfolio(value: unknown): {
  configured: boolean;
  portfolio: { state: SandboxState; updatedAt: number; revision: number } | null;
} | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const response = value as Record<string, unknown>;
  if (typeof response.configured !== "boolean") return null;
  if (!response.configured || response.portfolio === null) {
    return { configured: response.configured, portfolio: null };
  }
  if (
    !response.portfolio ||
    typeof response.portfolio !== "object" ||
    Array.isArray(response.portfolio)
  ) {
    return null;
  }

  const portfolio = response.portfolio as Record<string, unknown>;
  const state = parseSandboxState(portfolio.state);
  if (
    !state ||
    !Number.isSafeInteger(portfolio.updatedAt) ||
    Number(portfolio.updatedAt) < 0 ||
    !Number.isSafeInteger(portfolio.revision) ||
    Number(portfolio.revision) < 1
  ) {
    return null;
  }
  return {
    configured: true,
    portfolio: {
      state,
      updatedAt: Number(portfolio.updatedAt),
      revision: Number(portfolio.revision),
    },
  };
}

function makeId(prefix: string): string {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${suffix}`;
}

function sandboxAddress(chainId: ChainId): string {
  if (chainId === "solana") return "AtLX7VjC7Py8wQMf7FbL2mYyJx9PxzCqF5Wv2KxP4Dev";
  if (chainId === "tron") return "TAtLasX4gXf4HVU3j8u9c7yD6vP2Sandbox";
  return "0xA71a5A5D5F0cB2e9eAE6A48F4a76f0cF9E2aB310";
}

function withActivity(activity: Activity[], item: Activity): Activity[] {
  return [item, ...activity].slice(0, 50);
}

const AtlasContext = createContext<AtlasContextValue | null>(null);

export function AtlasProvider({ children }: { children: ReactNode }) {
  const [chainId, setChainId] = useState<ChainId>("bnb");
  const [wallet, setWallet] = useState<WalletSession | null>(null);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [state, setState] = useState<SandboxState>(freshSandboxState);
  const [hydrated, setHydrated] = useState(false);
  const [mysqlSyncEnabled, setMysqlSyncEnabled] = useState(false);
  const [persistenceMode, setPersistenceMode] =
    useState<PersistenceMode>("checking");
  const [toast, setToast] = useState<string | null>(null);
  const [detectedWallets, setDetectedWallets] = useState<DetectedWallets>({
    evm: false,
    solana: false,
    tron: false,
  });
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localUpdatedAt = useRef(0);
  const lastSyncedState = useRef<string | null>(null);
  const portfolioRevision = useRef<number | null>(null);

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3600);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const local = localPortfolio();

    async function initialize() {
      let selectedState = local.state;
      let mysqlEnabled = false;

      try {
        const response = await fetch("/api/portfolio", {
          cache: "no-store",
          signal: AbortSignal.timeout(5_000),
        });
        if (!response.ok) throw new Error("Portfolio sync is unavailable.");

        const remote = remotePortfolio(await response.json());
        if (!remote) throw new Error("Portfolio sync returned invalid data.");
        mysqlEnabled = remote.configured;
        if (
          remote.portfolio &&
          (!local.exists || remote.portfolio.updatedAt > local.updatedAt)
        ) {
          selectedState = remote.portfolio.state;
        }
        portfolioRevision.current = remote.portfolio?.revision ?? null;
        lastSyncedState.current = remote.portfolio
          ? JSON.stringify(remote.portfolio.state)
          : local.exists
            ? null
            : JSON.stringify(selectedState);
      } catch {
        mysqlEnabled = false;
      }

      if (cancelled) return;
      setState(selectedState);
      setDetectedWallets({
        evm: Boolean(window.ethereum),
        solana: Boolean(window.solana?.isPhantom),
        tron: Boolean(window.tronLink),
      });
      setMysqlSyncEnabled(mysqlEnabled);
      setPersistenceMode(mysqlEnabled ? "mysql" : "browser");
      setHydrated(true);
    }

    void initialize();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const updatedAt = Date.now();
    localUpdatedAt.current = updatedAt;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.localStorage.setItem(STORAGE_UPDATED_AT_KEY, String(updatedAt));
  }, [hydrated, state]);

  useEffect(() => {
    if (!hydrated || !mysqlSyncEnabled) return;

    const serializedState = JSON.stringify(state);
    if (serializedState === lastSyncedState.current) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      void fetch("/api/portfolio", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          state,
          updatedAt: localUpdatedAt.current || Date.now(),
          revision: portfolioRevision.current,
        }),
        cache: "no-store",
        signal: controller.signal,
      })
        .then(async (response) => {
          if (response.status === 409) {
            setMysqlSyncEnabled(false);
            setPersistenceMode("conflict");
            return;
          }
          if (!response.ok) throw new Error("Portfolio sync failed.");
          const result = (await response.json()) as { revision?: unknown };
          if (
            !Number.isSafeInteger(result.revision) ||
            Number(result.revision) < 1
          ) {
            throw new Error("Portfolio sync returned invalid data.");
          }
          portfolioRevision.current = Number(result.revision);
          lastSyncedState.current = serializedState;
          setPersistenceMode("mysql");
        })
        .catch(() => {
          if (!controller.signal.aborted) setPersistenceMode("browser");
        });
    }, 600);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [hydrated, mysqlSyncEnabled, state]);

  useEffect(() => {
    const provider = window.ethereum;
    if (!provider?.on) return;
    const handleAccounts = (value: unknown) => {
      if (!Array.isArray(value) || !value[0]) {
        setWallet((current) => (current?.kind === "evm" ? null : current));
        return;
      }
      setWallet((current) =>
        current?.kind === "evm"
          ? { ...current, address: String(value[0]) }
          : current,
      );
    };
    provider.on("accountsChanged", handleAccounts);
    return () => provider.removeListener?.("accountsChanged", handleAccounts);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const switchEvmNetwork = useCallback(async (nextChainId: ChainId) => {
    const chain = getChain(nextChainId);
    if (!window.ethereum || !chain.chainId) return;
    const hexChainId = `0x${chain.chainId.toString(16)}`;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: hexChainId }],
      });
    } catch (error) {
      const code = (error as { code?: number }).code;
      if (code !== 4902 || !chain.rpcUrl) throw error;
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: hexChainId,
            chainName: `${chain.name} ${chain.network}`,
            nativeCurrency: {
              name: chain.nativeSymbol,
              symbol: chain.nativeSymbol,
              decimals: 18,
            },
            rpcUrls: [chain.rpcUrl],
            blockExplorerUrls: [chain.explorerUrl],
          },
        ],
      });
    }
  }, []);

  const selectChain = useCallback(
    async (nextChainId: ChainId) => {
      const nextChain = getChain(nextChainId);
      setChainId(nextChainId);
      if (wallet?.kind === "evm" && nextChain.walletKind === "evm") {
        try {
          await switchEvmNetwork(nextChainId);
        } catch {
          notify(`Switch to ${nextChain.name} in your wallet to continue.`);
        }
      }
    },
    [notify, switchEvmNetwork, wallet?.kind],
  );

  const connectWallet = useCallback(
    async (kind: WalletKind) => {
      const chain = getChain(chainId);
      try {
        if (kind === "sandbox") {
          setWallet({
            kind,
            name: "Sandbox wallet",
            address: sandboxAddress(chainId),
            sandbox: true,
          });
        } else if (kind === "evm") {
          if (!window.ethereum) throw new Error("MetaMask was not detected.");
          const accounts = (await window.ethereum.request({
            method: "eth_requestAccounts",
          })) as string[];
          if (!accounts[0]) throw new Error("No account was returned by MetaMask.");
          setWallet({ kind, name: "MetaMask", address: accounts[0], sandbox: false });
          if (chain.walletKind === "evm") await switchEvmNetwork(chainId);
        } else if (kind === "solana") {
          if (!window.solana?.isPhantom) throw new Error("Phantom was not detected.");
          const response = await window.solana.connect();
          const address =
            response.publicKey?.toString() ?? window.solana.publicKey?.toString();
          if (!address) throw new Error("No account was returned by Phantom.");
          setWallet({ kind, name: "Phantom", address, sandbox: false });
        } else {
          if (!window.tronLink) throw new Error("TronLink was not detected.");
          await window.tronLink.request({ method: "tron_requestAccounts" });
          const address = window.tronWeb?.defaultAddress?.base58;
          if (!address) throw new Error("Unlock TronLink and try again.");
          setWallet({ kind, name: "TronLink", address, sandbox: false });
        }
        setWalletModalOpen(false);
        notify("Wallet connected. Sandbox mode remains active.");
      } catch (error) {
        notify(error instanceof Error ? error.message : "Unable to connect wallet.");
      }
    },
    [chainId, notify, switchEvmNetwork],
  );

  const requireReadyWallet = useCallback(() => {
    if (!hydrated) {
      throw new Error("Your sandbox portfolio is still loading.");
    }
    const required = getChain(chainId).walletKind;
    if (!wallet) {
      setWalletModalOpen(true);
      throw new Error("Connect a wallet to continue.");
    }
    if (wallet.kind !== "sandbox" && wallet.kind !== required) {
      setWalletModalOpen(true);
      throw new Error(`Connect a compatible ${required.toUpperCase()} wallet.`);
    }
  }, [chainId, hydrated, wallet]);

  const executeSwap = useCallback(
    (from: string, to: string, amountIn: number, amountOut: number) => {
      requireReadyWallet();
      const available = state.balances[chainId][from] ?? 0;
      if (amountIn <= 0 || amountOut <= 0) throw new Error("Enter a valid amount.");
      if (amountIn > available) throw new Error(`Insufficient ${from} balance.`);
      const inputValue = amountIn * getToken(chainId, from).price;
      setState((current) => ({
        ...current,
        balances: {
          ...current.balances,
          [chainId]: {
            ...current.balances[chainId],
            [from]: current.balances[chainId][from] - amountIn,
            [to]: (current.balances[chainId][to] ?? 0) + amountOut,
          },
        },
        activity: withActivity(current.activity, {
            id: makeId("swap"),
            type: "swap",
            title: `Swapped ${from} for ${to}`,
            detail: `${amountIn.toLocaleString()} ${from} → ${amountOut.toLocaleString()} ${to}`,
            chainId,
            valueUsd: inputValue,
            timestamp: Date.now(),
        }),
      }));
      notify("Swap completed in sandbox mode.");
    },
    [chainId, notify, requireReadyWallet, state.balances],
  );

  const createOrder = useCallback(
    (input: CreateOrderInput) => {
      requireReadyWallet();
      const activeOrders = state.orders.filter((order) =>
        ["open", "active"].includes(order.status),
      );
      if (activeOrders.length >= MAX_SANDBOX_COLLECTION_SIZE) {
        throw new Error("Complete or cancel an active order before adding another.");
      }
      if (input.fromToken === input.toToken) {
        throw new Error("Choose two different assets.");
      }
      if (!Number.isFinite(input.amount) || input.amount <= 0) {
        throw new Error("Enter a valid order amount.");
      }
      const available = state.balances[chainId][input.fromToken] ?? 0;
      if (input.amount > available) {
        throw new Error(`Insufficient ${input.fromToken} balance.`);
      }

      const totalExecutions =
        input.kind === "dca" ? Math.max(Math.trunc(input.totalExecutions ?? 0), 2) : 1;
      const intervalDays =
        input.kind === "dca" ? Math.max(Math.trunc(input.intervalDays ?? 0), 1) : null;
      const targetRate = input.kind === "limit" ? input.targetRate ?? 0 : null;
      if (
        input.kind === "limit" &&
        (targetRate === null || !Number.isFinite(targetRate) || targetRate <= 0)
      ) {
        throw new Error("Enter a valid limit rate.");
      }
      if (
        input.kind === "dca" &&
        (intervalDays === null ||
          totalExecutions > 24 ||
          !Number.isFinite(intervalDays) ||
          intervalDays > 365)
      ) {
        throw new Error("Choose 2–24 executions and a 1–365 day interval.");
      }

      const order: SandboxOrder = {
        id: makeId("order"),
        chainId,
        kind: input.kind,
        fromToken: input.fromToken,
        toToken: input.toToken,
        amount: input.amount,
        targetRate,
        intervalDays,
        totalExecutions,
        completedExecutions: 0,
        status: input.kind === "limit" ? "open" : "active",
        createdAt: Date.now(),
      };
      const valueUsd = input.amount * getToken(chainId, input.fromToken).price;

      setState((current) => {
        const active = current.orders.filter((item) =>
          ["open", "active"].includes(item.status),
        );
        const archived = current.orders.filter(
          (item) => !["open", "active"].includes(item.status),
        );
        return {
          ...current,
          orders: [order, ...active, ...archived].slice(
            0,
            MAX_SANDBOX_COLLECTION_SIZE,
          ),
          activity: withActivity(current.activity, {
            id: makeId("order"),
            type: "order",
            title: `Created ${input.kind.toUpperCase()} order`,
            detail: `${input.amount.toLocaleString()} ${input.fromToken} → ${input.toToken}`,
            chainId,
            valueUsd,
            timestamp: Date.now(),
          }),
        };
      });
      notify(input.kind === "limit" ? "Limit order created." : "DCA plan activated.");
    },
    [
      chainId,
      notify,
      requireReadyWallet,
      state.balances,
      state.orders,
    ],
  );

  const executeOrder = useCallback(
    (orderId: string) => {
      const order = state.orders.find((item) => item.id === orderId);
      if (!order || !["open", "active"].includes(order.status)) {
        throw new Error("This order is no longer active.");
      }
      if (order.chainId !== chainId) {
        throw new Error(`Switch to ${getChain(order.chainId).name} to execute this order.`);
      }
      requireReadyWallet();
      const available = state.balances[order.chainId][order.fromToken] ?? 0;
      if (order.amount > available) {
        throw new Error(`Insufficient ${order.fromToken} balance.`);
      }

      const marketRate =
        getToken(order.chainId, order.fromToken).price /
        getToken(order.chainId, order.toToken).price;
      const executionRate = order.targetRate ?? marketRate;
      const amountOut = order.amount * executionRate * 0.997;
      const completedExecutions = order.completedExecutions + 1;
      const filled = completedExecutions >= order.totalExecutions;

      setState((current) => ({
        ...current,
        balances: {
          ...current.balances,
          [order.chainId]: {
            ...current.balances[order.chainId],
            [order.fromToken]:
              current.balances[order.chainId][order.fromToken] - order.amount,
            [order.toToken]:
              (current.balances[order.chainId][order.toToken] ?? 0) + amountOut,
          },
        },
        orders: current.orders.map((item) =>
          item.id === orderId
            ? {
                ...item,
                completedExecutions,
                status: filled ? "filled" : item.status,
              }
            : item,
        ),
        activity: withActivity(current.activity, {
          id: makeId("order"),
          type: "order",
          title: order.kind === "limit" ? "Limit order filled" : "DCA tranche executed",
          detail: `${order.amount.toLocaleString()} ${order.fromToken} → ${amountOut.toLocaleString()} ${order.toToken}`,
          chainId: order.chainId,
          valueUsd: order.amount * getToken(order.chainId, order.fromToken).price,
          timestamp: Date.now(),
        }),
      }));
      notify(filled ? "Order completed." : "DCA tranche executed.");
    },
    [chainId, notify, requireReadyWallet, state.balances, state.orders],
  );

  const cancelOrder = useCallback(
    (orderId: string) => {
      requireReadyWallet();
      const order = state.orders.find((item) => item.id === orderId);
      if (!order || !["open", "active"].includes(order.status)) {
        throw new Error("This order is no longer active.");
      }
      setState((current) => ({
        ...current,
        orders: current.orders.map((item) =>
          item.id === orderId ? { ...item, status: "cancelled" } : item,
        ),
        activity: withActivity(current.activity, {
          id: makeId("order"),
          type: "order",
          title: "Order cancelled",
          detail: `${order.fromToken}/${order.toToken} ${order.kind.toUpperCase()} order`,
          chainId: order.chainId,
          valueUsd: order.amount * getToken(order.chainId, order.fromToken).price,
          timestamp: Date.now(),
        }),
      }));
      notify("Order cancelled.");
    },
    [notify, requireReadyWallet, state.orders],
  );

  const addLiquidity = useCallback(
    (tokenA: string, tokenB: string, amountA: number, amountB: number) => {
      requireReadyWallet();
      if (state.liquidityPositions.length >= MAX_SANDBOX_COLLECTION_SIZE) {
        throw new Error("Withdraw a liquidity position before adding another.");
      }
      const chainBalances = state.balances[chainId];
      if (amountA <= 0 || amountB <= 0) throw new Error("Enter both token amounts.");
      if (amountA > (chainBalances[tokenA] ?? 0)) {
        throw new Error(`Insufficient ${tokenA} balance.`);
      }
      if (amountB > (chainBalances[tokenB] ?? 0)) {
        throw new Error(`Insufficient ${tokenB} balance.`);
      }
      const valueUsd =
        amountA * getToken(chainId, tokenA).price +
        amountB * getToken(chainId, tokenB).price;
      const position: LiquidityPosition = {
        id: makeId("lp"),
        chainId,
        tokenA,
        tokenB,
        amountA,
        amountB,
        valueUsd,
        share: Math.min((valueUsd / 2_500_000) * 100, 99),
        createdAt: Date.now(),
      };
      setState((current) => ({
        ...current,
        balances: {
          ...current.balances,
          [chainId]: {
            ...current.balances[chainId],
            [tokenA]: current.balances[chainId][tokenA] - amountA,
            [tokenB]: current.balances[chainId][tokenB] - amountB,
          },
        },
        liquidityPositions: [position, ...current.liquidityPositions],
        activity: withActivity(current.activity, {
            id: makeId("liquidity"),
            type: "liquidity",
            title: `Added ${tokenA}/${tokenB} liquidity`,
            detail: `${amountA.toLocaleString()} ${tokenA} + ${amountB.toLocaleString()} ${tokenB}`,
            chainId,
            valueUsd,
            timestamp: Date.now(),
        }),
      }));
      notify("Liquidity position created.");
    },
    [
      chainId,
      notify,
      requireReadyWallet,
      state.balances,
      state.liquidityPositions.length,
    ],
  );

  const withdrawLiquidity = useCallback(
    (positionId: string) => {
      requireReadyWallet();
      const position = state.liquidityPositions.find((item) => item.id === positionId);
      if (!position) throw new Error("Position was not found.");
      setState((current) => ({
        ...current,
        balances: {
          ...current.balances,
          [position.chainId]: {
            ...current.balances[position.chainId],
            [position.tokenA]:
              (current.balances[position.chainId][position.tokenA] ?? 0) +
              position.amountA,
            [position.tokenB]:
              (current.balances[position.chainId][position.tokenB] ?? 0) +
              position.amountB,
          },
        },
        liquidityPositions: current.liquidityPositions.filter(
          (item) => item.id !== positionId,
        ),
        activity: withActivity(current.activity, {
            id: makeId("liquidity"),
            type: "liquidity",
            title: `Removed ${position.tokenA}/${position.tokenB} liquidity`,
            detail: "Position returned to your sandbox balance",
            chainId: position.chainId,
            valueUsd: position.valueUsd,
            timestamp: Date.now(),
        }),
      }));
      notify("Liquidity withdrawn to your sandbox wallet.");
    },
    [notify, requireReadyWallet, state.liquidityPositions],
  );

  const createStake = useCallback(
    (token: string, amount: number, apr: number, lockDays: number) => {
      requireReadyWallet();
      if (state.stakePositions.length >= MAX_SANDBOX_COLLECTION_SIZE) {
        throw new Error("Unstake a position before adding another.");
      }
      const available = state.balances[chainId][token] ?? 0;
      if (amount <= 0) throw new Error("Enter a valid stake amount.");
      if (amount > available) throw new Error(`Insufficient ${token} balance.`);
      const position: StakePosition = {
        id: makeId("stake"),
        chainId,
        token,
        amount,
        apr,
        lockDays,
        startedAt: Date.now(),
        claimedRewards: 0,
      };
      setState((current) => ({
        ...current,
        balances: {
          ...current.balances,
          [chainId]: {
            ...current.balances[chainId],
            [token]: current.balances[chainId][token] - amount,
          },
        },
        stakePositions: [position, ...current.stakePositions],
        activity: withActivity(current.activity, {
            id: makeId("stake"),
            type: "stake",
            title: `Staked ${token}`,
            detail: `${amount.toLocaleString()} ${token} · ${lockDays} days at ${apr}% APR`,
            chainId,
            valueUsd: amount * getToken(chainId, token).price,
            timestamp: Date.now(),
        }),
      }));
      notify("Stake activated in sandbox mode.");
    },
    [
      chainId,
      notify,
      requireReadyWallet,
      state.balances,
      state.stakePositions.length,
    ],
  );

  const claimStakeRewards = useCallback(
    (positionId: string) => {
      requireReadyWallet();
      const now = Date.now();
      const position = state.stakePositions.find((item) => item.id === positionId);
      if (!position) throw new Error("Stake was not found.");
      const elapsedYears = Math.max(now - position.startedAt, 1) / 31_536_000_000;
      const totalReward = position.amount * (position.apr / 100) * elapsedYears;
      const claimable = Math.max(totalReward - position.claimedRewards, 0);
      if (claimable < 0.000001) throw new Error("Rewards are still accruing.");
      setState((current) => ({
        ...current,
        balances: {
          ...current.balances,
          [position.chainId]: {
            ...current.balances[position.chainId],
            [position.token]:
              (current.balances[position.chainId][position.token] ?? 0) + claimable,
          },
        },
        stakePositions: current.stakePositions.map((item) =>
          item.id === positionId
            ? { ...item, claimedRewards: item.claimedRewards + claimable }
            : item,
        ),
        activity: withActivity(current.activity, {
            id: makeId("reward"),
            type: "reward",
            title: `Claimed ${position.token} rewards`,
            detail: `${claimable.toFixed(6)} ${position.token}`,
            chainId: position.chainId,
            valueUsd: claimable * getToken(position.chainId, position.token).price,
            timestamp: now,
        }),
      }));
      notify("Rewards claimed.");
    },
    [notify, requireReadyWallet, state.stakePositions],
  );

  const unstake = useCallback(
    (positionId: string) => {
      requireReadyWallet();
      const position = state.stakePositions.find((item) => item.id === positionId);
      if (!position) throw new Error("Stake was not found.");
      setState((current) => ({
        ...current,
        balances: {
          ...current.balances,
          [position.chainId]: {
            ...current.balances[position.chainId],
            [position.token]:
              (current.balances[position.chainId][position.token] ?? 0) +
              position.amount,
          },
        },
        stakePositions: current.stakePositions.filter((item) => item.id !== positionId),
        activity: withActivity(current.activity, {
            id: makeId("stake"),
            type: "stake",
            title: `Unstaked ${position.token}`,
            detail: `${position.amount.toLocaleString()} ${position.token} returned`,
            chainId: position.chainId,
            valueUsd: position.amount * getToken(position.chainId, position.token).price,
            timestamp: Date.now(),
        }),
      }));
      notify("Principal returned to your sandbox balance.");
    },
    [notify, requireReadyWallet, state.stakePositions],
  );

  const disconnectWallet = useCallback(() => {
    setWallet(null);
    setWalletModalOpen(false);
    notify("Wallet disconnected.");
  }, [notify]);

  const resetSandbox = useCallback(() => {
    if (!hydrated) return;
    setState(freshSandboxState());
    notify("Sandbox portfolio reset.");
  }, [hydrated, notify]);

  const isWalletCompatible =
    Boolean(wallet) &&
    (wallet?.kind === "sandbox" || wallet?.kind === getChain(chainId).walletKind);

  const value = useMemo<AtlasContextValue>(
    () => ({
      ...state,
      chainId,
      wallet,
      walletModalOpen,
      detectedWallets,
      persistenceMode,
      toast,
      isWalletCompatible,
      setWalletModalOpen,
      selectChain,
      connectWallet,
      disconnectWallet,
      executeSwap,
      createOrder,
      executeOrder,
      cancelOrder,
      addLiquidity,
      withdrawLiquidity,
      createStake,
      claimStakeRewards,
      unstake,
      resetSandbox,
    }),
    [
      state,
      chainId,
      wallet,
      walletModalOpen,
      detectedWallets,
      persistenceMode,
      toast,
      isWalletCompatible,
      selectChain,
      connectWallet,
      disconnectWallet,
      executeSwap,
      createOrder,
      executeOrder,
      cancelOrder,
      addLiquidity,
      withdrawLiquidity,
      createStake,
      claimStakeRewards,
      unstake,
      resetSandbox,
    ],
  );

  return <AtlasContext.Provider value={value}>{children}</AtlasContext.Provider>;
}

export function useAtlas(): AtlasContextValue {
  const context = useContext(AtlasContext);
  if (!context) throw new Error("useAtlas must be used inside AtlasProvider.");
  return context;
}

export function walletLabel(kind: WalletKind): string {
  return (
    {
      evm: "MetaMask",
      solana: "Phantom",
      tron: "TronLink",
      sandbox: "Sandbox wallet",
    } satisfies Record<WalletKind, string>
  )[kind];
}

export function supportedChains(kind: WalletKind): string {
  if (kind === "sandbox") return "All supported networks";
  return CHAINS.filter((chain) => chain.walletKind === kind)
    .map((chain) => chain.name)
    .join(" · ");
}
