package com.metaplatform.wfe.taskoperation.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TaskOperationResponse {

    private String id;
    private String taskId;
    private String type;
    private String operator;
    private String targetUser;
    private String reason;
    private Instant createdAt;
}