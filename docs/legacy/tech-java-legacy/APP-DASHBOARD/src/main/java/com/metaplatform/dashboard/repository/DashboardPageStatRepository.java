package com.metaplatform.dashboard.repository;

import com.metaplatform.dashboard.entity.DashboardPageStatEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface DashboardPageStatRepository extends JpaRepository<DashboardPageStatEntity, Long> {
    List<DashboardPageStatEntity> findByUserIdOrderBySortOrderAsc(String userId);
}