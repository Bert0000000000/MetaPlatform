package com.metaplatform.wfe.apphub.dto;

import lombok.Data;

@Data
public class AppUpdateRequest {

    private String name;
    private String code;
    private String description;
    private String icon;
    private String group;
    private String status;
}
