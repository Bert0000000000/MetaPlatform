package com.metaplatform.process.domain.repository;

import com.metaplatform.process.domain.ProcessDefinition;
import com.metaplatform.process.domain.enums.DefinitionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProcessDefinitionRepository extends JpaRepository<ProcessDefinition, Long>,
        JpaSpecificationExecutor<ProcessDefinition> {

    Optional<ProcessDefinition> findByCodeAndStatus(String code, DefinitionStatus status);

    Optional<ProcessDefinition> findByCode(String code);

    List<ProcessDefinition> findByTriggerTypeAndStatus(String triggerType, DefinitionStatus status);
}
