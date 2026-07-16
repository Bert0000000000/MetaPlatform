package com.metaplatform.ragmdm.unstructured;

import com.metaplatform.ragmdm.common.exception.ResourceNotFoundException;
import com.metaplatform.ragmdm.domain.KnowledgeBase;
import com.metaplatform.ragmdm.domain.enums.KnowledgeBaseStatus;
import com.metaplatform.ragmdm.domain.enums.KnowledgeBaseType;
import com.metaplatform.ragmdm.domain.repository.KnowledgeBaseRepository;
import com.metaplatform.ragmdm.api.dto.KnowledgeBaseCreateRequest;
import com.metaplatform.ragmdm.api.dto.KnowledgeBaseUpdateRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class KnowledgeBaseService {

    private final KnowledgeBaseRepository repository;

    @Transactional
    public KnowledgeBase create(KnowledgeBaseCreateRequest request) {
        KnowledgeBase kb = new KnowledgeBase();
        kb.setCode(request.getCode());
        kb.setName(request.getName());
        kb.setDescription(request.getDescription());
        kb.setType(request.getType() != null ? request.getType() : KnowledgeBaseType.RAG);
        kb.setChunkSize(request.getChunkSize() != null ? request.getChunkSize() : 512);
        kb.setChunkOverlap(request.getChunkOverlap() != null ? request.getChunkOverlap() : 50);
        kb.setEmbeddingModel(request.getEmbeddingModel() != null
            ? request.getEmbeddingModel() : "text-embedding-3-small");
        kb.setDocumentCount(0L);
        kb.setChunkCount(0L);
        kb.setStatus(KnowledgeBaseStatus.ACTIVE);
        kb.setCreatedBy("system");
        return repository.save(kb);
    }

    public Page<KnowledgeBase> list(KnowledgeBaseType type, Pageable pageable) {
        if (type != null) {
            return repository.findByType(type, pageable);
        }
        return repository.findAll(pageable);
    }

    public KnowledgeBase getById(Long id) {
        return repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("KnowledgeBase", id));
    }

    public KnowledgeBase getByCode(String code) {
        return repository.findByCode(code)
            .orElseThrow(() -> new ResourceNotFoundException("KnowledgeBase", code));
    }

    @Transactional
    public KnowledgeBase update(Long id, KnowledgeBaseUpdateRequest request) {
        KnowledgeBase kb = getById(id);
        if (request.getName() != null) kb.setName(request.getName());
        if (request.getDescription() != null) kb.setDescription(request.getDescription());
        if (request.getChunkSize() != null) kb.setChunkSize(request.getChunkSize());
        if (request.getChunkOverlap() != null) kb.setChunkOverlap(request.getChunkOverlap());
        kb.setUpdatedAt(LocalDateTime.now());
        return repository.save(kb);
    }

    @Transactional
    public void delete(Long id) {
        getById(id); // verify exists
        repository.deleteById(id);
    }
}
