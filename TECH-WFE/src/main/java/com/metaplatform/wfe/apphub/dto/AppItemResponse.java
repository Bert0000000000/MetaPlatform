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
public class AppItemResponse {

    private String appId;
    private String name;
    private String code;
    private String description;
    private String icon;
    private String group;
    private String status;
    private Integer moduleCount;
    private Instant createdAt;
    private Instant updatedAt;
}
