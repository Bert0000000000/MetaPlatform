package com.metaplatform.copilot.repository;

import com.metaplatform.copilot.entity.SchedulingRecordEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface SchedulingRecordRepository extends JpaRepository<SchedulingRecordEntity, Long> {
    Optional<SchedulingRecordEntity> findByRecordId(String recordId);
    Page<SchedulingRecordEntity> findByUserIdAndStartedAtAfterOrderByStartedAtDesc(String userId, LocalDateTime after, Pageable pageable);
    Page<SchedulingRecordEntity> findByUserIdAndStatusAndStartedAtAfterOrderByStartedAtDesc(String userId, String status, LocalDateTime after, Pageable pageable);
    List<SchedulingRecordEntity> findByUserIdAndStartedAtAfter(String userId, LocalDateTime after);
}