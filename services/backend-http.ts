import "server-only";

import { NextResponse, type NextRequest } from "next/server";

import { BACKEND_API_URL } from "@/lib/auth";

const REQUEST_HEADERS_TO_REMOVE = [
  "accept-encoding",
  "connection",
  "content-length",
  "host",
];

const RESPONSE_HEADERS_TO_REMOVE = [
  "connection",
  "content-encoding",
  "content-length",
  "set-cookie",
  "transfer-encoding",
];

export function requestBackend(path: string, init?: RequestInit) {
  return fetch(buildBackendUrl(path), {
    ...init,
    cache: "no-store",
  });
}

export async function proxyBackendRequest(request: NextRequest, path: string[]) {
  const requestHeaders = new Headers(request.headers);

  for (const header of REQUEST_HEADERS_TO_REMOVE) {
    requestHeaders.delete(header);
  }

  try {
    const backendResponse = await requestBackend(buildProxyPath(request, path), {
      method: request.method,
      headers: requestHeaders,
      body: canHaveBody(request.method) ? await request.arrayBuffer() : undefined,
      redirect: "manual",
    });
    const responseHeaders = new Headers(backendResponse.headers);

    for (const header of RESPONSE_HEADERS_TO_REMOVE) {
      responseHeaders.delete(header);
    }

    const response = new NextResponse(
      canHaveResponseBody(request.method, backendResponse.status)
        ? await backendResponse.arrayBuffer()
        : null,
      {
        status: backendResponse.status,
        headers: responseHeaders,
      },
    );

    for (const cookie of getSetCookies(backendResponse.headers)) {
      response.headers.append("set-cookie", cookie);
    }

    return response;
  } catch {
    return NextResponse.json(
      { detail: "暂时无法连接服务，请稍后重试" },
      { status: 502 },
    );
  }
}

function buildBackendUrl(path: string) {
  return new URL(path.replace(/^\/+/, ""), `${BACKEND_API_URL}/`).toString();
}

function buildProxyPath(request: NextRequest, path: string[]) {
  const pathname = path.map((segment) => encodeURIComponent(segment)).join("/");
  return `${pathname}${request.nextUrl.search}`;
}

function canHaveBody(method: string) {
  return method !== "GET" && method !== "HEAD";
}

function canHaveResponseBody(method: string, status: number) {
  return method !== "HEAD" && ![204, 205, 304].includes(status);
}

function getSetCookies(headers: Headers) {
  const headersWithCookies = headers as Headers & {
    getSetCookie?: () => string[];
  };

  return (
    headersWithCookies.getSetCookie?.() ??
    ([headers.get("set-cookie")].filter(Boolean) as string[])
  );
}
