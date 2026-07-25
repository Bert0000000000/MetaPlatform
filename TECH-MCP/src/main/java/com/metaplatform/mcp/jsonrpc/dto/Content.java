package com.metaplatform.mcp.jsonrpc.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * MCP {@code content} discriminated union. The wire format is {@code {"type": "text|image|resource", ...}}.
 * Subclasses carry the {@code type} discriminator field and Jackson dispatches on it.
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.EXISTING_PROPERTY, property = "type", visible = true)
@JsonSubTypes({
        @JsonSubTypes.Type(value = Content.TextContent.class, name = "text"),
        @JsonSubTypes.Type(value = Content.ImageContent.class, name = "image"),
        @JsonSubTypes.Type(value = Content.EmbeddedResource.class, name = "resource")
})
public abstract class Content {

    /**
     * Explicit no-args constructor. Lombok's {@code @NoArgsConstructor} on abstract classes
     * does not produce a usable accessor, so Jackson cannot instantiate subtypes during
     * polymorphic deserialisation without one. We declare it here rather than relying on
     * Lombok's defaults to keep behaviour consistent across compiler versions.
     */
    protected Content() {
    }

    @JsonProperty("type")
    public abstract String getType();

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode(callSuper = false)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class TextContent extends Content {
        /** Discriminator constant. */
        private String type;
        /** Plain text payload. */
        private String text;
        /** Optional annotations. */
        private Map<String, Object> annotations;

        @Override
        public String getType() {
            return type == null ? "text" : type;
        }
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode(callSuper = false)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ImageContent extends Content {
        private String type;
        /** Base64-encoded image bytes. */
        private String data;
        /** MIME type, e.g. {@code image/png}. */
        private String mimeType;
        private Map<String, Object> annotations;

        @Override
        public String getType() {
            return type == null ? "image" : type;
        }
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode(callSuper = false)
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class EmbeddedResource extends Content {
        private String type;
        /** Inline resource payload (text or blob). */
        private ResourceContent resource;
        private Map<String, Object> annotations;

        @Override
        public String getType() {
            return type == null ? "resource" : type;
        }
    }
}