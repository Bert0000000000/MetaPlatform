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
public class RateLimitStateResponse {

    private String ruleId;
    private String previousStatus;
    private String currentStatus;
    private LocalDateTime updatedAt;
    private String updatedBy;
}
