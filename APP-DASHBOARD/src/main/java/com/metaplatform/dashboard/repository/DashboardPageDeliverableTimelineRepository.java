package com.metaplatform.dashboard.repository;

import com.metaplatform.dashboard.entity.DashboardPageDeliverableTimelineEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface DashboardPageDeliverableTimelineRepository extends JpaRepository<DashboardPageDeliverableTimelineEntity, Long> {
    List<DashboardPageDeliverableTimelineEntity> findByUserIdOrderBySortOrderAsc(String userId);
}