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
public class AppVersionResponse {

    private String versionId;
    private String appId;
    private String version;
    private String status;
    private String changeLog;
    private String snapshot;
    private String publishedBy;
    private Instant publishedAt;
    private String rolledBackBy;
    private Instant rolledBackAt;
    private String createdBy;
    private Instant createdAt;
}
