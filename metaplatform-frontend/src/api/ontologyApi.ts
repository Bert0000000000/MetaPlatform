import axios from "axios";
import { ObjectTypeSummary } from "../types/schema";

const http = axios.create({ baseURL: "/api/v1" });

/** List all ObjectTypes from the ontology-engine. */
export async function listObjectTypes(): Promise<ObjectTypeSummary[]> {
  const { data } = await http.get<ObjectTypeSummary[]>("/object-types", {
    params: { tenantId: "00000000-0000-0000-0000-000000000001" },
  });
  return data;
}

/** Get a single ObjectType by ID. */
export async function getObjectType(id: string): Promise<ObjectTypeSummary> {
  const { data } = await http.get<ObjectTypeSummary>(`/object-types/${id}`);
  return data;
}

/** List all instances for a given ObjectType. */
export async function listObjectInstances(
  objectTypeId: string,
  tenantId: string = "00000000-0000-0000-0000-000000000001",
): Promise<Record<string, unknown>[]> {
  const { data } = await http.get<Record<string, unknown>[]>("/object-instances", {
    params: { objectTypeId, tenantId },
  });
  return data;
}
