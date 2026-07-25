package com.metaplatform.rag.repository;

import com.metaplatform.rag.entity.ChunkEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ChunkRepository extends JpaRepository<ChunkEntity, UUID> {

    List<ChunkEntity> findAllByDocId(UUID docId);

    List<ChunkEntity> findAllByKbId(UUID kbId);

    List<ChunkEntity> findAllByDocIdOrderBySequenceAsc(UUID docId);

    long countByDocId(UUID docId);

    long countByKbId(UUID kbId);
}
