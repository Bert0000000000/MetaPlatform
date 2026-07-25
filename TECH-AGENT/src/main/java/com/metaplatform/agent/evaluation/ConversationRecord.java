package com.metaplatform.agent.evaluation;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * 对话记录（评估用）。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ConversationRecord {

    private String conversationId;
    private String employeeId;
    private String taskId;
    private List<ConversationMessageRecord> messages;
    private Double qualityScore;
    private String evaluatedBy;
    private OffsetDateTime evaluatedAt;
    private OffsetDateTime createdAt;

    /**
     * 对话中的单条消息。
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ConversationMessageRecord {
        private String id;
        private String role;
        private String content;
        private Map<String, Object> toolCall;
        private OffsetDateTime timestamp;
    }
}
