package com.metaplatform.dashboard.repository;

import com.metaplatform.dashboard.entity.DashboardPageMessageEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface DashboardPageMessageRepository extends JpaRepository<DashboardPageMessageEntity, Long> {
    List<DashboardPageMessageEntity> findByUserIdOrderBySortOrderAsc(String userId);
}