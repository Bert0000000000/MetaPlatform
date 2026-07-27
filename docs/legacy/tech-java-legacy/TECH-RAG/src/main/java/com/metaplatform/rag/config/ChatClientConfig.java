package com.metaplatform.rag.config;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.vectorstore.SimpleVectorStore;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

/**
 * ChatClient 统一配置。
 *
 * <p>向 SAA 高级 RAG 组件（QueryExpander / QueryTransformer / QueryAugmenter）暴露标准
 * {@link ChatClient.Builder}，以便在不直接绑定具体 ChatModel 的情况下实现查询改写、查询扩展等流水线节点。</p>
 */
@Configuration
public class ChatClientConfig {

    @Bean
    public ChatClient.Builder chatClientBuilder(ChatModel chatModel) {
        return ChatClient.builder(chatModel);
    }

    @Bean
    @Profile("dev")
    public VectorStore devVectorStore(EmbeddingModel embeddingModel) {
        return SimpleVectorStore.builder(embeddingModel).build();
    }
}