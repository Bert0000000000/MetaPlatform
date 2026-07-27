package com.metaplatform.kb.repository;

import com.metaplatform.kb.entity.ChunkReviewEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface ChunkReviewRepository extends JpaRepository<ChunkReviewEntity, Long> {
    List<ChunkReviewEntity> findByKbIdOrderByCreatedAtDesc(String kbId);
    List<ChunkReviewEntity> findByKbIdAndStatusOrderByCreatedAtDesc(String kbId, String status);
    Optional<ChunkReviewEntity> findByReviewId(String reviewId);
}
