package com.metaplatform.ea.valuestream.dto;

import lombok.Data;

import java.util.List;

@Data
public class UpdateValueStreamRequest {

    private String name;
    private String description;
    private List<String> stages;
    private String status;
}
