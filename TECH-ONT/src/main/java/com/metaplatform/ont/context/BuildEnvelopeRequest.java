package com.metaplatform.ont.context;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.*;
import java.util.*;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = false)
public class BuildEnvelopeRequest {
    @NotNull @Valid private InteractionContextDto interactionContext;
    @NotBlank private String userJwt;

    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = false)
    public static class InteractionContextDto {
        @NotBlank @Size(max=4096) private String message;
        @NotNull @Valid private InteractionDto interaction;
        private SubjectDto subject;
        private ViewStateDto viewState;
        private ClientHintsDto clientHints;
    }
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = false)
    public static class InteractionDto {
        @NotBlank @Pattern(regexp="^[a-z][a-z0-9_-]{2,32}$") private String appCode;
        @NotBlank @Pattern(regexp="^[a-z][a-z0-9_.-]{2,64}$") private String pageCode;
        @NotBlank @Size(max=2048) private String pageUrl;
        @Size(max=8192) private String selectedText;
        private String tenantId;
    }
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = false)
    public static class SubjectDto { @NotBlank private String conceptCode; @NotBlank private String objectId; }
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = false)
    public static class ViewStateDto { private String activeTab; private Map<String,Object> filters; private List<String> selectedMetrics; }
    @Data @Builder @NoArgsConstructor @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = false)
    public static class ClientHintsDto { private Boolean supportsStreaming; private Boolean supportsArtifacts; private String uiLocale; }
}
