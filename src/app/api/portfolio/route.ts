import {
  isMysqlConfigured,
  loadSandboxPortfolio,
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
  if (!origin) return true;
  try {
    return new URL(origin).host === request.nextUrl.host;
  } catch {
    return false;
  }
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
    const body = await request.text();
    if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) {
      return json({ configured: true, error: "Portfolio payload is too large." }, 413);
    }
    payload = JSON.parse(body) as unknown;
  } catch {
    return json({ configured: true, error: "Invalid JSON payload." }, 400);
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return json({ configured: true, error: "Invalid portfolio payload." }, 400);
  }

  const body = payload as Record<string, unknown>;
  const state = parseSandboxState(body.state);
  const updatedAt = body.updatedAt;
  if (
    !state ||
    !Number.isSafeInteger(updatedAt) ||
    Number(updatedAt) < 0 ||
    Number(updatedAt) > Date.now() + 5 * 60_000
  ) {
    return json({ configured: true, error: "Invalid portfolio payload." }, 400);
  }

  const identity = portfolioId(request);
  try {
    await saveSandboxPortfolio(identity.id, state, Number(updatedAt));
    const response = json({ configured: true, saved: true });
    if (identity.created) setPortfolioCookie(response, identity.id);
    return response;
  } catch {
    return json({ configured: true, error: "Database unavailable." }, 503);
  }
}
