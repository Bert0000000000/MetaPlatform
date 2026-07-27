package com.metaplatform.mcp.debug.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DebugCompareResponse {

    private DebugSessionResponse left;
    private DebugSessionResponse right;
    private List<String> differences;
}
