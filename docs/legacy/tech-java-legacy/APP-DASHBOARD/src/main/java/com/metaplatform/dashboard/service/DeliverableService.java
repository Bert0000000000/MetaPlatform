package com.metaplatform.dashboard.service;

import com.metaplatform.dashboard.config.DashboardProperties;
import com.metaplatform.dashboard.dto.AskRequest;
import com.metaplatform.dashboard.dto.DeliverableStatsResponse;
import com.metaplatform.dashboard.entity.DeliverableEntity;
import com.metaplatform.dashboard.repository.DeliverableRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DeliverableService {

    private final DeliverableRepository repository;
    private final DashboardProperties properties;

    @Transactional(readOnly = true)
    public Page<DeliverableEntity> list(String userId, String type, String tag, String keyword,
                                        Integer page, Integer size) {
        int p = page == null || page < 1 ? 1 : page;
        int s = size == null || size < 1 ? 20 : Math.min(size, 100);
        Pageable pageable = PageRequest.of(p - 1, s, Sort.by(Sort.Direction.DESC, "createdAt"));
        String kw = (keyword == null || keyword.isBlank()) ? null : keyword.trim();
        String tg = (tag == null || tag.isBlank()) ? null : tag.trim();
        return repository.search(userId, type, tg, kw, pageable);
    }

    @Transactional(readOnly = true)
    public DeliverableEntity getById(String deliverableId) {
        return repository.findByDeliverableId(deliverableId)
                .orElseThrow(() -> new IllegalArgumentException("交付材料不存在: " + deliverableId));
    }

    @Transactional(readOnly = true)
    public String getContent(String deliverableId) {
        DeliverableEntity d = getById(deliverableId);
        return d.getDescription() != null ? d.getDescription() : "";
    }

    @Transactional(readOnly = true)
    public byte[] download(String deliverableId) {
        DeliverableEntity d = getById(deliverableId);
        String content = d.getDescription() != null ? d.getDescription() : "";
        return content.getBytes();
    }

    @Transactional
    public DeliverableEntity share(String deliverableId) {
        DeliverableEntity d = getById(deliverableId);
        if (d.getShareToken() == null || d.getShareToken().isBlank()) {
            d.setShareToken(UUID.randomUUID().toString().replace("-", ""));
            d.setSharedAt(java.time.LocalDateTime.now());
        }
        return repository.save(d);
    }

    @Transactional(readOnly = true)
    public DeliverableEntity getByShareToken(String shareToken) {
        return repository.findByShareToken(shareToken)
                .orElseThrow(() -> new IllegalArgumentException("分享链接无效或已失效"));
    }

    @Transactional
    public DeliverableEntity archive(String deliverableId) {
        DeliverableEntity d = getById(deliverableId);
        d.setStatus("ARCHIVED");
        return repository.save(d);
    }

    @Transactional
    public void delete(String deliverableId) {
        DeliverableEntity d = getById(deliverableId);
        d.setStatus("DELETED");
        repository.save(d);
    }

    @Transactional(readOnly = true)
    public Page<DeliverableEntity> search(String userId, String keyword, Integer page, Integer size) {
        return list(userId, null, null, keyword, page, size);
    }

    @Transactional(readOnly = true)
    public List<String> tags(String userId) {
        Set<String> tagSet = new LinkedHashSet<>();
        for (String tagStr : repository.findAllTagStrings(userId)) {
            if (tagStr != null && !tagStr.isBlank()) {
                for (String t : tagStr.split(",")) {
                    String trimmed = t.trim();
                    if (!trimmed.isEmpty()) {
                        tagSet.add(trimmed);
                    }
                }
            }
        }
        return List.copyOf(tagSet);
    }

    @Transactional(readOnly = true)
    public DeliverableStatsResponse stats(String userId) {
        long active = repository.countByUserIdAndStatus(userId, "ACTIVE");
        long archived = repository.countByUserIdAndStatus(userId, "ARCHIVED");
        long shared = repository.countByUserIdAndShareTokenIsNotNull(userId);
        return new DeliverableStatsResponse(active + archived, active, archived, shared);
    }

    /**
     * 对交付材料提问（简化实现：调用 TECH-LLMGW 或 TECH-RAG）。
     * TODO: 完整实现需对接 TECH-RAG 向量检索 + TECH-LLMGW 对话能力。
     */
    public String ask(String deliverableId, AskRequest request) {
        DeliverableEntity d = getById(deliverableId);
        String baseUrl = properties.getLlmgwBaseUrl();
        if (baseUrl != null && !baseUrl.isBlank()) {
            try {
                WebClient client = WebClient.builder().baseUrl(baseUrl).build();
                return client.post()
                        .uri("/api/v1/llmgw/chat")
                        .bodyValue(java.util.Map.of(
                                "prompt", request.question(),
                                "context", d.getDescription() != null ? d.getDescription() : "",
                                "source", "deliverable:" + deliverableId))
                        .retrieve()
                        .bodyToMono(String.class)
                        .block();
            } catch (Exception e) {
                return "LLMGW 调用失败: " + e.getMessage();
            }
        }
        return "LLMGW 服务未配置，无法回答。问题: " + request.question();
    }
}
