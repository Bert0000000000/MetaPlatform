package com.metaplatform.rag.retrieval;

import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.rag.preretrieval.query.expansion.MultiQueryExpander;
import org.springframework.ai.rag.preretrieval.query.expansion.QueryExpander;
import org.springframework.ai.rag.preretrieval.query.transformation.QueryTransformer;
import org.springframework.ai.rag.preretrieval.query.transformation.RewriteQueryTransformer;
import org.springframework.ai.rag.retrieval.search.DocumentRetriever;
import org.springframework.ai.rag.retrieval.search.VectorStoreDocumentRetriever;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * RetrievalAugmentor 流水线配置：组装 SAA 高级 RAG 节点。
 *
 * <p>典型流水线：QueryRewrite（Transformer） → QueryExpansion（Expander） → DocumentRetrieval → Rerank → Augmentation</p>
 *
 * <p>说明：SAA 1.1+ 中 {@link QueryTransformer} / {@link QueryExpander} 是接口，
 * 具体实现分别由 {@link RewriteQueryTransformer} / {@link MultiQueryExpander} 提供，
 * 二者都通过 {@code builder()} 入口构建，并以 {@link ChatClient.Builder} 作为底层模型。</p>
 */
@Slf4j
@Configuration
public class RetrievalAugmentorConfig {

    /**
     * 向量库文档检索器：基于 Milvus 的相似度检索。
     */
    @Bean
    public DocumentRetriever vectorStoreDocumentRetriever(
            VectorStore vectorStore,
            @Value("${rag.retrieval.default-top-k:5}") int topK,
            @Value("${rag.retrieval.default-score-threshold:0.7}") double threshold) {
        log.info("Initializing VectorStoreDocumentRetriever (topK={}, threshold={})", topK, threshold);
        return VectorStoreDocumentRetriever.builder()
            .vectorStore(vectorStore)
            .similarityThreshold(threshold)
            .topK(topK)
            .build();
    }

    /**
     * 查询改写器：使用 ChatModel 对原始查询进行改写，使其更具体、更适合向量检索。
     */
    @Bean
    public QueryTransformer queryTransformer(ChatClient.Builder chatClientBuilder) {
        log.info("Initializing RewriteQueryTransformer");
        return RewriteQueryTransformer.builder()
            .chatClientBuilder(chatClientBuilder)
            .build();
    }

    /**
     * 查询扩展器：基于改写后的查询生成多个变体，提升召回率。
     */
    @Bean
    public QueryExpander queryExpander(ChatClient.Builder chatClientBuilder) {
        log.info("Initializing MultiQueryExpander");
        return MultiQueryExpander.builder()
            .chatClientBuilder(chatClientBuilder)
            .build();
    }
}