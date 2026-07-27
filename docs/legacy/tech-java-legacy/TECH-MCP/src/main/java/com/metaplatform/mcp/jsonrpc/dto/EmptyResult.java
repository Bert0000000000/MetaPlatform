package com.metaplatform.mcp.jsonrpc.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Marker response for methods that return no data on success (e.g. {@code ping},
 * {@code notifications/initialized}). Serializes to {@code {}} so that the client receives
 * a well-formed JSON-RPC result instead of {@code null}.
 *
 * <p>Intentionally a plain class with an explicit no-args constructor — Lombok's
 * {@code @NoArgsConstructor}/{@code @Builder} cannot meaningfully process a class with no
 * fields, so we declare the constructor directly.</p>
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class EmptyResult {

    /** Explicit singleton used by handlers; serialises to {@code {}}. */
    public static final EmptyResult INSTANCE = new EmptyResult();

    public EmptyResult() {
    }
}