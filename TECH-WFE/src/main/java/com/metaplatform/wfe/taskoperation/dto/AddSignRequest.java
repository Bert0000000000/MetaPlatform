package com.metaplatform.wfe.taskoperation.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class AddSignRequest {

    @NotBlank(message = "addsignUser 不能为空")
    private String addsignUser;

    private String reason;
}