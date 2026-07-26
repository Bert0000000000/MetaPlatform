package com.metaplatform.dashboard.repository;

import com.metaplatform.dashboard.entity.DashboardPageRecentTaskEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface DashboardPageRecentTaskRepository extends JpaRepository<DashboardPageRecentTaskEntity, Long> {
    List<DashboardPageRecentTaskEntity> findByUserIdOrderBySortOrderAsc(String userId);
    long countByUserId(String userId);
}