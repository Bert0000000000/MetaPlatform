package com.metaplatform.ont.dto;

import lombok.Data;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Data
public class OntologyVersionUpdateRequest {
    @NotBlank
    @Size(max = 2048)
    private String description;
}