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
public class ConditionSyntaxResponse {

    private String syntax;
    private String description;
    private List<String> examples;
    private List<String> variables;
}
