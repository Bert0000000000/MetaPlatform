package com.metaplatform.ea.techradar.dto;

import lombok.Data;

import java.util.List;

@Data
public class UpdateTechnologyRadarRequest {

    private String name;
    private List<String> quadrants;
    private List<String> rings;
    private List<TechnologyRadarItem> items;
    private String status;
}
