package com.metaplatform.iam.repository;

import com.metaplatform.iam.entity.PermissionSnapshotEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;

/**
 * PermissionSnapshot Repository。
 *
 * <p>主键规则：tenant_id + user_id + subject_concept + subject_id 复合唯一。
 * 查询支持按快照 ID、过期时间、用户多维度过滤。</p>
 */
@Repository
public interface PermissionSnapshotRepository extends JpaRepository<PermissionSnapshotEntity, String> {

    Optional<PermissionSnapshotEntity> findByTenantIdAndUserIdAndSubjectConceptAndSubjectId(
            String tenantId, String userId, String subjectConcept, String subjectId);

    @Modifying
    @Query("update PermissionSnapshotEntity s set s.revoked = true where s.expiresAt < :now and s.revoked = false")
    int revokeExpired(@Param("now") Instant now);
}
