package com.metaplatform.rag.graph.service;

import com.alibaba.cloud.ai.graph.CompiledGraph;
import com.alibaba.cloud.ai.graph.KeyStrategy;
import com.alibaba.cloud.ai.graph.KeyStrategyFactory;
import com.alibaba.cloud.ai.graph.OverAllState;
import com.alibaba.cloud.ai.graph.StateGraph;
import com.alibaba.cloud.ai.graph.action.AsyncNodeAction;
import com.alibaba.cloud.ai.graph.action.NodeAction;
import com.alibaba.cloud.ai.graph.exception.GraphStateException;
import com.metaplatform.rag.entity.ChunkEntity;
import com.metaplatform.rag.graph.dto.GraphSearchRequest;
import com.metaplatform.rag.graph.dto.GraphSearchResponse;
import com.metaplatform.rag.graph.dto.GraphSearchResult;
import com.metaplatform.rag.repository.ChunkRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * GraphRAG 检索服务：基于 SAA Graph Core 编排"实体识别 → 关系扩展 → 文档召回"流程。
 *
 * <p>{@link #search(GraphSearchRequest)}：兼容现有契约的关键词匹配实现，用于回退。</p>
 * <p>{@link #graphSearch(GraphSearchRequest)}：使用 SAA Graph Core 编排（推荐）。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GraphSearchService {

    private final ChunkRepository chunkRepository;
    private final ChatModel chatModel;

    @Transactional(readOnly = true)
    public GraphSearchResponse search(GraphSearchRequest request) {
        List<ChunkEntity> chunks = chunkRepository.findAllByKbId(request.kbId());
        String keyword = request.query().toLowerCase();
        int limit = request.topK() != null ? request.topK() : 5;
        List<GraphSearchResult> results = chunks.stream()
            .filter(c -> c.getContent() != null && c.getContent().toLowerCase().contains(keyword))
            .limit(limit)
            .map(c -> new GraphSearchResult(
                c.getId(),
                c.getDocId(),
                c.getContent(),
                "keyword_match",
                0.5
            ))
            .toList();
        return new GraphSearchResponse(results);
    }

    /**
     * GraphRAG 主入口：使用 SAA Graph Core 编排检索流程。
     *
     * <p>节点：entity_extraction → graph_traversal</p>
     *
     * <p>若 ChatModel / Graph Core 不可用，回退到 {@link #search(GraphSearchRequest)}。</p>
     */
    @Transactional(readOnly = true)
    public GraphSearchResponse graphSearch(GraphSearchRequest request) {
        if (chatModel == null) {
            log.warn("ChatModel unavailable, fallback to keyword graph search");
            return search(request);
        }

        try {
            KeyStrategyFactory keyStrategyFactory = KeyStrategy.builder()
                .addStrategy("query", KeyStrategy.REPLACE)
                .addStrategy("entities", KeyStrategy.REPLACE)
                .addStrategy("results", KeyStrategy.REPLACE)
                .build();

            StateGraph stateGraph = new StateGraph("graphRagSearch", keyStrategyFactory);

            // 节点 1：实体识别（基于 ChatModel）
            NodeAction entityExtraction = state -> {
                String query = (String) state.value("query").orElse("");
                String prompt = "从下列查询中抽取核心实体（名词短语，逗号分隔，不要解释）：\n" + query;
                String raw = chatModel.call(new Prompt(prompt)).getResult().getOutput().getText();
                List<String> entities = parseEntities(raw);
                Map<String, Object> updates = new HashMap<>();
                updates.put("entities", entities);
                return updates;
            };

            // 节点 2：关系扩展 + 文档召回（基于 ChunkRepository 关键词匹配作为 GraphRAG 落地）
            NodeAction graphTraversal = state -> {
                List<String> entities = (List<String>) state.value("entities").orElse(List.of());
                List<ChunkEntity> chunks = chunkRepository.findAllByKbId(request.kbId());
                int topK = request.topK() != null ? request.topK() : 5;
                List<GraphSearchResult> results = new ArrayList<>();

                List<String> keywords = new ArrayList<>();
                if (!entities.isEmpty()) {
                    keywords.addAll(entities);
                }
                keywords.add(request.query().toLowerCase());

                for (String kw : keywords) {
                    String keyword = kw.toLowerCase();
                    for (ChunkEntity c : chunks) {
                        if (results.size() >= topK) {
                            break;
                        }
                        if (c.getContent() != null && c.getContent().toLowerCase().contains(keyword)) {
                            results.add(new GraphSearchResult(
                                c.getId(),
                                c.getDocId(),
                                c.getContent(),
                                "graph_entity_" + keyword,
                                0.7
                            ));
                        }
                    }
                    if (results.size() >= topK) {
                        break;
                    }
                }
                Map<String, Object> updates = new HashMap<>();
                updates.put("results", results);
                return updates;
            };

            stateGraph.addNode("entity_extraction", AsyncNodeAction.node_async(entityExtraction));
            stateGraph.addNode("graph_traversal", AsyncNodeAction.node_async(graphTraversal));
            stateGraph.addEdge(StateGraph.START, "entity_extraction");
            stateGraph.addEdge("entity_extraction", "graph_traversal");
            stateGraph.addEdge("graph_traversal", StateGraph.END);

            CompiledGraph compiled = stateGraph.compile();

            Map<String, Object> input = new HashMap<>();
            input.put("query", request.query());

            Optional<OverAllState> stateOptional = compiled.invoke(input);
            List<GraphSearchResult> results = new ArrayList<>();
            if (stateOptional.isPresent()) {
                OverAllState finalState = stateOptional.get();
                Object raw = finalState.value("results").orElse(List.of());
                if (raw instanceof List<?> list) {
                    for (Object o : list) {
                        if (o instanceof GraphSearchResult r) {
                            results.add(r);
                        }
                    }
                }
            }
            if (results.isEmpty()) {
                return search(request);
            }
            return new GraphSearchResponse(results);
        } catch (GraphStateException | RuntimeException e) {
            log.warn("SAA Graph Core compile/invoke failed, fallback to keyword graph search", e);
            return search(request);
        }
    }

    private List<String> parseEntities(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        String[] parts = raw.split("[,，、;；\\n\\r]");
        List<String> out = new ArrayList<>();
        for (String p : parts) {
            String t = p.trim();
            if (!t.isEmpty() && t.length() <= 64) {
                out.add(t);
            }
        }
        return out;
    }
}