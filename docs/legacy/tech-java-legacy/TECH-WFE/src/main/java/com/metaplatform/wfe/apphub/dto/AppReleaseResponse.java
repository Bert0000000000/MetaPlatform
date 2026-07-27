package com.metaplatform.wfe.apphub.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AppReleaseResponse {

    private String releaseId;
    private String appId;
    private String version;
    private Map<String, Object> releaseNotes;
    private String strategy;
    private Integer grayPercent;
    private List<String> grayUsers;
    private List<String> grayDepts;
    private String status;
    private String approvalStatus;
    private String processInstanceId;
    private String createdBy;
    private Instant createdAt;
}
