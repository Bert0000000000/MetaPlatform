package com.metaplatform.iam.dto.user;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class UserStatusUpdateRequest {

    @NotBlank(message = "状态不能为空")
    @Pattern(regexp = "ENABLED|DISABLED|LOCKED",
            message = "状态必须为 ENABLED、DISABLED 或 LOCKED")
    private String status;
}
