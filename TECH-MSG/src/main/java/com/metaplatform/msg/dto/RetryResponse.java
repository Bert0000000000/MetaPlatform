package com.metaplatform.msg.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RetryResponse {

    private String outboxId;
    private String previousStatus;
    private String currentStatus;
    private Integer retryCount;
    private Instant scheduledAt;
    private String message;
}
