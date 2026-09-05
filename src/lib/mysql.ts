import { parseSandboxState, SandboxState } from "@/lib/sandbox-state";
import {
  createPool,
  Pool,
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
};

type AtlasGlobal = typeof globalThis & {
  atlasxMysqlPool?: Pool;
  atlasxMysqlSchema?: Promise<void>;
};

const atlasGlobal = globalThis as AtlasGlobal;

export type StoredPortfolio = {
  state: SandboxState;
  updatedAt: number;
};

export function isMysqlConfigured(): boolean {
  return REQUIRED_ENVIRONMENT_VARIABLES.every(
    (name) => typeof process.env[name] === "string" && process.env[name]?.trim(),
  );
}

function mysqlPort(): number {
  const port = Number(process.env.MYSQL_PORT ?? "3306");
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
    throw new Error("MYSQL_PORT must be a valid TCP port.");
  }
  return port;
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

async function ensureSchema(): Promise<void> {
  if (!atlasGlobal.atlasxMysqlSchema) {
    atlasGlobal.atlasxMysqlSchema = getPool()
      .execute(`
        CREATE TABLE IF NOT EXISTS atlasx_sandbox_portfolios (
          portfolio_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
          state_json JSON NOT NULL,
          client_updated_at BIGINT UNSIGNED NOT NULL,
          updated_at TIMESTAMP(3) NOT NULL
            DEFAULT CURRENT_TIMESTAMP(3)
            ON UPDATE CURRENT_TIMESTAMP(3),
          PRIMARY KEY (portfolio_id),
          INDEX idx_atlasx_portfolios_updated_at (updated_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `)
      .then(() => undefined)
      .catch((error: unknown) => {
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
      SELECT state_json, client_updated_at
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
  if (!state || !Number.isSafeInteger(updatedAt) || updatedAt < 0) {
    throw new Error("Stored portfolio data is invalid.");
  }

  return { state, updatedAt };
}

export async function saveSandboxPortfolio(
  portfolioId: string,
  state: SandboxState,
  updatedAt: number,
): Promise<void> {
  await ensureSchema();
  const stateJson = JSON.stringify(state);
  await getPool().execute(
    `
      INSERT INTO atlasx_sandbox_portfolios (
        portfolio_id,
        state_json,
        client_updated_at
      )
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
        state_json = IF(
          VALUES(client_updated_at) >= client_updated_at,
          VALUES(state_json),
          state_json
        ),
        client_updated_at = GREATEST(
          client_updated_at,
          VALUES(client_updated_at)
        )
    `,
    [portfolioId, stateJson, updatedAt],
  );
}
