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
public class AckResponse {

    private String consumerGroupId;
    private Boolean acknowledged;
    private Long consumedOffset;
    private Long lag;
    private Instant ackedAt;
}
