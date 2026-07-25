package com.metaplatform.llmgw.repository;

import com.metaplatform.llmgw.entity.ModelEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ModelEntityRepository extends JpaRepository<ModelEntity, Long> {

    Optional<ModelEntity> findByModelId(String modelId);

    List<ModelEntity> findByProvider(String provider);

    List<ModelEntity> findByIsActive(Boolean isActive);

    Optional<ModelEntity> findByProviderAndModelId(String provider, String modelId);

    List<ModelEntity> findByIsActiveTrue();
}
