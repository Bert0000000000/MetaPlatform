package com.metaplatform.ea.valuestream.dto;

import lombok.Data;

@Data
public class UpdateValueStreamStageRequest {
    private String name;
    private String description;
    private Integer sortOrder;
}