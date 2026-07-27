package com.metaplatform.ont.dto;

import lombok.Data;

import java.util.List;

@Data
public class AnalyzeRequest {

    private String sourceId;
    private List<String> tables;
}
