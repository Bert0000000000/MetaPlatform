package com.metaplatform.ea.techstack.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class CreateTechnologyStackRequest {

    @NotBlank(message = "技术栈名称不能为空")
    private String name;

    private String applicationId;
    private String description;
    private List<TechnologyStackComponentRef> components;
    private String status;
}
