package com.metaplatform.dashboard.repository;

import com.metaplatform.dashboard.entity.DashboardPageAgentExecLogEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface DashboardPageAgentExecLogRepository extends JpaRepository<DashboardPageAgentExecLogEntity, Long> {
    List<DashboardPageAgentExecLogEntity> findByUserIdOrderBySortOrderAsc(String userId);
}