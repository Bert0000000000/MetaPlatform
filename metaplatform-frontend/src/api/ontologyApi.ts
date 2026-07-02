import axios from "axios";
import { ObjectTypeSummary } from "../types/schema";

const http = axios.create({ baseURL: "/api/v1" });

const TENANT_ID = "00000000-0000-0000-0000-000000000001";

/** List all ObjectTypes from the ontology-engine. */
export async function listObjectTypes(): Promise<ObjectTypeSummary[]> {
  const { data } = await http.get<ObjectTypeSummary[]>("/object-types", {
    params: { tenantId: TENANT_ID },
  });
  return data;
}

/** Get a single ObjectType by ID. */
export async function getObjectType(id: string): Promise<ObjectTypeSummary> {
  const { data } = await http.get<ObjectTypeSummary>(`/object-types/${id}`);
  return data;
}

/** Get ObjectType by code. */
export async function getObjectTypeByCode(code: string): Promise<ObjectTypeSummary> {
  const { data } = await http.get<ObjectTypeSummary>(`/object-types/code/${code}`);
  return data;
}

/** Create a new ObjectType. */
export async function createObjectType(payload: Record<string, unknown>): Promise<ObjectTypeSummary> {
  const { data } = await http.post<ObjectTypeSummary>("/object-types", payload);
  return data;
}

/** Update an existing ObjectType. */
export async function updateObjectType(id: string, payload: Record<string, unknown>): Promise<ObjectTypeSummary> {
  const { data } = await http.put<ObjectTypeSummary>(`/object-types/${id}`, payload);
  return data;
}

/** Delete an ObjectType. */
export async function deleteObjectType(id: string): Promise<void> {
  await http.delete(`/object-types/${id}`);
}

/** NL Modeling: generate ObjectType from natural language description. */
export async function nlModeling(description: string): Promise<Record<string, unknown>> {
  const { data } = await http.post("/nl-modeling/object-types", { description });
  return data;
}

/** List all instances for a given ObjectType. */
export async function listObjectInstances(
  objectTypeId: string,
  tenantId: string = TENANT_ID,
): Promise<Record<string, unknown>[]> {
  const { data } = await http.get<Record<string, unknown>[]>("/object-instances", {
    params: { objectTypeId, tenantId },
  });
  return data;
}
