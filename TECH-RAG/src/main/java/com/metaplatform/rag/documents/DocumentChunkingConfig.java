package com.metaplatform.rag.documents;

import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.document.DocumentTransformer;
import org.springframework.ai.transformer.splitter.TokenTextSplitter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 统一文档分块策略：使用 SAA {@link TokenTextSplitter} 作为默认 DocumentTransformer。
 *
 * <p>DocumentService 当前使用手写 splitText；引入本 Bean 后，
 * 业务侧可通过构造注入 {@link DocumentTransformer} 替换为统一策略，
 * 或在 {@code @ConditionalOnMissingBean} 不满足时继续走原 splitText 路径。</p>
 *
 * <p>注意：SAA 1.1.x 的 TokenTextSplitter 通过 Builder 配置 chunkSize / chunkOverlap /
 * minChunkSizeChars / keepSeparator 等；具体字段见 {@code TokenTextSplitter.Builder}。</p>
 */
@Slf4j
@Configuration
public class DocumentChunkingConfig {

    @Bean
    @ConditionalOnMissingBean(DocumentTransformer.class)
    public DocumentTransformer tokenTextSplitter(
            @Value("${rag.chunk.default-size:512}") int chunkSize,
            @Value("${rag.chunk.default-overlap:50}") int chunkOverlap) {
        log.info("Registering default DocumentTransformer=TokenTextSplitter (chunkSize={}, chunkOverlap={})",
            chunkSize, chunkOverlap);
        return TokenTextSplitter.builder()
            .withChunkSize(chunkSize)
            .withMinChunkSizeChars(Math.max(350, chunkOverlap * 2))
            .withMinChunkLengthToEmbed(5)
            .withMaxNumChunks(10000)
            .withKeepSeparator(true)
            .build();
    }
}