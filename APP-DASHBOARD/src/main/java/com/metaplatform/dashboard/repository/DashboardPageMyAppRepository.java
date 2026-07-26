package com.metaplatform.dashboard.repository;

import com.metaplatform.dashboard.entity.DashboardPageMyAppEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface DashboardPageMyAppRepository extends JpaRepository<DashboardPageMyAppEntity, Long> {
    List<DashboardPageMyAppEntity> findByUserIdOrderByPinnedDescSortOrderAsc(String userId);
    List<DashboardPageMyAppEntity> findByUserIdAndPinnedOrderBySortOrderAsc(String userId, Boolean pinned);
}