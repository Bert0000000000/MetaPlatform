package com.metaplatform.ea.techradar.repository;

import com.metaplatform.ea.techradar.entity.TechnologyRadarEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TechnologyRadarRepository extends JpaRepository<TechnologyRadarEntity, UUID> {

    Optional<TechnologyRadarEntity> findByIdAndDeletedAtIsNull(UUID id);

    List<TechnologyRadarEntity> findByTenantIdAndDeletedAtIsNull(String tenantId);

    boolean existsByTenantIdAndNameAndDeletedAtIsNull(String tenantId, String name);
}
