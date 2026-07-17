package com.metaplatform.gw.ratelimit.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RateLimitResetResponse {

    private String ruleId;
    private String resetType;
    private String scopeId;
    private LocalDateTime resetAt;
    private String resetBy;
}
