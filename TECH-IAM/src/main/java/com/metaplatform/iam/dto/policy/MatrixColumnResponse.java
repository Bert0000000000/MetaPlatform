package com.metaplatform.iam.dto.policy;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MatrixColumnResponse {

    private String toolId;
    private String toolCode;
    private String toolName;
}
