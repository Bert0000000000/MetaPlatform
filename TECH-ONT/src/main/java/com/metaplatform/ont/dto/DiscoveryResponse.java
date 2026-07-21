package com.metaplatform.ont.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class DiscoveryResponse {

    private String taskId;
    private String status;
    private List<String> suggestions;
    private String message;
}
