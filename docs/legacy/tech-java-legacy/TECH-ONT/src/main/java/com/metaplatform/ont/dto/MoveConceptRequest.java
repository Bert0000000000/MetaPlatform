package com.metaplatform.ont.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class MoveConceptRequest {

    @Size(max = 64, message = "父概念 ID 长度不能超过 64")
    private String newParentConceptId;
}