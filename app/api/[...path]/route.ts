import type { NextRequest } from "next/server";

import { proxyBackendRequest } from "@/services/backend-http";

type ProxyRouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

async function handler(request: NextRequest, context: ProxyRouteContext) {
  const { path } = await context.params;
  return proxyBackendRequest(request, path);
}

export {
  handler as DELETE,
  handler as GET,
  handler as HEAD,
  handler as OPTIONS,
  handler as PATCH,
  handler as POST,
  handler as PUT,
};
