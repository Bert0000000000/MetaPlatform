package com.metaplatform.ragmdm.domain.repository;

import com.metaplatform.ragmdm.domain.DocumentChunk;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DocumentChunkRepository extends JpaRepository<DocumentChunk, Long> {

    List<DocumentChunk> findByDocumentId(Long documentId);

    List<DocumentChunk> findByDocumentIdAndChunkIndexIn(Long documentId, List<Integer> chunkIndices);
}
