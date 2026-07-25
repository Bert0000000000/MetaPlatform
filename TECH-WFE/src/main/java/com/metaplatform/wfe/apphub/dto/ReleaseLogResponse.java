package com.metaplatform.wfe.apphub.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReleaseLogResponse {

    private String logId;
    private String releaseId;
    private String action;
    private String operator;
    private Map<String, Object> remark;
    private Instant createdAt;
}
