import { get, post, put, del } from './client';
import type { Attribute, AttributeCreateRequest, PageResponse } from '@/types';

const BASE = '/v1/ont/attributes';

export async function listAttributes(params?: {
  keyword?: string;
  dataType?: string;
  conceptId?: string;
}): Promise<PageResponse<Attribute>> {
  return get<PageResponse<Attribute>>(BASE, params);
}

export async function getAttribute(attributeId: string): Promise<Attribute> {
  return get<Attribute>(`${BASE}/${attributeId}`);
}

export async function createAttribute(request: AttributeCreateRequest): Promise<Attribute> {
  return post<Attribute>(BASE, request);
}

export async function updateAttribute(attributeId: string, request: AttributeCreateRequest): Promise<Attribute> {
  return put<Attribute>(`${BASE}/${attributeId}`, request);
}

export async function deleteAttribute(attributeId: string, cascade = false): Promise<void> {
  return del<void>(`${BASE}/${attributeId}?cascade=${cascade}`);
}
