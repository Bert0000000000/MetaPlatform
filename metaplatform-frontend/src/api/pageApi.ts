import axios from "axios";
import { PageConfigSummary, PageRender } from "../types/schema";

const http = axios.create({ baseURL: "/api" });

/* ---- Page Config CRUD ---- */

/** List all page configs. */
export async function listPageConfigs(): Promise<PageConfigSummary[]> {
  const { data } = await http.get<PageConfigSummary[]>("/page-configs");
  return data;
}

/** Get a single page config by ID. */
export async function getPageConfig(id: string): Promise<PageConfigSummary> {
  const { data } = await http.get<PageConfigSummary>(`/page-configs/${id}`);
  return data;
}

/** Render a page — returns the full PageRender JSON. */
export async function renderPage(id: string): Promise<PageRender> {
  const { data } = await http.get<PageRender>(`/pages/${id}/render`);
  return data;
}

/** Generate a page config from an ObjectType code. */
export async function generatePage(
  objectCode: string,
  options?: { pageType?: string; displayName?: string },
): Promise<PageConfigSummary> {
  const { data } = await http.post<PageConfigSummary>("/pages/quick-create", {
    objectCode,
    pageType: options?.pageType ?? "TABLE",
  });
  return data;
}

/** Delete a page config. */
export async function deletePage(id: string): Promise<void> {
  await http.delete(`/page-configs/${id}`);
}

/** Update a page config. */
export async function updatePageConfig(id: string, payload: Record<string, unknown>): Promise<PageConfigSummary> {
  const { data } = await http.put<PageConfigSummary>(`/page-configs/${id}`, payload);
  return data;
}

/** Create a new page config. */
export async function createPageConfig(payload: Record<string, unknown>): Promise<PageConfigSummary> {
  const { data } = await http.post<PageConfigSummary>("/page-configs", payload);
  return data;
}
