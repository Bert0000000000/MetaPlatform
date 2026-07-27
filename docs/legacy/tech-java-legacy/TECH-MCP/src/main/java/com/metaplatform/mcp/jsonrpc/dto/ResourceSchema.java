package com.metaplatform.mcp.jsonrpc.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * Wire-level MCP resource descriptor. Mirrors the entity's {@code uri/name/description/mimeType}
 * without exposing persistence concerns.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ResourceSchema {

    /** Stable URI used by clients to read/subscribe. */
    private String uri;

    /** Human-readable name. */
    private String name;

    /** Short description. */
    private String description;

    /** MIME type advertised to clients. */
    private String mimeType;

    /** Free-form annotations / metadata. */
    private Map<String, Object> annotations;
}