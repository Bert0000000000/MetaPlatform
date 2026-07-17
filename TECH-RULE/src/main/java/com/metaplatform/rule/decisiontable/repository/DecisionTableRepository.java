package com.metaplatform.rule.decisiontable.repository;

import com.metaplatform.rule.decisiontable.entity.DecisionTableEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface DecisionTableRepository extends JpaRepository<DecisionTableEntity, String> {

    Optional<DecisionTableEntity> findByIdAndDeletedAtIsNull(String id);

    boolean existsByTenantIdAndCodeAndDeletedAtIsNull(String tenantId, String code);

    Page<DecisionTableEntity> findByTenantIdAndDeletedAtIsNull(String tenantId, Pageable pageable);
}
