package com.metaplatform.iam.dto.policy;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MatrixRowResponse {

    private MatrixSubjectResponse subject;
    private Map<String, String> cells;
}
