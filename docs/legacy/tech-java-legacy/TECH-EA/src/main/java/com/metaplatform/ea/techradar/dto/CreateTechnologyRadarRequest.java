package com.metaplatform.ea.techradar.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class CreateTechnologyRadarRequest {

    @NotBlank(message = "技术雷达名称不能为空")
    private String name;

    private List<String> quadrants;
    private List<String> rings;
    private List<TechnologyRadarItem> items;
    private String status;
}
