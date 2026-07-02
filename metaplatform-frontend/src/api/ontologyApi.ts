import axios from "axios";
import { ObjectTypeSummary } from "../types/schema";

const http = axios.create({ baseURL: "/api/v1" });

/** List all ObjectTypes from the ontology-engine. */
export async function listObjectTypes(): Promise<ObjectTypeSummary[]> {
  const { data } = await http.get<ObjectTypeSummary[]>("/object-types");
  return data;
}

/** Get a single ObjectType by ID. */
export async function getObjectType(id: string): Promise<ObjectTypeSummary> {
  const { data } = await http.get<ObjectTypeSummary>(`/object-types/${id}`);
  return data;
}
