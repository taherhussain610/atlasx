import {
  ChainId,
  INITIAL_BALANCES,
  TOKENS,
} from "@/lib/atlas";

export type Activity = {
  id: string;
  type: "swap" | "liquidity" | "stake" | "reward" | "order";
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

export type SandboxOrder = {
  id: string;
  chainId: ChainId;
  kind: "limit" | "dca";
  fromToken: string;
  toToken: string;
  amount: number;
  targetRate: number | null;
  intervalDays: number | null;
  totalExecutions: number;
  completedExecutions: number;
  status: "open" | "active" | "filled" | "cancelled";
  createdAt: number;
};

export type CreateOrderInput = {
  kind: SandboxOrder["kind"];
  fromToken: string;
  toToken: string;
  amount: number;
  targetRate?: number;
  intervalDays?: number;
  totalExecutions?: number;
};

export type SandboxState = {
  balances: Record<ChainId, Record<string, number>>;
  activity: Activity[];
  liquidityPositions: LiquidityPosition[];
  stakePositions: StakePosition[];
  orders: SandboxOrder[];
};

const CHAIN_IDS = ["bnb", "tron", "solana", "abstract"] as const;
const ACTIVITY_TYPES = ["swap", "liquidity", "stake", "reward", "order"] as const;
const ORDER_KINDS = ["limit", "dca"] as const;
const ORDER_STATUSES = ["open", "active", "filled", "cancelled"] as const;
const MAX_COLLECTION_SIZE = 500;
const MAX_AMOUNT = 1_000_000_000_000_000;

type JsonRecord = Record<string, unknown>;

export function freshSandboxState(): SandboxState {
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
    orders: [],
  };
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isEnumValue<T extends string>(
  value: unknown,
  values: readonly T[],
): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function isString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

function isNumber(
  value: unknown,
  minimum = 0,
  maximum = MAX_AMOUNT,
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= minimum &&
    value <= maximum
  );
}

function isInteger(
  value: unknown,
  minimum = 0,
  maximum = Number.MAX_SAFE_INTEGER,
): value is number {
  return Number.isSafeInteger(value) && Number(value) >= minimum && Number(value) <= maximum;
}

function isChainId(value: unknown): value is ChainId {
  return isEnumValue(value, CHAIN_IDS);
}

function isToken(chainId: ChainId, value: unknown): value is string {
  return (
    typeof value === "string" &&
    TOKENS[chainId].some((token) => token.symbol === value)
  );
}

function parseBalances(
  value: unknown,
): Record<ChainId, Record<string, number>> | null {
  if (!isRecord(value)) return null;

  const balances = {} as Record<ChainId, Record<string, number>>;
  for (const chainId of CHAIN_IDS) {
    const chainValue = value[chainId];
    if (!isRecord(chainValue)) return null;

    const chainBalances: Record<string, number> = {};
    for (const token of TOKENS[chainId]) {
      const amount = chainValue[token.symbol];
      if (!isNumber(amount)) return null;
      chainBalances[token.symbol] = amount;
    }
    balances[chainId] = chainBalances;
  }
  return balances;
}

function parseActivity(value: unknown): Activity | null {
  if (
    !isRecord(value) ||
    !isString(value.id, 100) ||
    !isEnumValue(value.type, ACTIVITY_TYPES) ||
    !isString(value.title, 160) ||
    !isString(value.detail, 320) ||
    !isChainId(value.chainId) ||
    !isNumber(value.valueUsd) ||
    !isInteger(value.timestamp)
  ) {
    return null;
  }

  return {
    id: value.id,
    type: value.type,
    title: value.title,
    detail: value.detail,
    chainId: value.chainId,
    valueUsd: value.valueUsd,
    timestamp: value.timestamp,
  };
}

function parseLiquidityPosition(value: unknown): LiquidityPosition | null {
  if (
    !isRecord(value) ||
    !isString(value.id, 100) ||
    !isChainId(value.chainId) ||
    !isToken(value.chainId, value.tokenA) ||
    !isToken(value.chainId, value.tokenB) ||
    value.tokenA === value.tokenB ||
    !isNumber(value.amountA) ||
    !isNumber(value.amountB) ||
    !isNumber(value.valueUsd) ||
    !isNumber(value.share, 0, 100) ||
    !isInteger(value.createdAt)
  ) {
    return null;
  }

  return {
    id: value.id,
    chainId: value.chainId,
    tokenA: value.tokenA,
    tokenB: value.tokenB,
    amountA: value.amountA,
    amountB: value.amountB,
    valueUsd: value.valueUsd,
    share: value.share,
    createdAt: value.createdAt,
  };
}

function parseStakePosition(value: unknown): StakePosition | null {
  if (
    !isRecord(value) ||
    !isString(value.id, 100) ||
    !isChainId(value.chainId) ||
    !isToken(value.chainId, value.token) ||
    !isNumber(value.amount) ||
    !isNumber(value.apr, 0, 1_000) ||
    !isInteger(value.lockDays, 1, 3_650) ||
    !isInteger(value.startedAt) ||
    !isNumber(value.claimedRewards)
  ) {
    return null;
  }

  return {
    id: value.id,
    chainId: value.chainId,
    token: value.token,
    amount: value.amount,
    apr: value.apr,
    lockDays: value.lockDays,
    startedAt: value.startedAt,
    claimedRewards: value.claimedRewards,
  };
}

function parseOrder(value: unknown): SandboxOrder | null {
  if (
    !isRecord(value) ||
    !isString(value.id, 100) ||
    !isChainId(value.chainId) ||
    !isEnumValue(value.kind, ORDER_KINDS) ||
    !isToken(value.chainId, value.fromToken) ||
    !isToken(value.chainId, value.toToken) ||
    value.fromToken === value.toToken ||
    !isNumber(value.amount) ||
    !isInteger(value.totalExecutions, 1, 24) ||
    !isInteger(value.completedExecutions, 0, value.totalExecutions) ||
    !isEnumValue(value.status, ORDER_STATUSES) ||
    !isInteger(value.createdAt)
  ) {
    return null;
  }

  const targetRate =
    value.targetRate === null || isNumber(value.targetRate, Number.MIN_VALUE)
      ? value.targetRate
      : undefined;
  const intervalDays =
    value.intervalDays === null || isInteger(value.intervalDays, 1, 365)
      ? value.intervalDays
      : undefined;
  if (targetRate === undefined || intervalDays === undefined) return null;
  if (value.kind === "limit" && (targetRate === null || intervalDays !== null)) return null;
  if (value.kind === "dca" && (targetRate !== null || intervalDays === null)) return null;

  return {
    id: value.id,
    chainId: value.chainId,
    kind: value.kind,
    fromToken: value.fromToken,
    toToken: value.toToken,
    amount: value.amount,
    targetRate,
    intervalDays,
    totalExecutions: value.totalExecutions,
    completedExecutions: value.completedExecutions,
    status: value.status,
    createdAt: value.createdAt,
  };
}

function parseCollection<T>(
  value: unknown,
  parser: (item: unknown) => T | null,
  maximum = MAX_COLLECTION_SIZE,
): T[] | null {
  if (!Array.isArray(value) || value.length > maximum) return null;
  const parsed = value.map(parser);
  return parsed.every((item): item is T => item !== null) ? parsed : null;
}

export function parseSandboxState(value: unknown): SandboxState | null {
  if (!isRecord(value)) return null;

  const balances = parseBalances(value.balances);
  const activity = parseCollection(value.activity, parseActivity, 50);
  const liquidityPositions = parseCollection(
    value.liquidityPositions,
    parseLiquidityPosition,
  );
  const stakePositions = parseCollection(value.stakePositions, parseStakePosition);
  const orders = parseCollection(value.orders ?? [], parseOrder);

  if (!balances || !activity || !liquidityPositions || !stakePositions || !orders) {
    return null;
  }

  return {
    balances,
    activity,
    liquidityPositions,
    stakePositions,
    orders,
  };
}
