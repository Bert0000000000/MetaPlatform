package com.metaplatform.wfe.apphub.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReleaseLogResponse {

    private String logId;
    private String releaseId;
    private String action;
    private String operator;
    private String remark;
    private Instant createdAt;
}
