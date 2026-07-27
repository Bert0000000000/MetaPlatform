package com.metaplatform.ea.governance.review.repository;

import com.metaplatform.ea.governance.review.entity.ReviewTicketEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ReviewTicketRepository extends JpaRepository<ReviewTicketEntity, UUID> {

    Optional<ReviewTicketEntity> findByIdAndDeletedAtIsNull(UUID id);

    List<ReviewTicketEntity> findByTenantIdAndDeletedAtIsNull(String tenantId);

    List<ReviewTicketEntity> findByTenantIdAndStatusAndDeletedAtIsNull(String tenantId, String status);
}
