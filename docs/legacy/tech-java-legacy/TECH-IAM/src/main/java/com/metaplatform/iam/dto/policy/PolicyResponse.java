package com.metaplatform.iam.dto.policy;

import com.metaplatform.iam.entity.PolicyEntity;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PolicyResponse {

    private String id;
    private String name;
    private PolicyEntity.SubjectType subjectType;
    private String subjectId;
    private String resourceType;
    private List<String> resourceIds;
    private String action;
    private PolicyEntity.Effect effect;
    private String conditionExpression;
    private Instant effectiveStartAt;
    private Instant effectiveEndAt;
    private Integer priority;
    private Boolean enabled;
    private Integer version;
    private Instant createdAt;
    private Instant updatedAt;
    private String createdBy;
    private String updatedBy;
}
