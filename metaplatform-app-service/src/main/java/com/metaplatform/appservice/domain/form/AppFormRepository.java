package com.metaplatform.appservice.domain.form;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AppFormRepository extends JpaRepository<AppFormEntity, Long> {
    List<AppFormEntity> findByAppId(Long appId);
    Optional<AppFormEntity> findByIdAndAppId(Long id, Long appId);
    Optional<AppFormEntity> findByObjectIdAndCode(Long objectId, String code);
}
