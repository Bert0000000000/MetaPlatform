package com.metaplatform.msg.repository;

import com.metaplatform.msg.entity.DlqRetryPolicyEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DlqRetryPolicyRepository extends JpaRepository<DlqRetryPolicyEntity, String> {

    Optional<DlqRetryPolicyEntity> findByTenantIdAndTopic(String tenantId, String topic);

    List<DlqRetryPolicyEntity> findByTenantId(String tenantId);

    boolean existsByTenantIdAndTopic(String tenantId, String topic);
}
