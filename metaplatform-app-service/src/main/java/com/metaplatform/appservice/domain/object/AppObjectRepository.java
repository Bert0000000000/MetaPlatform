package com.metaplatform.appservice.domain.object;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AppObjectRepository extends JpaRepository<AppObjectEntity, Long> {
    List<AppObjectEntity> findByAppIdOrderById(Long appId);
    Optional<AppObjectEntity> findByIdAndAppId(Long id, Long appId);
    Optional<AppObjectEntity> findByAppIdAndCode(Long appId, String code);
}
