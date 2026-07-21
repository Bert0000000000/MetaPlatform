package com.metaplatform.ea.techradar.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TechnologyRadarItem {

    private String id;
    private String name;
    private String quadrant;
    private String ring;
    private String trend;
    private String description;
}
