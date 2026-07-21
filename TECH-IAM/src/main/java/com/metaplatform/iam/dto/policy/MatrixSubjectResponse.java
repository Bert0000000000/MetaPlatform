package com.metaplatform.iam.dto.policy;

import com.metaplatform.iam.entity.PolicyEntity;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MatrixSubjectResponse {

    private String subjectId;
    private String subjectName;
    private PolicyEntity.SubjectType subjectType;
}
