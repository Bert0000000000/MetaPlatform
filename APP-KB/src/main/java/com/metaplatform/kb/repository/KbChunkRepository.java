package com.metaplatform.kb.repository;

import com.metaplatform.kb.entity.KbChunkEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface KbChunkRepository extends JpaRepository<KbChunkEntity, String> {
    List<KbChunkEntity> findByDocumentIdAndDeletedFalseOrderByChunkIndex(String documentId);
    List<KbChunkEntity> findByKbIdAndReviewStatusAndDeletedFalse(String kbId, String status);
    List<KbChunkEntity> findByContentHashAndKbIdAndDeletedFalse(String contentHash, String kbId);
    Optional<KbChunkEntity> findByEmbeddingId(String embeddingId);
}
