package com.metaplatform.mcp.jsonrpc.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * MCP {@code resources/read} content block. Either {@link #text} or {@link #blob} is populated
 * depending on whether the resource is textual or binary (base64-encoded).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ResourceContent {

    /** Resource URI echoed back so the client can correlate. */
    private String uri;

    /** MIME type; matches the resource descriptor. */
    private String mimeType;

    /** UTF-8 text payload. */
    private String text;

    /** Base64-encoded binary payload. */
    private String blob;
}