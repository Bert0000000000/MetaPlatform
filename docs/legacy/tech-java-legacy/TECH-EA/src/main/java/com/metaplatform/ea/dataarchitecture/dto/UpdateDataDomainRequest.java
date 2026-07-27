package com.metaplatform.ea.dataarchitecture.dto;

import lombok.Data;

@Data
public class UpdateDataDomainRequest {
    private String name;
    private String description;
    private String owner;
    private String metadata;
}