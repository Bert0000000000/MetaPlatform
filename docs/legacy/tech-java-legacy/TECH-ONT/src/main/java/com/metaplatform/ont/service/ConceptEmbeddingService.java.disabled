package com.metaplatform.ont.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * 概念向量化服务：将 Ontology 中的 Concept 节点向量化并写入 VectorStore。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ConceptEmbeddingService {

    private final VectorStore vectorStore;

    public void embedConcept(String conceptId, String name, String description, List<String> aliases) {
        String text = String.format("%s (%s): %s. 别名: %s",
                name, conceptId, description, String.join(", ", aliases));
        Document doc = new Document(conceptId, text, Map.of(
                "conceptId", conceptId,
                "name", name,
                "type", "concept"
        ));
        vectorStore.add(List.of(doc));
        log.info("概念向量化完成 | conceptId={} name={}", conceptId, name);
    }

    public List<Document> searchSimilarConcepts(String query, int topK) {
        return vectorStore.similaritySearch(SearchRequest.builder().query(query).topK(topK).build());
    }
}
