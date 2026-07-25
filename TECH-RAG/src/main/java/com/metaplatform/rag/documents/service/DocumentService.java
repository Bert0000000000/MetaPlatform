package com.metaplatform.rag.documents.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.rag.documents.dto.DocumentDto;
import com.metaplatform.rag.documents.dto.UploadResult;
import com.metaplatform.rag.entity.ChunkEntity;
import com.metaplatform.rag.entity.DocumentEntity;
import com.metaplatform.rag.repository.ChunkRepository;
import com.metaplatform.rag.repository.DocumentRepository;
import com.metaplatform.rag.repository.KnowledgeBaseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.document.Document;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.reader.tika.TikaDocumentReader;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DocumentService {

    private final DocumentRepository documentRepository;
    private final ChunkRepository chunkRepository;
    private final KnowledgeBaseRepository knowledgeBaseRepository;
    private final VectorStore vectorStore;
    private final EmbeddingModel embeddingModel;
    private final ObjectMapper objectMapper;
    private final ObjectProvider<DocumentService> selfProvider;

    @Value("${rag.chunk.default-size:512}")
    private int chunkSize;

    @Value("${rag.chunk.default-overlap:50}")
    private int chunkOverlap;

    @Transactional
    public UploadResult uploadDocument(UUID kbId, MultipartFile file, String uploadedBy) {
        knowledgeBaseRepository.findById(kbId)
            .orElseThrow(() -> new IllegalArgumentException("Knowledge base not found: " + kbId));

        DocumentEntity doc = new DocumentEntity();
        doc.setKbId(kbId);
        doc.setTitle(file.getOriginalFilename());
        doc.setFileName(file.getOriginalFilename());
        doc.setFileSize(file.getSize());
        doc.setFileType(file.getContentType());
        doc.setStatus("pending");
        doc.setChunkCount(0);
        doc.setMetadata("{}");
        DocumentEntity saved = documentRepository.save(doc);

        Path targetPath = Path.of(".uploads", saved.getId().toString(), file.getOriginalFilename());
        try {
            Files.createDirectories(targetPath.getParent());
            file.transferTo(targetPath);
            saved.setFilePath(targetPath.toString());
            saved.setStatus("processing");
            documentRepository.save(saved);
        } catch (IOException e) {
            saved.setStatus("failed");
            saved.setErrorMessage(e.getMessage());
            documentRepository.save(saved);
            throw new RuntimeException("Failed to save file", e);
        }

        selfProvider.getObject().parseDocumentAsync(saved);
        return new UploadResult(saved.getId(), saved.getFileName(), saved.getStatus());
    }

    @Transactional(readOnly = true)
    public List<DocumentDto> listDocuments(UUID kbId) {
        return documentRepository.findAllByKbId(kbId).stream()
            .map(this::toDto)
            .toList();
    }

    @Transactional(readOnly = true)
    public DocumentDto getDocument(UUID docId) {
        DocumentEntity doc = documentRepository.findById(docId)
            .orElseThrow(() -> new IllegalArgumentException("Document not found: " + docId));
        return toDto(doc);
    }

    @Transactional
    public void deleteDocument(UUID docId) {
        DocumentEntity doc = documentRepository.findById(docId)
            .orElseThrow(() -> new IllegalArgumentException("Document not found: " + docId));
        chunkRepository.deleteAll(chunkRepository.findAllByDocId(docId));
        documentRepository.delete(doc);
    }

    @Transactional
    public DocumentDto reparseDocument(UUID docId) {
        DocumentEntity doc = documentRepository.findById(docId)
            .orElseThrow(() -> new IllegalArgumentException("Document not found: " + docId));
        chunkRepository.deleteAll(chunkRepository.findAllByDocId(docId));
        doc.setStatus("processing");
        doc.setChunkCount(0);
        doc.setErrorMessage(null);
        DocumentEntity saved = documentRepository.save(doc);
        selfProvider.getObject().parseDocumentAsync(saved);
        return toDto(saved);
    }

    @Async
    public void parseDocumentAsync(DocumentEntity doc) {
        try {
            Path path = Path.of(doc.getFilePath());
            if (!Files.exists(path)) {
                throw new IllegalArgumentException("File not found: " + doc.getFilePath());
            }

            TikaDocumentReader reader = new TikaDocumentReader(path.toUri().toString());
            List<Document> documents = reader.get();
            String fullText = documents.stream()
                .map(Document::getText)
                .reduce("", (a, b) -> a + "\n" + b);

            List<String> chunkTexts = splitText(fullText, chunkSize, chunkOverlap);
            List<Document> vectorDocs = new ArrayList<>();

            int sequence = 0;
            for (String chunkText : chunkTexts) {
                ChunkEntity chunk = new ChunkEntity();
                chunk.setDocId(doc.getId());
                chunk.setKbId(doc.getKbId());
                chunk.setContent(chunkText);
                chunk.setSequence(sequence++);
                chunk.setMetadata("{\"seq\":" + chunk.getSequence() + "}");
                ChunkEntity savedChunk = chunkRepository.save(chunk);

                Document vectorDoc = new Document(
                    chunkText,
                    Map.of(
                        "chunkId", savedChunk.getId().toString(),
                        "docId", doc.getId().toString(),
                        "kbId", doc.getKbId().toString()
                    )
                );
                vectorDocs.add(vectorDoc);
                savedChunk.setVectorId(vectorDoc.getId());
                chunkRepository.save(savedChunk);
            }

            if (!vectorDocs.isEmpty()) {
                vectorStore.add(vectorDocs);
            }

            doc.setChunkCount(chunkTexts.size());
            doc.setStatus("completed");
            doc.setErrorMessage(null);
            documentRepository.save(doc);
        } catch (Exception e) {
            doc.setStatus("failed");
            doc.setErrorMessage(e.getMessage());
            documentRepository.save(doc);
        }
    }

    private List<String> splitText(String text, int size, int overlap) {
        List<String> chunks = new ArrayList<>();
        if (text == null || text.isBlank()) {
            return chunks;
        }
        int step = size - overlap;
        for (int i = 0; i < text.length(); i += step) {
            int end = Math.min(i + size, text.length());
            chunks.add(text.substring(i, end));
            if (end == text.length()) {
                break;
            }
        }
        return chunks;
    }

    private DocumentDto toDto(DocumentEntity doc) {
        Object metadata = null;
        try {
            metadata = objectMapper.readValue(doc.getMetadata(), Object.class);
        } catch (JsonProcessingException ignored) {
        }
        return new DocumentDto(
            doc.getId(),
            doc.getKbId(),
            doc.getTitle(),
            doc.getFileName(),
            doc.getFileSize(),
            doc.getFileType(),
            doc.getFilePath(),
            doc.getStatus(),
            doc.getChunkCount(),
            doc.getErrorMessage(),
            metadata,
            doc.getCreatedAt(),
            doc.getUpdatedAt()
        );
    }
}
