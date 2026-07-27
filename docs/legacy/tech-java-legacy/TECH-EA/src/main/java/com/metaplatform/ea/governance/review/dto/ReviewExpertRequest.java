package com.metaplatform.ea.governance.review.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ReviewExpertRequest {

    @NotBlank(message = "专家用户 ID 不能为空")
    private String userId;

    @NotBlank(message = "专家姓名不能为空")
    private String name;

    private String role;
}
