import {
  isMysqlConfigured,
  loadSandboxPortfolio,
  PortfolioCapacityError,
  PortfolioConflictError,
  saveSandboxPortfolio,
} from "@/lib/mysql";
import { parseSandboxState } from "@/lib/sandbox-state";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const COOKIE_NAME = "atlasx_portfolio_id";
const MAX_BODY_BYTES = 64 * 1024;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(payload: unknown, status = 200): NextResponse {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function portfolioId(request: NextRequest): { id: string; created: boolean } {
  const existing = request.cookies.get(COOKIE_NAME)?.value;
  if (existing && UUID_PATTERN.test(existing)) {
    return { id: existing, created: false };
  }
  return { id: randomUUID(), created: true };
}

function setPortfolioCookie(response: NextResponse, id: string): void {
  response.cookies.set(COOKIE_NAME, id, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
}

function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === request.nextUrl.host;
  } catch {
    return false;
  }
}

async function readJsonBody(request: NextRequest): Promise<unknown> {
  if (!request.body) throw new Error("Request body is missing.");

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let body = "";
  let bytesRead = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytesRead += value.byteLength;
    if (bytesRead > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new RangeError("Portfolio payload is too large.");
    }
    body += decoder.decode(value, { stream: true });
  }
  body += decoder.decode();
  return JSON.parse(body) as unknown;
}

export async function GET(request: NextRequest) {
  if (!isMysqlConfigured()) {
    return json({ configured: false, portfolio: null });
  }

  const identity = portfolioId(request);
  try {
    const portfolio = await loadSandboxPortfolio(identity.id);
    const response = json({ configured: true, portfolio });
    if (identity.created) setPortfolioCookie(response, identity.id);
    return response;
  } catch {
    return json({ configured: true, error: "Database unavailable." }, 503);
  }
}

export async function PUT(request: NextRequest) {
  if (!isMysqlConfigured()) {
    return json({ configured: false, error: "Database is not configured." }, 503);
  }
  if (!isSameOrigin(request)) {
    return json({ configured: true, error: "Cross-origin request rejected." }, 403);
  }
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return json({ configured: true, error: "Expected a JSON request." }, 415);
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return json({ configured: true, error: "Portfolio payload is too large." }, 413);
  }

  let payload: unknown;
  try {
    payload = await readJsonBody(request);
  } catch (error) {
    if (error instanceof RangeError) {
      return json({ configured: true, error: "Portfolio payload is too large." }, 413);
    }
    return json({ configured: true, error: "Invalid JSON payload." }, 400);
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return json({ configured: true, error: "Invalid portfolio payload." }, 400);
  }

  const body = payload as Record<string, unknown>;
  const state = parseSandboxState(body.state);
  const updatedAt = body.updatedAt;
  const revision = body.revision;
  if (
    !state ||
    typeof updatedAt !== "number" ||
    !Number.isSafeInteger(updatedAt) ||
    updatedAt < 0 ||
    updatedAt > Date.now() + 5 * 60_000 ||
    !(
      revision === null ||
      (typeof revision === "number" &&
        Number.isSafeInteger(revision) &&
        revision >= 1)
    )
  ) {
    return json({ configured: true, error: "Invalid portfolio payload." }, 400);
  }

  const identity = portfolioId(request);
  try {
    const nextRevision = await saveSandboxPortfolio(
      identity.id,
      state,
      updatedAt,
      revision,
    );
    const response = json({ configured: true, saved: true, revision: nextRevision });
    if (identity.created) setPortfolioCookie(response, identity.id);
    return response;
  } catch (error) {
    if (error instanceof PortfolioConflictError) {
      return json({ configured: true, error: "Portfolio changed elsewhere." }, 409);
    }
    if (error instanceof PortfolioCapacityError) {
      return json({ configured: true, error: "Portfolio storage is full." }, 507);
    }
    return json({ configured: true, error: "Database unavailable." }, 503);
  }
}
