package com.metaplatform.wfe.apphub.repository;

import com.metaplatform.wfe.apphub.entity.AppReleaseLogEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AppReleaseLogRepository extends JpaRepository<AppReleaseLogEntity, String> {

    List<AppReleaseLogEntity> findByReleaseIdOrderByCreatedAtDesc(String releaseId);
}
