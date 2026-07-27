package com.metaplatform.dashboard.repository;

import com.metaplatform.dashboard.entity.ShortcutEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ShortcutRepository extends JpaRepository<ShortcutEntity, Long> {
    List<ShortcutEntity> findByUserIdOrderBySortOrderAsc(String userId);
    void deleteByUserId(String userId);
}
