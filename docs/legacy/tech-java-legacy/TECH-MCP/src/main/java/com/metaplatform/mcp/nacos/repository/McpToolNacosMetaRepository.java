package com.metaplatform.mcp.nacos.repository;

import com.metaplatform.mcp.nacos.entity.McpToolNacosMetaEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface McpToolNacosMetaRepository extends JpaRepository<McpToolNacosMetaEntity, String> {

    Optional<McpToolNacosMetaEntity> findByToolIdAndToolVersion(String toolId, String toolVersion);
}