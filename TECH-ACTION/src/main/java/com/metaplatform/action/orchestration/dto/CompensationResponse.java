package com.metaplatform.action.orchestration.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CompensationResponse {

    private String executionId;
    private String status;
    private List<NodeStateDto> compensatedNodes;
    private String errorMessage;
}
