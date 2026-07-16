package com.metaplatform.appservice.domain.workflow;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AppWorkflowDefinitionRepository extends JpaRepository<AppWorkflowDefinitionEntity, Long> {

    List<AppWorkflowDefinitionEntity> findByAppId(Long appId);

    Optional<AppWorkflowDefinitionEntity> findByIdAndAppId(Long id, Long appId);

    List<AppWorkflowDefinitionEntity> findByAppIdAndStatus(Long appId, String status);

    Optional<AppWorkflowDefinitionEntity> findByAppIdAndFormIdAndStatus(Long appId, Long formId, String status);

    Optional<AppWorkflowDefinitionEntity> findByProcessDefinitionId(String processDefinitionId);

    boolean existsByAppIdAndCode(Long appId, String code);
}
