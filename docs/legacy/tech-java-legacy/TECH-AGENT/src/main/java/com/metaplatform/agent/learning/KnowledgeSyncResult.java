package com.metaplatform.agent.learning;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 知识同步到 RAG 知识库的结果（V15-03）。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class KnowledgeSyncResult {

    private String employeeId;
    private int syncedCount;
    private List<String> documentIds;
}
