package com.metaplatform.ont.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EntityAttributeValueResponse {

    private String attributeId;
    private String attributeName;
    private Object value;
    private String dataType;
    private Boolean valid;
    private Boolean inherited;
}
