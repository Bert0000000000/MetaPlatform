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
public class TaskHistoryEntry {

    private String type;
    private String operator;
    private String targetUser;
    private String reason;
    private String message;
    private String status;
    private Instant timestamp;
}