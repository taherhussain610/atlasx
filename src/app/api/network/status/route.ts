import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type JsonRpcResponse = {
  result?: unknown;
  error?: { code?: number };
};

export async function GET() {
  const rpcUrl = process.env.TATUM_RPC_URL;
  const apiKey = process.env.TATUM_API_KEY;

  if (!rpcUrl || !apiKey) {
    return NextResponse.json(
      {
        configured: false,
        healthy: true,
        source: "sandbox",
        blockNumber: null,
        latencyMs: null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const parsedUrl = new URL(rpcUrl);
    if (parsedUrl.protocol !== "https:") {
      throw new Error("RPC URL must use HTTPS.");
    }

    const startedAt = performance.now();
    const response = await fetch(parsedUrl, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        id: 1,
        jsonrpc: "2.0",
        method: "eth_blockNumber",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    const latencyMs = Math.round(performance.now() - startedAt);

    if (!response.ok) {
      throw new Error(`RPC responded with status ${response.status}.`);
    }

    const payload = (await response.json()) as JsonRpcResponse;
    if (
      typeof payload.result !== "string" ||
      !/^0x[0-9a-f]+$/i.test(payload.result)
    ) {
      throw new Error("RPC returned an invalid block number.");
    }

    return NextResponse.json(
      {
        configured: true,
        healthy: true,
        source: "tatum",
        blockNumber: Number.parseInt(payload.result, 16),
        latencyMs,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        configured: true,
        healthy: false,
        source: "tatum",
        blockNumber: null,
        latencyMs: null,
      },
      {
        status: 502,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
