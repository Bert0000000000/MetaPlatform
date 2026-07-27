package com.metaplatform.ont.dto;

import lombok.Data;

@Data
public class DataSourceDto {

    private String id;
    private String name;
    private String type;
    private String host;
    private Integer port;
    private String description;
}
