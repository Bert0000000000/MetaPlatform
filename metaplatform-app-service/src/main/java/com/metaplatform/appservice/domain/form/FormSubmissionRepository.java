package com.metaplatform.appservice.domain.form;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FormSubmissionRepository extends JpaRepository<FormSubmissionEntity, Long> {

    List<FormSubmissionEntity> findByFormId(Long formId);

    List<FormSubmissionEntity> findByAppId(Long appId);

    Optional<FormSubmissionEntity> findByIdAndAppId(Long id, Long appId);

    Optional<FormSubmissionEntity> findByProcessInstanceId(String processInstanceId);

    List<FormSubmissionEntity> findBySubmitterId(String submitterId);
}
