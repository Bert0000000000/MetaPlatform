import axios from "axios";
import { PageConfigSummary, PageRender } from "../types/schema";

const http = axios.create({ baseURL: "/api/v1" });

/* ---- Page Config CRUD ---- */

/** List all page configs. */
export async function listPageConfigs(): Promise<PageConfigSummary[]> {
  const { data } = await http.get<PageConfigSummary[]>("/pages");
  return data;
}

/** Get a single page config by ID. */
export async function getPageConfig(id: string): Promise<PageConfigSummary> {
  const { data } = await http.get<PageConfigSummary>(`/pages/${id}`);
  return data;
}

/** Render a page — returns the full PageRender JSON. */
export async function renderPage(id: string): Promise<PageRender> {
  const { data } = await http.get<PageRender>(`/pages/${id}/render`);
  return data;
}

/** Generate a page config from an ObjectType ID. */
export async function generatePage(
  objectTypeId: string,
  options?: { pageType?: string; displayName?: string },
): Promise<PageConfigSummary> {
  const { data } = await http.post<PageConfigSummary>("/pages/generate", {
    objectTypeId,
    pageType: options?.pageType ?? "TABLE",
    displayName: options?.displayName,
  });
  return data;
}

/** Delete a page config. */
export async function deletePage(id: string): Promise<void> {
  await http.delete(`/pages/${id}`);
}
