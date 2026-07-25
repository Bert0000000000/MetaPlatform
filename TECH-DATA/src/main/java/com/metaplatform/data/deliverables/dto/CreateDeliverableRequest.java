package com.metaplatform.data.deliverables.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * 创建交付物请求。
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CreateDeliverableRequest {

    @NotBlank
    @Size(max = 32)
    private String type;

    @NotBlank
    @Size(max = 256)
    private String title;

    @NotBlank
    @Size(max = 128)
    private String source;

    @Size(max = 1024)
    private String description = "";

    @NotBlank
    @Size(max = 16)
    private String format;

    private String createdBy;
}
