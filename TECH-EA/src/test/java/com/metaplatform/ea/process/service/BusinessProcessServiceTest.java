package com.metaplatform.ea.process.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ea.common.TenantContext;
import com.metaplatform.ea.process.dto.BusinessProcessResponse;
import com.metaplatform.ea.process.dto.CreateBusinessProcessRequest;
import com.metaplatform.ea.process.dto.LinkProcessRoleRequest;
import com.metaplatform.ea.process.entity.BusinessProcessEntity;
import com.metaplatform.ea.process.entity.BusinessProcessRoleEntity;
import com.metaplatform.ea.process.repository.BusinessProcessRepository;
import com.metaplatform.ea.process.repository.BusinessProcessRoleRepository;
import com.metaplatform.ea.process.repository.BusinessProcessVersionRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BusinessProcessServiceTest {

    @Mock
    private BusinessProcessRepository repository;

    @Mock
    private BusinessProcessVersionRepository versionRepository;

    @Mock
    private BusinessProcessRoleRepository processRoleRepository;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private BusinessProcessService service;

    private UUID processId;

    @BeforeEach
    void setUp() {
        TenantContext.set("tenant-default");
        processId = UUID.randomUUID();
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void create_shouldPersistBpmnAndRoleFields() {
        CreateBusinessProcessRequest request = new CreateBusinessProcessRequest();
        request.setName("审批流程");
        request.setCode("APPROVAL_PROCESS");
        request.setProcessType("sub");
        request.setFrequency("weekly");
        request.setApplicationIds(List.of(UUID.randomUUID()));
        request.setResponsibleRoleIds(List.of(UUID.randomUUID()));
        request.setBpmnXml("<bpmn/>");

        when(repository.existsByTenantIdAndCodeAndDeletedAtIsNull("tenant-default", "APPROVAL_PROCESS"))
                .thenReturn(false);
        ArgumentCaptor<BusinessProcessEntity> captor = ArgumentCaptor.forClass(BusinessProcessEntity.class);
        when(repository.save(captor.capture())).thenAnswer(i -> i.getArgument(0));

        BusinessProcessResponse response = service.create(request);

        assertThat(response.getProcessType()).isEqualTo("SUB");
        assertThat(response.getFrequency()).isEqualTo("WEEKLY");
        assertThat(response.getBpmnXml()).isEqualTo("<bpmn/>");
        assertThat(captor.getValue().getApplicationIds()).contains("\"" + request.getApplicationIds().get(0) + "\"");
    }

    @Test
    void linkRoles_shouldCreateAssociationsAndUpdateProcess() {
        BusinessProcessEntity entity = BusinessProcessEntity.builder()
                .id(processId)
                .tenantId("tenant-default")
                .name("审批流程")
                .code("APPROVAL_PROCESS")
                .responsibleRoleIds("[]")
                .version(1)
                .status("DRAFT")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
        when(repository.findByIdAndDeletedAtIsNull(processId)).thenReturn(Optional.of(entity));
        UUID roleId = UUID.randomUUID();
        when(processRoleRepository.saveAll(any())).thenAnswer(i -> i.getArgument(0));
        when(repository.save(any(BusinessProcessEntity.class))).thenAnswer(i -> i.getArgument(0));

        LinkProcessRoleRequest request = new LinkProcessRoleRequest();
        request.setRoleIds(List.of(roleId));
        request.setRelationship("accountable");

        List<BusinessProcessRoleEntity> links = service.linkRoles(processId, request);

        assertThat(links).hasSize(1);
        assertThat(links.get(0).getRelationship()).isEqualTo("ACCOUNTABLE");
        assertThat(links.get(0).getRoleId()).isEqualTo(roleId);
    }
}
