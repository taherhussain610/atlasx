"use client";

import {
  CHAINS,
  ChainId,
  getChain,
  getToken,
  INITIAL_BALANCES,
  WalletKind,
} from "@/lib/atlas";
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

export type Activity = {
  id: string;
  type: "swap" | "liquidity" | "stake" | "reward";
  title: string;
  detail: string;
  chainId: ChainId;
  valueUsd: number;
  timestamp: number;
};

export type LiquidityPosition = {
  id: string;
  chainId: ChainId;
  tokenA: string;
  tokenB: string;
  amountA: number;
  amountB: number;
  valueUsd: number;
  share: number;
  createdAt: number;
};

export type StakePosition = {
  id: string;
  chainId: ChainId;
  token: string;
  amount: number;
  apr: number;
  lockDays: number;
  startedAt: number;
  claimedRewards: number;
};

type SandboxState = {
  balances: Record<ChainId, Record<string, number>>;
  activity: Activity[];
  liquidityPositions: LiquidityPosition[];
  stakePositions: StakePosition[];
};

type DetectedWallets = {
  evm: boolean;
  solana: boolean;
  tron: boolean;
};

type AtlasContextValue = SandboxState & {
  chainId: ChainId;
  wallet: WalletSession | null;
  walletModalOpen: boolean;
  detectedWallets: DetectedWallets;
  toast: string | null;
  isWalletCompatible: boolean;
  setWalletModalOpen: (open: boolean) => void;
  selectChain: (chainId: ChainId) => Promise<void>;
  connectWallet: (kind: WalletKind) => Promise<void>;
  disconnectWallet: () => void;
  executeSwap: (from: string, to: string, amountIn: number, amountOut: number) => void;
  addLiquidity: (tokenA: string, tokenB: string, amountA: number, amountB: number) => void;
  withdrawLiquidity: (positionId: string) => void;
  createStake: (token: string, amount: number, apr: number, lockDays: number) => void;
  claimStakeRewards: (positionId: string) => void;
  unstake: (positionId: string) => void;
  resetSandbox: () => void;
};

const STORAGE_KEY = "atlasx-sandbox-v1";

function freshState(): SandboxState {
  return {
    balances: {
      bnb: { ...INITIAL_BALANCES.bnb },
      tron: { ...INITIAL_BALANCES.tron },
      solana: { ...INITIAL_BALANCES.solana },
      abstract: { ...INITIAL_BALANCES.abstract },
    },
    activity: [],
    liquidityPositions: [],
    stakePositions: [],
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

function validateState(value: unknown): value is SandboxState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SandboxState>;
  return (
    !!candidate.balances &&
    Array.isArray(candidate.activity) &&
    Array.isArray(candidate.liquidityPositions) &&
    Array.isArray(candidate.stakePositions)
  );
}

function withActivity(activity: Activity[], item: Activity): Activity[] {
  return [item, ...activity].slice(0, 50);
}

const AtlasContext = createContext<AtlasContextValue | null>(null);

export function AtlasProvider({ children }: { children: ReactNode }) {
  const [chainId, setChainId] = useState<ChainId>("bnb");
  const [wallet, setWallet] = useState<WalletSession | null>(null);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [state, setState] = useState<SandboxState>(freshState);
  const [hydrated, setHydrated] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [detectedWallets, setDetectedWallets] = useState<DetectedWallets>({
    evm: false,
    solana: false,
    tron: false,
  });
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3600);
  }, []);

  useEffect(() => {
    let restoredState: SandboxState | null = null;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (validateState(parsed)) restoredState = parsed;
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    queueMicrotask(() => {
      if (restoredState) setState(restoredState);
      setDetectedWallets({
        evm: Boolean(window.ethereum),
        solana: Boolean(window.solana?.isPhantom),
        tron: Boolean(window.tronLink),
      });
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [hydrated, state]);

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
    const required = getChain(chainId).walletKind;
    if (!wallet) {
      setWalletModalOpen(true);
      throw new Error("Connect a wallet to continue.");
    }
    if (wallet.kind !== "sandbox" && wallet.kind !== required) {
      setWalletModalOpen(true);
      throw new Error(`Connect a compatible ${required.toUpperCase()} wallet.`);
    }
  }, [chainId, wallet]);

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

  const addLiquidity = useCallback(
    (tokenA: string, tokenB: string, amountA: number, amountB: number) => {
      requireReadyWallet();
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
    [chainId, notify, requireReadyWallet, state.balances],
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
    [chainId, notify, requireReadyWallet, state.balances],
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
    setState(freshState());
    notify("Sandbox portfolio reset.");
  }, [notify]);

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
      toast,
      isWalletCompatible,
      setWalletModalOpen,
      selectChain,
      connectWallet,
      disconnectWallet,
      executeSwap,
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
      toast,
      isWalletCompatible,
      selectChain,
      connectWallet,
      disconnectWallet,
      executeSwap,
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
