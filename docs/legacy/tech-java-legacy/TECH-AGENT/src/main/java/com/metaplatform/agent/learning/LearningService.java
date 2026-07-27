package com.metaplatform.agent.learning;

import com.metaplatform.agent.clients.RAGClient;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * 数字员工自学习服务（V15-03）。
 *
 * <p>内存实现：反馈记录与提炼知识存储在 ConcurrentHashMap 中。
 * 生产环境应替换为持久化存储并对接 TECH-RAG。</p>
 */
@Slf4j
@Service
public class LearningService {

    // ---- 枚举常量（字符串形式，与 Python str, Enum 对应） ----
    public static final String FB_THUMB_UP = "thumb_up";
    public static final String FB_THUMB_DOWN = "thumb_down";
    public static final String FB_SUGGESTION = "suggestion";

    public static final String KN_PROMPT_FRAGMENT = "prompt_fragment";
    public static final String KN_TOOL_RULE = "tool_rule";
    public static final String KN_PARAMETER_TEMPLATE = "parameter_template";
    public static final String KN_EXPERIENCE = "experience";

    public static final String RESULT_SUCCESS = "success";
    public static final String RESULT_FAILED = "failed";
    public static final String RESULT_PARTIAL = "partial";

    // feedbackId → record
    private final Map<String, FeedbackRecord> feedbackStore = new ConcurrentHashMap<>();
    // knowledgeId → knowledge
    private final Map<String, LearnedKnowledge> knowledgeStore = new ConcurrentHashMap<>();

    private final RAGClient ragClient;

    public LearningService(@Autowired(required = false) RAGClient ragClient) {
        this.ragClient = ragClient;
    }

    // =============================================================== feedback

    public FeedbackRecord recordFeedback(FeedbackCreateRequest request) {
        OffsetDateTime now = OffsetDateTime.now();
        FeedbackRecord record = FeedbackRecord.builder()
                .feedbackId("fb-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12))
                .employeeId(request.getEmployeeId())
                .taskId(request.getTaskId())
                .taskTitle(request.getTaskTitle() != null ? request.getTaskTitle() : "")
                .executionResult(request.getExecutionResult() != null ? request.getExecutionResult() : RESULT_SUCCESS)
                .feedbackType(request.getFeedbackType() != null ? request.getFeedbackType() : FB_THUMB_UP)
                .suggestion(request.getSuggestion() != null ? request.getSuggestion() : "")
                .tags(request.getTags() != null ? new ArrayList<>(request.getTags()) : new ArrayList<>())
                .createdAt(now)
                .build();
        feedbackStore.put(record.getFeedbackId(), record);
        return record;
    }

    public FeedbackRecord getFeedback(String feedbackId) {
        return feedbackStore.get(feedbackId);
    }

    public List<FeedbackRecord> listFeedback(String employeeId, String taskId) {
        List<FeedbackRecord> records = new ArrayList<>(feedbackStore.values());
        if (employeeId != null && !employeeId.isBlank()) {
            records = records.stream().filter(r -> employeeId.equals(r.getEmployeeId())).collect(Collectors.toList());
        }
        if (taskId != null && !taskId.isBlank()) {
            records = records.stream().filter(r -> taskId.equals(r.getTaskId())).collect(Collectors.toList());
        }
        records.sort(Comparator.comparing(FeedbackRecord::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())));
        return records;
    }

    public FeedbackRecord updateFeedbackTags(String feedbackId, List<String> tags) {
        FeedbackRecord record = feedbackStore.get(feedbackId);
        if (record == null) {
            return null;
        }
        record.setTags(new ArrayList<>(tags));
        record.setUpdatedAt(OffsetDateTime.now());
        return record;
    }

    // =============================================================== knowledge

    public List<LearnedKnowledge> extractKnowledge(List<FeedbackRecord> feedbackRecords) {
        List<LearnedKnowledge> created = new ArrayList<>();
        // 已提炼过的 feedbackId 集合
        java.util.Set<String> extractedIds = extractedFeedbackIds();
        for (FeedbackRecord record : feedbackRecords) {
            if (extractedIds.contains(record.getFeedbackId())) {
                continue;
            }
            LearnedKnowledge knowledge = buildKnowledge(record);
            if (knowledge != null) {
                knowledgeStore.put(knowledge.getKnowledgeId(), knowledge);
                created.add(knowledge);
            }
        }
        return created;
    }

    public List<LearnedKnowledge> listKnowledge(String employeeId, boolean syncedOnly) {
        List<LearnedKnowledge> items = knowledgeStore.values().stream()
                .filter(k -> employeeId.equals(k.getEmployeeId()))
                .collect(Collectors.toList());
        if (syncedOnly) {
            items = items.stream().filter(LearnedKnowledge::isSyncedToKb).collect(Collectors.toList());
        }
        items.sort(Comparator.comparing(LearnedKnowledge::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())));
        return items;
    }

    public KnowledgeSyncResult syncToKnowledgeBase(String employeeId) {
        List<LearnedKnowledge> pending = knowledgeStore.values().stream()
                .filter(k -> employeeId.equals(k.getEmployeeId()) && !k.isSyncedToKb())
                .collect(Collectors.toList());

        List<String> documentIds = new ArrayList<>();
        OffsetDateTime now = OffsetDateTime.now();
        for (LearnedKnowledge knowledge : pending) {
            String docId = "doc-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
            knowledge.setSyncedToKb(true);
            knowledge.setKbDocumentId(docId);
            knowledge.setUpdatedAt(now);
            documentIds.add(docId);
        }

        // 真实实现会调用 ragClient.indexDocuments(...)
        if (ragClient != null && !documentIds.isEmpty()) {
            log.debug("Mock sync {} knowledge fragments to RAG for employee {}", documentIds.size(), employeeId);
        }

        return KnowledgeSyncResult.builder()
                .employeeId(employeeId)
                .syncedCount(documentIds.size())
                .documentIds(documentIds)
                .build();
    }

    // =============================================================== stats

    public LearningStats getStats(String employeeId) {
        List<FeedbackRecord> records = listFeedback(employeeId, null);
        List<LearnedKnowledge> knowledge = listKnowledge(employeeId, false);

        int total = records.size();
        int thumbUp = (int) records.stream().filter(r -> FB_THUMB_UP.equals(r.getFeedbackType())).count();
        int thumbDown = (int) records.stream().filter(r -> FB_THUMB_DOWN.equals(r.getFeedbackType())).count();
        int suggestions = (int) records.stream().filter(r -> FB_SUGGESTION.equals(r.getFeedbackType())).count();
        int synced = (int) knowledge.stream().filter(LearnedKnowledge::isSyncedToKb).count();

        double successRate = 0.0;
        if (total > 0) {
            long success = records.stream().filter(r -> RESULT_SUCCESS.equals(r.getExecutionResult())).count();
            successRate = Math.round((double) success / total * 100.0) / 100.0;
        }

        // 统计标签频次
        Map<String, Long> tagCounts = new LinkedHashMap<>();
        for (FeedbackRecord r : records) {
            if (r.getTags() != null) {
                for (String tag : r.getTags()) {
                    tagCounts.merge(tag, 1L, Long::sum);
                }
            }
        }
        List<String> topTags = tagCounts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(5)
                .map(Map.Entry::getKey)
                .collect(Collectors.toList());

        return LearningStats.builder()
                .employeeId(employeeId)
                .totalFeedback(total)
                .thumbUp(thumbUp)
                .thumbDown(thumbDown)
                .suggestions(suggestions)
                .knowledgeFragments(knowledge.size())
                .syncedFragments(synced)
                .successRate(successRate)
                .topTags(topTags)
                .build();
    }

    // =============================================================== internal

    private java.util.Set<String> extractedFeedbackIds() {
        java.util.Set<String> ids = new java.util.HashSet<>();
        for (LearnedKnowledge k : knowledgeStore.values()) {
            if (k.getSourceFeedbackIds() != null) {
                ids.addAll(k.getSourceFeedbackIds());
            }
        }
        return ids;
    }

    private LearnedKnowledge buildKnowledge(FeedbackRecord record) {
        String title;
        String content;
        String knowledgeType;
        double confidence;

        String taskLabel = (record.getTaskTitle() != null && !record.getTaskTitle().isBlank())
                ? record.getTaskTitle() : record.getTaskId();

        switch (record.getFeedbackType()) {
            case FB_THUMB_UP:
                title = "成功经验：" + taskLabel;
                content = "任务「" + taskLabel + "」执行成功。执行结果：" + record.getExecutionResult()
                        + "。可作为后续相似任务的参考。";
                knowledgeType = KN_EXPERIENCE;
                confidence = 0.9;
                break;
            case FB_THUMB_DOWN:
                title = "改进建议：" + taskLabel;
                content = "任务「" + taskLabel + "」执行未达预期。执行结果：" + record.getExecutionResult()
                        + "。用户反馈：" + (record.getSuggestion() != null && !record.getSuggestion().isBlank()
                        ? record.getSuggestion() : "无详细说明")
                        + "。执行相似任务时应避免相同问题。";
                knowledgeType = KN_EXPERIENCE;
                confidence = 0.85;
                break;
            default:
                if (record.getSuggestion() == null || record.getSuggestion().isBlank()) {
                    return null;
                }
                title = "参数/规则建议：" + taskLabel;
                content = "用户针对任务「" + taskLabel + "」提出建议：" + record.getSuggestion();
                knowledgeType = (record.getSuggestion().contains("参数")
                        || record.getSuggestion().toLowerCase().contains("template"))
                        ? KN_PARAMETER_TEMPLATE : KN_TOOL_RULE;
                confidence = 0.75;
                break;
        }

        return LearnedKnowledge.builder()
                .knowledgeId("kn-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12))
                .employeeId(record.getEmployeeId())
                .knowledgeType(knowledgeType)
                .title(title)
                .content(content)
                .sourceFeedbackIds(List.of(record.getFeedbackId()))
                .taskPattern(taskLabel)
                .tags(record.getTags() != null ? new ArrayList<>(record.getTags()) : new ArrayList<>())
                .confidence(confidence)
                .createdAt(OffsetDateTime.now())
                .build();
    }
}
