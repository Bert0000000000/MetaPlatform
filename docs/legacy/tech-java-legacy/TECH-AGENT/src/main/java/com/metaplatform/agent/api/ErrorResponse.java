package com.metaplatform.agent.api;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ErrorResponse {
    private String errorCode;
    private String errorMessage;
    private Integer retryAfterSeconds;
    private String userActionHint;
    private Map<String, Object> metadata;
}
