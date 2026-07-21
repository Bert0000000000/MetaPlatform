package com.metaplatform.wfe.apphub.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class AppReleaseCreateRequest {

    private String appId;

    @NotBlank(message = "版本号不能为空")
    private String version;

    private String releaseNotes;

    @NotBlank(message = "发布策略不能为空")
    private String strategy;

    @NotNull(message = "灰度比例不能为空")
    private Integer grayPercent;

    private List<String> grayUsers;

    private List<String> grayDepts;

    @NotBlank(message = "技术负责人不能为空")
    private String techLeadId;

    @NotBlank(message = "运维审批人不能为空")
    private String opsOwnerId;
}
