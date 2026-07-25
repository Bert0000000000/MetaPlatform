package com.metaplatform.rag.repository;

import com.metaplatform.rag.entity.DocumentEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface DocumentRepository extends JpaRepository<DocumentEntity, UUID> {

    List<DocumentEntity> findAllByKbId(UUID kbId);

    List<DocumentEntity> findAllByKbIdAndStatus(UUID kbId, String status);

    long countByKbId(UUID kbId);
}
