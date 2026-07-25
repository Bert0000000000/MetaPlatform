package com.metaplatform.mcp.jsonrpc.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * MCP {@code initialize} response (spec 2025-03-26).
 *
 * <p>{@link ServerCapabilities} fields are plain {@code Map}s (not strongly typed) so that the
 * shape mirrors the spec exactly without coupling to a particular Spring AI SDK release. If the
 * SDK ships typed capability classes in 1.2.0+, this DTO should be migrated then.</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class InitializeResult {

    /** MCP protocol version (e.g. {@code "2025-03-26"}). */
    private String protocolVersion;

    /** Server identification. */
    private ServerInfo serverInfo;

    /** Feature flags advertised by this server. */
    private ServerCapabilities capabilities;

    /** Optional instructions returned to the client. */
    private String instructions;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ServerInfo {
        private String name;
        private String version;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ServerCapabilities {
        /** Tools capability; {@code null} if not advertised. */
        private Map<String, Object> tools;
        /** Resources capability. */
        private Map<String, Object> resources;
        /** Prompts capability. */
        private Map<String, Object> prompts;
        /** Logging capability. */
        private Map<String, Object> logging;
        /** Completions capability. */
        private Map<String, Object> completions;
        /** Experimental fields. */
        private Map<String, Object> experimental;
    }
}