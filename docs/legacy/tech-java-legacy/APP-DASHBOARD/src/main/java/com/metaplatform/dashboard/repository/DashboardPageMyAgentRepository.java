package com.metaplatform.dashboard.repository;

import com.metaplatform.dashboard.entity.DashboardPageMyAgentEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface DashboardPageMyAgentRepository extends JpaRepository<DashboardPageMyAgentEntity, Long> {
    List<DashboardPageMyAgentEntity> findByUserIdOrderBySortOrderAsc(String userId);
}