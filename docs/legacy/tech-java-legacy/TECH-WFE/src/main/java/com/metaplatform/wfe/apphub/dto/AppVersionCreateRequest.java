package com.metaplatform.wfe.apphub.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class AppVersionCreateRequest {

    @NotBlank(message = "appId 不能为空")
    private String appId;

    @NotBlank(message = "version 不能为空")
    private String version;

    private String changeLog;

    @NotBlank(message = "snapshot 不能为空")
    private String snapshot;
}
