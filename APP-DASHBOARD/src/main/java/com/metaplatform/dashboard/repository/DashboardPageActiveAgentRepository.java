package com.metaplatform.dashboard.repository;

import com.metaplatform.dashboard.entity.DashboardPageActiveAgentEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface DashboardPageActiveAgentRepository extends JpaRepository<DashboardPageActiveAgentEntity, Long> {
    List<DashboardPageActiveAgentEntity> findByUserIdOrderBySortOrderAsc(String userId);
}