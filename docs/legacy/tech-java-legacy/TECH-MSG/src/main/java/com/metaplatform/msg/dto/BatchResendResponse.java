package com.metaplatform.msg.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BatchResendResponse {

    private int successCount;
    private int failedCount;
    private List<Map<String, String>> results;
}
