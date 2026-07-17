package com.metaplatform.ea.valuestream.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class CreateValueStreamRequest {

    @NotBlank(message = "价值流名称不能为空")
    private String name;

    @NotBlank(message = "价值流编码不能为空")
    private String code;

    private String description;
    private List<String> stages;
}
