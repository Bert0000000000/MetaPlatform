package com.metaplatform.mcp.nacos.repository;

import com.metaplatform.mcp.nacos.entity.McpClientNacosSyncEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface McpClientNacosSyncRepository extends JpaRepository<McpClientNacosSyncEntity, String> {

    Optional<McpClientNacosSyncEntity> findByClientId(String clientId);
}