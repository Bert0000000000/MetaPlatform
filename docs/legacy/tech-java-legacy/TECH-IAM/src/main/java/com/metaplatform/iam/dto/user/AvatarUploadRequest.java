package com.metaplatform.iam.dto.user;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class AvatarUploadRequest {

    @NotBlank(message = "头像不能为空")
    private String avatarUrl;
}
