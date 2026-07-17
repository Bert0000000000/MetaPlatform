package com.metaplatform.mcp.prompt.repository;

import com.metaplatform.mcp.prompt.entity.McpPromptTemplateEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface McpPromptTemplateRepository extends JpaRepository<McpPromptTemplateEntity, UUID> {

    Optional<McpPromptTemplateEntity> findByIdAndDeletedAtIsNull(UUID id);

    @Query("SELECT p FROM McpPromptTemplateEntity p " +
           "WHERE p.tenantId = :tenantId AND p.deletedAt IS NULL " +
           "AND (:status IS NULL OR p.status = :status) " +
           "AND (:category IS NULL OR p.category = :category) " +
           "AND (:keyword IS NULL OR LOWER(p.name) LIKE LOWER(CONCAT('%', :keyword, '%')))")
    List<McpPromptTemplateEntity> search(@Param("tenantId") String tenantId,
                                         @Param("status") String status,
                                         @Param("category") String category,
                                         @Param("keyword") String keyword);
}