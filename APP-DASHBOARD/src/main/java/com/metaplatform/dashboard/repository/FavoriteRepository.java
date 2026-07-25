package com.metaplatform.dashboard.repository;

import com.metaplatform.dashboard.entity.FavoriteEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface FavoriteRepository extends JpaRepository<FavoriteEntity, Long> {
    List<FavoriteEntity> findByUserIdOrderByCreatedAtDesc(String userId);
}
