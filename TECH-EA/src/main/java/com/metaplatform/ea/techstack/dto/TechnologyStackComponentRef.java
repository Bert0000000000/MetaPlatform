package com.metaplatform.ea.techstack.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TechnologyStackComponentRef {

    private String componentId;
    private String componentName;
    private String version;
    private String type;
}
