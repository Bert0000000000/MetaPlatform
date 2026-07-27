package com.metaplatform.iam.dto.policy;

import com.metaplatform.iam.entity.PolicyEntity;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.Instant;
import java.util.List;

@Data
public class UpdatePolicyRequest {

    @NotBlank(message = "name 不能为空")
    @Size(max = 256, message = "name 长度不能超过 256")
    private String name;

    @NotNull(message = "subjectType 不能为空")
    private PolicyEntity.SubjectType subjectType;

    @NotBlank(message = "subjectId 不能为空")
    @Size(max = 64, message = "subjectId 长度不能超过 64")
    private String subjectId;

    @NotBlank(message = "resourceType 不能为空")
    @Size(max = 64, message = "resourceType 长度不能超过 64")
    private String resourceType;

    @NotEmpty(message = "resourceIds 不能为空")
    private List<String> resourceIds;

    @NotBlank(message = "action 不能为空")
    @Size(max = 64, message = "action 长度不能超过 64")
    private String action;

    @NotNull(message = "effect 不能为空")
    private PolicyEntity.Effect effect;

    @Size(max = 4000, message = "conditionExpression 长度不能超过 4000")
    private String conditionExpression;

    private Instant effectiveStartAt;

    private Instant effectiveEndAt;

    @NotNull(message = "priority 不能为空")
    private Integer priority;

    @NotNull(message = "enabled 不能为空")
    private Boolean enabled;

    @NotNull(message = "version 不能为空")
    private Integer version;
}
