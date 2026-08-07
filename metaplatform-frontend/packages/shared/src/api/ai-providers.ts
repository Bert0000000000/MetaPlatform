/**
 * AI Provider connectivity test client (ADR-0019).
 *
 * The browser MUST NOT call upstream LLM provider endpoints directly
 * (CORS + API-key leakage). Instead, POST the desired probe parameters
 * to the platform-side endpoint and let the server handle the upstream
 * round-trip.
 */
import { apiClient } from './client';

export type ProviderId = 'openai' | 'azure' | 'ollama' | 'custom';

export interface ProviderTestRequest {
    provider: ProviderId;
    base_url: string;
    api_key?: string | null;
    api_version?: string | null;
    timeout_sec?: number;
}

export interface ProviderTestResponse {
    ok: boolean;
    status: number;
    latency_ms: number;
    provider: string;
    message: string;
    hint?: string | null;
    error?: string | null;
    probe_url?: string | null;
}

export async function testProvider(
    payload: ProviderTestRequest,
): Promise<ProviderTestResponse> {
    const resp = await apiClient.post<ProviderTestResponse>(
        '/api/v1/llmgw/providers/test',
        payload,
    );
    return resp.data;
}

export interface ProviderModelsResponse {
    ok: boolean;
    provider: string;
    models: string[];
    display_names: Record<string, string>;
    message: string;
}

export async function fetchProviderModels(
    payload: ProviderTestRequest,
): Promise<ProviderModelsResponse> {
    const resp = await apiClient.post<ProviderModelsResponse>(
        '/api/v1/llmgw/providers/models',
        payload,
    );
    return resp.data;
}
