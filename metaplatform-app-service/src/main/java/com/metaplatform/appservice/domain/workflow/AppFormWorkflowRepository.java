package com.metaplatform.appservice.domain.workflow;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AppFormWorkflowRepository extends JpaRepository<AppFormWorkflowEntity, Long> {

    Optional<AppFormWorkflowEntity> findByAppIdAndFormId(Long appId, Long formId);

    Optional<AppFormWorkflowEntity> findByAppIdAndFormIdAndEnabled(Long appId, Long formId, Boolean enabled);
}
