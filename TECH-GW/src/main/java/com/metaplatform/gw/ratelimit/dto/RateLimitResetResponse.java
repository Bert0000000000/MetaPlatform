package com.metaplatform.gw.ratelimit.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RateLimitResetResponse {

    private String ruleId;
    private String resetType;
    private String scopeId;
    private Instant resetAt;
    private String resetBy;
}
