package com.metaplatform.gw.ratelimit.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RateLimitResetRequest {

    private String resetType;

    private String scopeId;

    private String reason;
}
