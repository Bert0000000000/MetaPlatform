package com.metaplatform.dashboard.repository;

import com.metaplatform.dashboard.entity.DashboardPagePortalEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface DashboardPagePortalRepository extends JpaRepository<DashboardPagePortalEntity, Long> {
    List<DashboardPagePortalEntity> findByUserIdAndKindOrderBySortOrderAsc(String userId, String kind);
}