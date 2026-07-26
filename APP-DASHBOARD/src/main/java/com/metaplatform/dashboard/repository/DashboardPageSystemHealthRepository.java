package com.metaplatform.dashboard.repository;

import com.metaplatform.dashboard.entity.DashboardPageSystemHealthEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface DashboardPageSystemHealthRepository extends JpaRepository<DashboardPageSystemHealthEntity, Long> {
    List<DashboardPageSystemHealthEntity> findByUserIdOrderBySortOrderAsc(String userId);
}