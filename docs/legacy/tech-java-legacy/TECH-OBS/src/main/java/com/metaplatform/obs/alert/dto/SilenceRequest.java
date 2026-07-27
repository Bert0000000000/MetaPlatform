package com.metaplatform.obs.alert.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SilenceRequest {

    private int durationSeconds;
    private String reason;
    private String createdBy;
}