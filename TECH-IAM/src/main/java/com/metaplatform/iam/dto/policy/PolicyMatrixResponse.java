package com.metaplatform.iam.dto.policy;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PolicyMatrixResponse {

    private String type;
    private String action;
    private List<MatrixColumnResponse> columns;
    private List<MatrixRowResponse> rows;
}
