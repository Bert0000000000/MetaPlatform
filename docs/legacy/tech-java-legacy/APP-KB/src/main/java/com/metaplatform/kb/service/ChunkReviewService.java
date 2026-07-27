package com.metaplatform.kb.service;

import com.metaplatform.kb.entity.ChunkReviewEntity;
import com.metaplatform.kb.repository.ChunkReviewRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ChunkReviewService {
    private final ChunkReviewRepository repository;
    public List<ChunkReviewEntity> getReviews(String kbId, String status) { return status == null ? repository.findByKbIdOrderByCreatedAtDesc(kbId) : repository.findByKbIdAndStatusOrderByCreatedAtDesc(kbId, status); }
    public List<ChunkReviewEntity> getPendingReviews(String kbId) { return getReviews(kbId, "PENDING"); }
    @Transactional public ChunkReviewEntity approveChunk(String reviewId, String userId) { return transition(reviewId, userId, "APPROVED", null, "PENDING"); }
    @Transactional public ChunkReviewEntity rejectChunk(String reviewId, String userId, String comment) { return transition(reviewId, userId, "REJECTED", comment, "PENDING"); }
    @Transactional public ChunkReviewEntity publishChunk(String reviewId, String userId) { return transition(reviewId, userId, "PUBLISHED", null, "APPROVED"); }
    @Transactional public List<ChunkReviewEntity> batchApprove(List<String> ids, String userId) { return ids.stream().map(id -> approveChunk(id, userId)).toList(); }
    private ChunkReviewEntity transition(String id, String user, String next, String comment, String required) {
        ChunkReviewEntity entity = repository.findByReviewId(id).orElseThrow(() -> new IllegalArgumentException("Review not found: " + id));
        if (!required.equals(entity.getStatus())) throw new IllegalStateException("Review must be " + required + " before " + next);
        entity.setStatus(next); entity.setReviewedBy(user); entity.setReviewedAt(LocalDateTime.now()); entity.setComment(comment);
        return repository.save(entity);
    }
}
