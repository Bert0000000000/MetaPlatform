package com.metaplatform.mcp.server.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IdeConfigResponse {

    private String ideType;
    private String fileName;
    private String contentType;
    private String content;
}
