package com.metaplatform.ea.dataarchitecture.dto;

import lombok.Data;

@Data
public class UpdateDataStandardRequest {
    private String code;
    private String name;
    private String standardType;
    private String rule;
    private String description;
}
