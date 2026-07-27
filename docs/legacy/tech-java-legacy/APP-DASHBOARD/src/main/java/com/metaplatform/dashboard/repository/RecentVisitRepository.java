package com.metaplatform.dashboard.repository;

import com.metaplatform.dashboard.entity.RecentVisitEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface RecentVisitRepository extends JpaRepository<RecentVisitEntity, Long> {
    List<RecentVisitEntity> findByUserIdOrderByVisitedAtDesc(String userId, Pageable pageable);
}
