package com.metaplatform.kb.controller;

import com.metaplatform.kb.dto.*;
import com.metaplatform.kb.entity.ChunkReviewEntity;
import com.metaplatform.kb.service.ChunkReviewService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/knowledge-base")
@RequiredArgsConstructor
public class ChunkReviewController {
    private final ChunkReviewService service;
    @GetMapping("/{kbId}/chunk-reviews") public List<ChunkReviewEntity> list(@PathVariable String kbId,@RequestParam(required=false) String status){return service.getReviews(kbId,status);}
    @PostMapping("/chunk-reviews/{reviewId}/approve") public ChunkReviewEntity approve(@PathVariable String reviewId,@RequestBody ReviewActionRequest r){return service.approveChunk(reviewId,r.userId());}
    @PostMapping("/chunk-reviews/{reviewId}/reject") public ChunkReviewEntity reject(@PathVariable String reviewId,@RequestBody ReviewActionRequest r){return service.rejectChunk(reviewId,r.userId(),r.comment());}
    @PostMapping("/chunk-reviews/{reviewId}/publish") public ChunkReviewEntity publish(@PathVariable String reviewId,@RequestBody ReviewActionRequest r){return service.publishChunk(reviewId,r.userId());}
    @PostMapping("/chunk-reviews/batch-approve") public List<ChunkReviewEntity> batch(@RequestBody BatchApproveRequest r){return service.batchApprove(r.reviewIds(),r.userId());}
}
