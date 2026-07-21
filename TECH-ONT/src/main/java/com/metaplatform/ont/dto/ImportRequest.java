package com.metaplatform.ont.dto;

import lombok.Data;

import java.util.List;

@Data
public class ImportRequest {

    private String sourceId;
    private List<String> conceptIds;
    private List<String> relationIds;
}
