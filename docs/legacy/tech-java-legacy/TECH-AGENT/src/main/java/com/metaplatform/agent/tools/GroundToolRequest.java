package com.metaplatform.agent.tools;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import java.util.Map;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class GroundToolRequest {
    @NotBlank private String envelopeId;
    @NotNull private Map<String, Object> input;
}
