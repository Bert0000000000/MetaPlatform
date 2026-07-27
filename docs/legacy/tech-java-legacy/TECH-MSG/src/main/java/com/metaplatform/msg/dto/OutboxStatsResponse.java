package com.metaplatform.msg.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OutboxStatsResponse {

    private long pending;
    private long sent;
    private long failed;
    private long total;
}
