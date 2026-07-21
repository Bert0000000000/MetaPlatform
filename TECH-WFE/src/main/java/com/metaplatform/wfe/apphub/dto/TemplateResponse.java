package com.metaplatform.wfe.apphub.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TemplateResponse {

    private String templateId;
    private String name;
    private String category;
    private String description;
    private String icon;
    private List<String> tags;
    private Long downloadCount;
    private Double rating;
    private Long ratingCount;
    private String preview;
    private String configSnapshot;
    private Instant createdAt;
}
