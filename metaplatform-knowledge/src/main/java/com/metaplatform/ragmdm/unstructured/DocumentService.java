package com.metaplatform.ragmdm.unstructured;

import com.metaplatform.ragmdm.common.JsonUtils;
import com.metaplatform.ragmdm.common.exception.ResourceNotFoundException;
import com.metaplatform.ragmdm.common.exception.StorageException;
import com.metaplatform.ragmdm.domain.Document;
import com.metaplatform.ragmdm.domain.DocumentChunk;
import com.metaplatform.ragmdm.domain.KnowledgeBase;
import com.metaplatform.ragmdm.domain.enums.DocumentStatus;
import com.metaplatform.ragmdm.domain.enums.KnowledgeBaseType;
import com.metaplatform.ragmdm.domain.repository.DocumentChunkRepository;
import com.metaplatform.ragmdm.domain.repository.DocumentRepository;
import com.metaplatform.ragmdm.domain.repository.KnowledgeBaseRepository;
import com.metaplatform.ragmdm.rag.ChunkingService;
import com.metaplatform.ragmdm.rag.ContentExtractor;
import com.metaplatform.ragmdm.rag.EmbeddingClient;
import com.metaplatform.ragmdm.rag.VectorSearchService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class DocumentService {

    private final DocumentRepository documentRepository;
    private final DocumentChunkRepository chunkRepository;
    private final KnowledgeBaseRepository knowledgeBaseRepository;
    private final ContentExtractor contentExtractor;
    private final ChunkingService chunkingService;
    private final EmbeddingClient embeddingClient;
    private final VectorSearchService vectorSearchService;

    @Value("${metaplatform.storage.base-path}")
    private String storageBasePath;

    /**
     * 上传文档并索引
     */
    @Transactional
    public Document upload(MultipartFile file, Long knowledgeBaseId,
                           String title, String createdBy) {
        KnowledgeBase kb = knowledgeBaseRepository.findById(knowledgeBaseId)
            .orElseThrow(() -> new ResourceNotFoundException("KnowledgeBase", knowledgeBaseId));

        // 1. 保存文件到磁盘
        String storagePath = saveFile(file, knowledgeBaseId);

        // 2. 创建 Document 记录
        Document doc = new Document();
        doc.setTitle(title != null ? title : file.getOriginalFilename());
        doc.setFileName(file.getOriginalFilename());
        doc.setFileType(extractFileType(file.getOriginalFilename()));
        doc.setFileSize(file.getSize());
        doc.setKnowledgeBaseId(knowledgeBaseId);
        doc.setStoragePath(storagePath);
        doc.setStatus(DocumentStatus.UPLOADED);
        doc.setVersion(1);
        doc.setCreatedBy(createdBy);
        doc = documentRepository.save(doc);

        // 3. 异步处理: 提取内容 -> 分块 -> 向量化 -> 存储
        if (kb.getType() == KnowledgeBaseType.RAG || kb.getType() == KnowledgeBaseType.HYBRID) {
            processDocumentAsync(doc.getId(), kb);
        }

        return doc;
    }

    /**
     * 异步处理文档
     */
    @Async("documentProcessingExecutor")
    @Transactional
    public void processDocumentAsync(Long documentId, KnowledgeBase kb) {
        Document doc = documentRepository.findById(documentId).orElse(null);
        if (doc == null) {
            log.error("Document not found for async processing: {}", documentId);
            return;
        }

        try {
            // 1. 提取纯文本内容
            doc.setStatus(DocumentStatus.CHUNKING);
            documentRepository.save(doc);

            String rawContent = contentExtractor.extract(doc.getStoragePath(), doc.getFileType());
            doc.setRawContent(rawContent);
            documentRepository.save(doc);

            // 2. 分块
            List<ChunkingService.ChunkResult> chunkResults = chunkingService.smartChunk(
                rawContent,
                kb.getChunkSize() != null ? kb.getChunkSize() : 512,
                kb.getChunkOverlap() != null ? kb.getChunkOverlap() : 50);

            // 3. 批量嵌入
            List<String> chunkTexts = chunkResults.stream()
                .map(ChunkingService.ChunkResult::content)
                .toList();
            List<float[]> embeddings = embeddingClient.embedBatch(chunkTexts);

            // 4. 保存 Chunk 记录 + 准备向量存储
            List<VectorSearchService.VectorEntry> vectorEntries = new ArrayList<>();
            int i = 0;
            for (ChunkingService.ChunkResult chunkResult : chunkResults) {
                DocumentChunk chunk = new DocumentChunk();
                chunk.setDocumentId(doc.getId());
                chunk.setChunkIndex(chunkResult.index());
                chunk.setContent(chunkResult.content());
                chunk.setStartPosition(chunkResult.startPosition());
                chunk.setEndPosition(chunkResult.endPosition());
                chunk.setEmbeddingJson(JsonUtils.toJson(embeddings.get(i)));
                chunk.setVectorId("doc_" + doc.getId() + "_chunk_" + chunkResult.index());
                chunk = chunkRepository.save(chunk);

                vectorEntries.add(new VectorSearchService.VectorEntry(
                    chunk.getVectorId(),
                    embeddings.get(i),
                    Map.of(
                        "documentId", doc.getId(),
                        "chunkId", chunk.getId(),
                        "chunkIndex", chunkResult.index(),
                        "knowledgeBaseId", doc.getKnowledgeBaseId(),
                        "title", doc.getTitle()
                    )
                ));

                i++;
            }

            // 5. 批量存储向量
            vectorSearchService.storeBatch(vectorEntries);

            // 6. 更新状态
            doc.setStatus(DocumentStatus.INDEXED);
            documentRepository.save(doc);

            // 7. 更新知识库统计
            kb.setDocumentCount(kb.getDocumentCount() + 1);
            kb.setChunkCount(kb.getChunkCount() + chunkResults.size());
            knowledgeBaseRepository.save(kb);

            log.info("Document indexed: id={}, chunks={}", doc.getId(), chunkResults.size());

        } catch (Exception e) {
            doc.setStatus(DocumentStatus.FAILED);
            documentRepository.save(doc);
            log.error("Document processing failed: id={}", doc.getId(), e);
        }
    }

    public Document getById(Long id) {
        return documentRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Document", id));
    }

    public Page<Document> listByKnowledgeBase(Long kbId, Pageable pageable) {
        return documentRepository.findByKnowledgeBaseId(kbId, pageable);
    }

    @Transactional
    public void delete(Long id) {
        Document doc = getById(id);

        // 删除向量
        try {
            vectorSearchService.deleteByDocumentId(doc.getId());
        } catch (Exception e) {
            log.warn("Vector delete failed: {}", e.getMessage());
        }

        // 删除文件
        deleteFile(doc.getStoragePath());

        // 删除记录
        documentRepository.deleteById(id);

        // 更新统计
        KnowledgeBase kb = knowledgeBaseRepository
            .findById(doc.getKnowledgeBaseId()).orElse(null);
        if (kb != null) {
            List<DocumentChunk> chunks = chunkRepository.findByDocumentId(doc.getId());
            kb.setDocumentCount(Math.max(0, kb.getDocumentCount() - 1));
            kb.setChunkCount(Math.max(0, kb.getChunkCount() - chunks.size()));
            knowledgeBaseRepository.save(kb);
        }
    }

    private String saveFile(MultipartFile file, Long kbId) {
        try {
            String dir = storageBasePath + "/" + kbId;
            Files.createDirectories(Path.of(dir));
            String fileName = UUID.randomUUID() + "_" + file.getOriginalFilename();
            Path filePath = Path.of(dir, fileName);
            file.transferTo(filePath.toFile());
            return filePath.toString();
        } catch (IOException e) {
            throw new StorageException("File save failed: " + e.getMessage(), e);
        }
    }

    private String extractFileType(String fileName) {
        if (fileName == null) return "unknown";
        int dotIndex = fileName.lastIndexOf('.');
        return dotIndex > 0 ? fileName.substring(dotIndex + 1).toLowerCase() : "unknown";
    }

    private void deleteFile(String path) {
        try {
            if (path != null) Files.deleteIfExists(Path.of(path));
        } catch (IOException e) {
            log.warn("File delete failed: {}", path);
        }
    }
}
