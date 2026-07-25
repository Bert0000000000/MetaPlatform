package com.metaplatform.dashboard.repository;

import com.metaplatform.dashboard.entity.DeliverableEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface DeliverableRepository extends JpaRepository<DeliverableEntity, Long> {

    Optional<DeliverableEntity> findByDeliverableId(String deliverableId);

    Optional<DeliverableEntity> findByShareToken(String shareToken);

    @Query("SELECT d FROM DeliverableEntity d WHERE d.userId = :userId AND d.status != 'DELETED' AND "
            + "(:type IS NULL OR d.type = :type) AND "
            + "(:tag IS NULL OR LOWER(COALESCE(d.tags, '')) LIKE LOWER(CONCAT('%', cast(:tag as string), '%')))) AND "
            + "(:keyword IS NULL OR LOWER(d.title) LIKE LOWER(CONCAT('%', cast(:keyword as string), '%'))) "
            + "  OR LOWER(COALESCE(d.description, '')) LIKE LOWER(CONCAT('%', cast(:keyword as string), '%'))) "
            + "  OR LOWER(COALESCE(d.tags, '')) LIKE LOWER(CONCAT('%', cast(:keyword as string), '%'))))")
    Page<DeliverableEntity> search(@Param("userId") String userId,
                                   @Param("type") String type,
                                   @Param("tag") String tag,
                                   @Param("keyword") String keyword,
                                   Pageable pageable);

    @Query("SELECT d.tags FROM DeliverableEntity d WHERE d.userId = :userId AND d.status = 'ACTIVE' AND d.tags IS NOT NULL AND d.tags <> ''")
    List<String> findAllTagStrings(@Param("userId") String userId);

    long countByUserIdAndStatus(String userId, String status);

    long countByUserIdAndShareTokenIsNotNull(String userId);
}
