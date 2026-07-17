package com.metaplatform.ea.valuestream.repository;

import com.metaplatform.ea.valuestream.entity.ValueStreamStageEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ValueStreamStageRepository extends JpaRepository<ValueStreamStageEntity, UUID> {

    List<ValueStreamStageEntity> findByValueStreamIdAndDeletedAtIsNullOrderBySortOrderAsc(UUID valueStreamId);

    List<ValueStreamStageEntity> findByTenantIdAndDeletedAtIsNull(String tenantId);

    Optional<ValueStreamStageEntity> findByIdAndDeletedAtIsNull(UUID id);
}