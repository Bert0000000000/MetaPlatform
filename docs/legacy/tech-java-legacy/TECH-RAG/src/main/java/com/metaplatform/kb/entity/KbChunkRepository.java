package com.metaplatform.kb.entity;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface KbChunkRepository extends JpaRepository<KbChunkEntity, String> {
    List<KbChunkEntity> findByDocumentId(String documentId);
}
