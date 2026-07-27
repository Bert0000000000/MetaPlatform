package com.metaplatform.ea.governance.review.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.UUID;

@Data
public class CreateReviewTicketRequest {

    @NotBlank(message = "工单标题不能为空")
    private String title;

    private UUID templateId;
    private String targetType;
    private UUID targetId;
    private String applicant;
    private String reviewer;
    private String metadata;
}
