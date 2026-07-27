package com.metaplatform.kb.service;

import com.metaplatform.kb.entity.KbChunkEntity;
import com.metaplatform.kb.entity.KbChunkStrategyEntity;
import com.metaplatform.kb.entity.KbDocumentEntity;
import com.metaplatform.kb.repository.KbChunkRepository;
import com.metaplatform.kb.repository.KbChunkStrategyRepository;
import com.metaplatform.kb.repository.KbDocumentRepository;
import com.metaplatform.msg.topology.TopologyTopics;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;

/**
 * 切片服务（P2.1.4）。
 *
 * <p>支持 4 种策略：</p>
 * <ul>
 *   <li>PARAGRAPH：按 \n\n 段落切</li>
 *   <li>HEADING：按 Markdown/HTML 标题切</li>
 *   <li>TOKEN：按 token 数切（粗略字符数/4）</li>
 *   <li>SENTENCE：按句号 / 问号 / 感叹号切</li>
 * </ul>
 *
 * <p>切片去重：按 contentHash 跳过同 KB 内已存在切片。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class KbChunkerService {

    private final KbDocumentRepository documentRepository;
    private final KbChunkRepository chunkRepository;
    private final KbChunkStrategyRepository strategyRepository;
    private final KafkaTemplate<String, Object> kafkaTemplate;

    /**
     * 触发文档切片。
     *
     * @param documentId 文档 ID
     * @param rawContent 文档原始文本（解析后的纯文本）
     * @return 切片总数
     */
    public int chunkDocument(String documentId, String rawContent) {
        KbDocumentEntity doc = documentRepository.findByIdAndDeletedFalse(documentId).orElseThrow();
        KbChunkStrategyEntity strategy = doc.getStrategyId() == null
                ? defaultStrategy()
                : strategyRepository.findById(doc.getStrategyId()).orElse(defaultStrategy());

        List<String> pieces = switch (strategy.getStrategyKind()) {
            case "PARAGRAPH" -> splitBy(rawContent, "\n\n");
            case "HEADING"   -> splitByHeadings(rawContent);
            case "TOKEN"     -> splitByTokens(rawContent, strategy.getChunkSize(), strategy.getOverlap());
            case "SENTENCE"  -> splitBySentences(rawContent);
            default          -> List.of(rawContent);
        };

        int count = 0;
        int idx = 0;
        for (String piece : pieces) {
            if (piece == null || piece.isBlank()) continue;
            String hash = sha256(piece);
            // 同 KB 内去重
            if (chunkRepository.findByContentHashAndKbIdAndDeletedFalse(hash, doc.getKbId()).isEmpty()) {
                KbChunkEntity chunk = KbChunkEntity.builder()
                        .id("CH-" + UUID.randomUUID())
                        .tenantId(doc.getTenantId())
                        .kbId(doc.getKbId())
                        .documentId(documentId)
                        .chunkIndex(idx)
                        .content(piece)
                        .contentHash(hash)
                        .tokenCount(estimateTokens(piece))
                        .reviewStatus("PENDING")
                        .reviewed(false)
                        .deleted(false)
                        .createdAt(Instant.now())
                        .build();
                chunkRepository.save(chunk);
                count++;
            }
            idx++;
        }

        doc.setChunkCount(count);
        doc.setStatus("EMBEDDING");
        doc.setUpdatedAt(Instant.now());
        documentRepository.save(doc);

        kafkaTemplate.send(TopologyTopics.DOCUMENT_CHUNKED, documentId, Map.of(
                "documentId", documentId,
                "kbId", doc.getKbId(),
                "chunkCount", count
        ));
        log.info("[KbChunkerService] document={} chunks={} (after dedupe)", documentId, count);
        return count;
    }

    private List<String> splitBy(String text, String sep) {
        if (text == null || text.isEmpty()) return List.of();
        return Arrays.stream(text.split(java.util.regex.Pattern.quote(sep)))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }

    private List<String> splitByHeadings(String text) {
        // 简易 Markdown 标题：# / ## / ###
        if (text == null) return List.of();
        String[] lines = text.split("\n");
        List<String> result = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        for (String line : lines) {
            if (line.startsWith("# ")) {
                if (current.length() > 0) { result.add(current.toString().trim()); current.setLength(0); }
                current.append(line).append("\n");
            } else if (line.startsWith("## ") || line.startsWith("### ")) {
                if (current.length() > 0) { result.add(current.toString().trim()); current.setLength(0); }
                current.append(line).append("\n");
            } else {
                current.append(line).append("\n");
            }
        }
        if (current.length() > 0) result.add(current.toString().trim());
        return result;
    }

    private List<String> splitByTokens(String text, int chunkSize, int overlap) {
        // 粗略估算：1 token ≈ 4 字符
        int charSize = Math.max(1, chunkSize * 4);
        int charOverlap = Math.max(0, overlap * 4);
        List<String> result = new ArrayList<>();
        for (int i = 0; i < text.length(); i += (charSize - charOverlap)) {
            int end = Math.min(text.length(), i + charSize);
            result.add(text.substring(i, end));
            if (end >= text.length()) break;
        }
        return result;
    }

    private List<String> splitBySentences(String text) {
        if (text == null) return List.of();
        return Arrays.stream(text.split("[。！？!?]+\\s*"))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }

    private int estimateTokens(String s) {
        // 粗略估算：1 token ≈ 4 字符（中文按字符数计算）
        return (int) Math.ceil(s.length() / 4.0);
    }

    private KbChunkStrategyEntity defaultStrategy() {
        return KbChunkStrategyEntity.builder()
                .strategyKind("PARAGRAPH")
                .chunkSize(500)
                .overlap(50)
                .build();
    }

    private String sha256(String s) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(s.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
