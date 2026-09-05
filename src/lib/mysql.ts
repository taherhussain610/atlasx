import { parseSandboxState, SandboxState } from "@/lib/sandbox-state";
import {
  createPool,
  Pool,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";

const REQUIRED_ENVIRONMENT_VARIABLES = [
  "MYSQL_HOST",
  "MYSQL_DATABASE",
  "MYSQL_USER",
  "MYSQL_PASSWORD",
] as const;

type PortfolioRow = RowDataPacket & {
  state_json: string | object;
  client_updated_at: number | string;
  revision: number | string;
};

type CountRow = RowDataPacket & {
  portfolio_count: number | string;
};

type ColumnCountRow = RowDataPacket & {
  column_count: number | string;
};

type LockRow = RowDataPacket & {
  acquired: number | string | null;
};

type RevisionRow = RowDataPacket & {
  revision: number | string;
};

type AtlasGlobal = typeof globalThis & {
  atlasxMysqlPool?: Pool;
  atlasxMysqlSchema?: Promise<void>;
};

const atlasGlobal = globalThis as AtlasGlobal;

export type StoredPortfolio = {
  state: SandboxState;
  updatedAt: number;
  revision: number;
};

export class PortfolioCapacityError extends Error {}
export class PortfolioConflictError extends Error {}

export function isMysqlConfigured(): boolean {
  return REQUIRED_ENVIRONMENT_VARIABLES.every(
    (name) => typeof process.env[name] === "string" && process.env[name]?.trim(),
  );
}

function integerEnvironmentValue(
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}.`);
  }
  return value;
}

function mysqlPort(): number {
  return integerEnvironmentValue("MYSQL_PORT", 3306, 1, 65_535);
}

function getPool(): Pool {
  if (!isMysqlConfigured()) {
    throw new Error("MySQL is not configured.");
  }

  if (!atlasGlobal.atlasxMysqlPool) {
    atlasGlobal.atlasxMysqlPool = createPool({
      host: process.env.MYSQL_HOST,
      port: mysqlPort(),
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      waitForConnections: true,
      connectionLimit: 4,
      maxIdle: 4,
      idleTimeout: 60_000,
      queueLimit: 20,
      connectTimeout: 5_000,
      enableKeepAlive: true,
      timezone: "Z",
      charset: "utf8mb4",
      ssl:
        process.env.MYSQL_SSL === "true"
          ? { minVersion: "TLSv1.2", rejectUnauthorized: true }
          : undefined,
    });
  }

  return atlasGlobal.atlasxMysqlPool;
}

async function initializeSchema(): Promise<void> {
  const pool = getPool();
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS atlasx_sandbox_portfolios (
      portfolio_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      state_json JSON NOT NULL,
      client_updated_at BIGINT UNSIGNED NOT NULL,
      revision BIGINT UNSIGNED NOT NULL DEFAULT 1,
      updated_at TIMESTAMP(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3)
        ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (portfolio_id),
      INDEX idx_atlasx_portfolios_updated_at (updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const [columns] = await pool.execute<ColumnCountRow[]>(
    `
      SELECT COUNT(*) AS column_count
      FROM information_schema.columns
      WHERE
        table_schema = DATABASE()
        AND table_name = 'atlasx_sandbox_portfolios'
        AND column_name = 'revision'
    `,
  );
  if (Number(columns[0]?.column_count) === 0) {
    try {
      await pool.execute(`
        ALTER TABLE atlasx_sandbox_portfolios
        ADD COLUMN revision BIGINT UNSIGNED NOT NULL DEFAULT 1
        AFTER client_updated_at
      `);
    } catch (error) {
      if ((error as { code?: string }).code !== "ER_DUP_FIELDNAME") throw error;
    }
  }
}

async function ensureSchema(): Promise<void> {
  if (!atlasGlobal.atlasxMysqlSchema) {
    atlasGlobal.atlasxMysqlSchema = initializeSchema().catch((error: unknown) => {
      atlasGlobal.atlasxMysqlSchema = undefined;
      throw error;
    });
  }
  await atlasGlobal.atlasxMysqlSchema;
}

export async function loadSandboxPortfolio(
  portfolioId: string,
): Promise<StoredPortfolio | null> {
  await ensureSchema();
  const [rows] = await getPool().execute<PortfolioRow[]>(
    `
      SELECT state_json, client_updated_at, revision
      FROM atlasx_sandbox_portfolios
      WHERE portfolio_id = ?
      LIMIT 1
    `,
    [portfolioId],
  );
  const row = rows[0];
  if (!row) return null;

  const rawState =
    typeof row.state_json === "string"
      ? (JSON.parse(row.state_json) as unknown)
      : row.state_json;
  const state = parseSandboxState(rawState);
  const updatedAt = Number(row.client_updated_at);
  const revision = Number(row.revision);
  if (
    !state ||
    !Number.isSafeInteger(updatedAt) ||
    updatedAt < 0 ||
    !Number.isSafeInteger(revision) ||
    revision < 1
  ) {
    throw new Error("Stored portfolio data is invalid.");
  }

  return { state, updatedAt, revision };
}

export async function saveSandboxPortfolio(
  portfolioId: string,
  state: SandboxState,
  updatedAt: number,
  expectedRevision: number | null,
): Promise<number> {
  await ensureSchema();
  const stateJson = JSON.stringify(state);
  if (expectedRevision === null) {
    return createSandboxPortfolio(portfolioId, stateJson, updatedAt);
  }

  const [result] = await getPool().execute<ResultSetHeader>(
    `
      UPDATE atlasx_sandbox_portfolios
      SET
        state_json = ?,
        client_updated_at = ?,
        revision = revision + 1
      WHERE portfolio_id = ? AND revision = ?
    `,
    [stateJson, updatedAt, portfolioId, expectedRevision],
  );
  if (result.affectedRows !== 1) {
    throw new PortfolioConflictError("Portfolio revision conflict.");
  }
  return expectedRevision + 1;
}

async function createSandboxPortfolio(
  portfolioId: string,
  stateJson: string,
  updatedAt: number,
): Promise<number> {
  const pool = getPool();
  const connection = await pool.getConnection();
  let lockAcquired = false;

  try {
    const [lockRows] = await connection.query<LockRow[]>(
      "SELECT GET_LOCK('atlasx_portfolio_create', 2) AS acquired",
    );
    lockAcquired = Number(lockRows[0]?.acquired) === 1;
    if (!lockAcquired) throw new Error("Portfolio creation is busy.");

    const [existingRows] = await connection.execute<RevisionRow[]>(
      `
        SELECT revision
        FROM atlasx_sandbox_portfolios
        WHERE portfolio_id = ?
        LIMIT 1
      `,
      [portfolioId],
    );
    if (existingRows[0]) {
      throw new PortfolioConflictError("Portfolio already exists.");
    }

    const retentionDays = integerEnvironmentValue(
      "MYSQL_PORTFOLIO_RETENTION_DAYS",
      90,
      1,
      3_650,
    );
    await connection.query(`
      DELETE FROM atlasx_sandbox_portfolios
      WHERE updated_at < DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL ${retentionDays} DAY)
    `);

    const [countRows] = await connection.query<CountRow[]>(
      "SELECT COUNT(*) AS portfolio_count FROM atlasx_sandbox_portfolios",
    );
    const maximumPortfolios = integerEnvironmentValue(
      "MYSQL_MAX_PORTFOLIOS",
      100,
      1,
      10_000,
    );
    if (Number(countRows[0]?.portfolio_count) >= maximumPortfolios) {
      throw new PortfolioCapacityError("Portfolio capacity has been reached.");
    }

    try {
      await connection.execute<ResultSetHeader>(
        `
          INSERT INTO atlasx_sandbox_portfolios (
            portfolio_id,
            state_json,
            client_updated_at,
            revision
          )
          VALUES (?, ?, ?, 1)
        `,
        [portfolioId, stateJson, updatedAt],
      );
    } catch (error) {
      if ((error as { code?: string }).code === "ER_DUP_ENTRY") {
        throw new PortfolioConflictError("Portfolio already exists.");
      }
      throw error;
    }

    return 1;
  } finally {
    if (lockAcquired) {
      await connection
        .query("SELECT RELEASE_LOCK('atlasx_portfolio_create')")
        .catch(() => undefined);
    }
    connection.release();
  }
}
