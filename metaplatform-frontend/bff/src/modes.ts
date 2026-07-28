/**
 * API_MODE router (ST-6.4.1.2 / ST-6.4.2).
 */
import type { FastifyInstance, FastifyRequest } from "fastify";
import { env } from "./env.js";

export type ApiMode = "mock" | "live" | "hybrid";

interface RouteConfig {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  upstream?: string;
  mockResponse?: unknown;
}

export function should_mock(path: string, mode: ApiMode = env.API_MODE): boolean {
  if (mode === "live") return false;
  if (mode === "mock") return true;
  return !path.match(/\/(api|create|update|delete)\b/i);
}

export function register_routes(app: FastifyInstance, routes: RouteConfig[]): void {
  for (const route of routes) {
    app.route({
      method: route.method,
      url: route.path,
      handler: async (req: FastifyRequest) => {
        const use_mock = should_mock(route.path, env.API_MODE);
        if (use_mock) {
          return route.mockResponse ?? { mock: true, path: route.path };
        }
        const target = `${env.UPSTREAM_BASE}${route.upstream ?? route.path}`;
        const resp = await fetch(target, {
          method: req.method,
          headers: req.headers as Record<string, string>,
          body: req.method !== "GET" ? JSON.stringify(req.body) : undefined,
        });
        return resp.json();
      },
    });
  }
}