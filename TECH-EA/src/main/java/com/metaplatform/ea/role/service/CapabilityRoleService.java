package com.metaplatform.ea.role.service;

import com.metaplatform.ea.capability.entity.BusinessCapabilityEntity;
import com.metaplatform.ea.capability.service.BusinessCapabilityService;
import com.metaplatform.ea.common.ErrorCode;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.exception.EaException;
import com.metaplatform.ea.role.dto.AssignRoleRequest;
import com.metaplatform.ea.role.dto.CapabilityRoleResponse;
import com.metaplatform.ea.role.entity.BusinessRoleEntity;
import com.metaplatform.ea.role.entity.CapabilityRoleEntity;
import com.metaplatform.ea.role.repository.CapabilityRoleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CapabilityRoleService {

    private static final String REL_OWNER = "OWNER";
    private static final String REL_PARTICIPANT = "PARTICIPANT";
    private static final String REL_SUPPORT = "SUPPORT";

    private final CapabilityRoleRepository capabilityRoleRepository;
    private final BusinessRoleService businessRoleService;
    private final BusinessCapabilityService capabilityService;

    @Transactional
    public CapabilityRoleResponse assignRole(UUID capabilityId, AssignRoleRequest request) {
        String tenantId = TenantContext.getOrDefault();

        capabilityService.findById(capabilityId);
        BusinessRoleEntity role = businessRoleService.findById(request.getRoleId());
        validateRelationship(request.getRelationship());

        if (capabilityRoleRepository.existsByTenantIdAndCapabilityIdAndRoleId(tenantId, capabilityId, request.getRoleId())) {
            throw new EaException(ErrorCode.ALREADY_EXISTS, "该角色已分配到此能力");
        }

        CapabilityRoleEntity entity = CapabilityRoleEntity.builder()
                .tenantId(tenantId)
                .capabilityId(capabilityId)
                .roleId(request.getRoleId())
                .relationship(request.getRelationship())
                .createdAt(Instant.now())
                .build();
        CapabilityRoleEntity saved = capabilityRoleRepository.save(entity);
        return toResponse(saved, role);
    }

    @Transactional(readOnly = true)
    public List<CapabilityRoleResponse> getRolesForCapability(UUID capabilityId) {
        String tenantId = TenantContext.getOrDefault();
        capabilityService.findById(capabilityId);
        List<CapabilityRoleEntity> assignments = capabilityRoleRepository.findByTenantIdAndCapabilityId(tenantId, capabilityId);
        return assignments.stream()
                .map(a -> {
                    BusinessRoleEntity role = businessRoleService.findById(a.getRoleId());
                    return toResponse(a, role);
                })
                .toList();
    }

    @Transactional
    public void unassignRole(UUID capabilityId, UUID roleId) {
        String tenantId = TenantContext.getOrDefault();
        capabilityService.findById(capabilityId);
        if (!capabilityRoleRepository.existsByTenantIdAndCapabilityIdAndRoleId(tenantId, capabilityId, roleId)) {
            throw new EaException(ErrorCode.NOT_FOUND, "角色未分配到此能力");
        }
        capabilityRoleRepository.deleteByTenantIdAndCapabilityIdAndRoleId(tenantId, capabilityId, roleId);
    }

    @Transactional(readOnly = true)
    public List<CapabilityRoleResponse> getCapabilitiesForRole(UUID roleId) {
        String tenantId = TenantContext.getOrDefault();
        businessRoleService.findById(roleId);
        List<CapabilityRoleEntity> assignments = capabilityRoleRepository.findByTenantIdAndRoleId(tenantId, roleId);
        return assignments.stream()
                .map(a -> {
                    BusinessRoleEntity role = businessRoleService.findById(a.getRoleId());
                    return toResponse(a, role);
                })
                .toList();
    }

    private void validateRelationship(String relationship) {
        if (!REL_OWNER.equals(relationship) && !REL_PARTICIPANT.equals(relationship) && !REL_SUPPORT.equals(relationship)) {
            throw new EaException(ErrorCode.INVALID_PARAM, "relationship 必须为 OWNER、PARTICIPANT 或 SUPPORT");
        }
    }

    private CapabilityRoleResponse toResponse(CapabilityRoleEntity entity, BusinessRoleEntity role) {
        return CapabilityRoleResponse.builder()
                .id(entity.getId())
                .capabilityId(entity.getCapabilityId())
                .roleId(entity.getRoleId())
                .roleName(role.getName())
                .roleCode(role.getCode())
                .relationship(entity.getRelationship())
                .createdAt(entity.getCreatedAt())
                .build();
    }
}
