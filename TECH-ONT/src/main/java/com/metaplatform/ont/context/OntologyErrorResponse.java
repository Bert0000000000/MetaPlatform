package com.metaplatform.ont.context;

import lombok.*;
import java.util.Map;

@Data @Builder @NoArgsConstructor @AllArgsConstructor
public class OntologyErrorResponse {
    private String errorCode;
    private String errorMessage;
    private Integer retryAfterSeconds;
    private String userActionHint;
    private Map<String,Object> metadata;
}
