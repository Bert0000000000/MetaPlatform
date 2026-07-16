package com.metaplatform.wfe.service;

import com.metaplatform.wfe.common.PageResponse;
import com.metaplatform.wfe.common.TenantContext;
import com.metaplatform.wfe.dto.DeployRequest;
import com.metaplatform.wfe.dto.ProcessDefinitionResponse;
import com.metaplatform.wfe.entity.ProcessDefinitionEntity;
import com.metaplatform.wfe.entity.ProcessDefinitionStatus;
import com.metaplatform.wfe.exception.WfeException;
import com.metaplatform.wfe.repository.ProcessDefinitionRepository;
import org.flowable.engine.RepositoryService;
import org.flowable.engine.repository.Deployment;
import org.flowable.engine.repository.DeploymentBuilder;
import org.flowable.engine.repository.ProcessDefinition;
import org.flowable.engine.repository.ProcessDefinitionQuery;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ProcessDefinitionServiceTest {

    @Mock
    private ProcessDefinitionRepository processDefinitionRepository;

    @Mock
    private RepositoryService repositoryService;

    @InjectMocks
    private ProcessDefinitionService processDefinitionService;

    @BeforeEach
    void setUp() {
        TenantContext.clear();
        TenantContext.set(TenantContext.DEFAULT_TENANT_ID);
    }

    private DeployRequest buildDeployRequest() {
        DeployRequest request = new DeployRequest();
        request.setProcessKey("purchase_approval");
        request.setName("采购审批流程");
        request.setBpmnXml("<?xml version=\"1.0\"?><bpmn:definitions xmlns:bpmn=\"http://www.omg.org/spec/BPMN/20100524/MODEL\"></bpmn:definitions>");
        return request;
    }

    private DeploymentBuilder mockDeploymentBuilder() {
        DeploymentBuilder builder = mock(DeploymentBuilder.class);
        Deployment deployment = mock(Deployment.class);
        when(deployment.getId()).thenReturn("dep-001");
        when(deployment.getName()).thenReturn("采购审批流程");
        when(builder.name(anyString())).thenReturn(builder);
        when(builder.addString(anyString(), anyString())).thenReturn(builder);
        when(builder.deploy()).thenReturn(deployment);
        return builder;
    }

    @Test
    void deploy_shouldReturnDefinition_whenSuccess() {
        DeployRequest request = buildDeployRequest();

        when(processDefinitionRepository
                .findFirstByTenantIdAndProcessKeyAndStatusNotOrderByVersionDesc(
                        TenantContext.DEFAULT_TENANT_ID, "purchase_approval", ProcessDefinitionStatus.DELETED))
                .thenReturn(Optional.empty());
        when(processDefinitionRepository.existsByTenantIdAndProcessKeyAndVersion(
                TenantContext.DEFAULT_TENANT_ID, "purchase_approval", 1))
                .thenReturn(false);

        DeploymentBuilder builder = mockDeploymentBuilder();
        when(repositoryService.createDeployment()).thenReturn(builder);

        ProcessDefinitionEntity saved = ProcessDefinitionEntity.builder()
                .id("pd-001")
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .processKey("purchase_approval")
                .name("采购审批流程")
                .version(1)
                .bpmnXml(request.getBpmnXml())
                .status(ProcessDefinitionStatus.DEPLOYED)
                .build();
        when(processDefinitionRepository.save(any(ProcessDefinitionEntity.class))).thenReturn(saved);

        ProcessDefinitionResponse response = processDefinitionService.deploy(request);

        assertThat(response.getId()).isEqualTo("pd-001");
        assertThat(response.getProcessKey()).isEqualTo("purchase_approval");
        assertThat(response.getName()).isEqualTo("采购审批流程");
        assertThat(response.getVersion()).isEqualTo(1);
        assertThat(response.getStatus()).isEqualTo("DEPLOYED");
        verify(repositoryService).createDeployment();
        verify(builder).deploy();
    }

    @Test
    void deploy_shouldThrow409_whenVersionConflict() {
        DeployRequest request = buildDeployRequest();

        ProcessDefinitionEntity existing = ProcessDefinitionEntity.builder()
                .id("pd-000")
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .processKey("purchase_approval")
                .name("旧版本")
                .version(1)
                .bpmnXml("<xml/>")
                .status(ProcessDefinitionStatus.DEPLOYED)
                .build();

        when(processDefinitionRepository
                .findFirstByTenantIdAndProcessKeyAndStatusNotOrderByVersionDesc(
                        TenantContext.DEFAULT_TENANT_ID, "purchase_approval", ProcessDefinitionStatus.DELETED))
                .thenReturn(Optional.of(existing));
        when(processDefinitionRepository.existsByTenantIdAndProcessKeyAndVersion(
                TenantContext.DEFAULT_TENANT_ID, "purchase_approval", 2))
                .thenReturn(true);

        assertThatThrownBy(() -> processDefinitionService.deploy(request))
                .isInstanceOf(WfeException.class)
                .hasMessageContaining("已存在");

        verify(repositoryService, never()).createDeployment();
    }

    @Test
    void list_shouldReturnPage_whenQueryingAll() {
        ProcessDefinitionEntity entity1 = ProcessDefinitionEntity.builder()
                .id("pd-001").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .processKey("process_a").name("流程A").version(1)
                .bpmnXml("<xml/>").status(ProcessDefinitionStatus.DEPLOYED).build();
        ProcessDefinitionEntity entity2 = ProcessDefinitionEntity.builder()
                .id("pd-002").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .processKey("process_b").name("流程B").version(1)
                .bpmnXml("<xml/>").status(ProcessDefinitionStatus.SUSPENDED).build();

        PageImpl<ProcessDefinitionEntity> page = new PageImpl<>(
                List.of(entity1, entity2),
                PageRequest.of(0, 20),
                2);

        when(processDefinitionRepository.findByTenantIdAndStatusNot(
                eq(TenantContext.DEFAULT_TENANT_ID),
                eq(ProcessDefinitionStatus.DELETED),
                any(PageRequest.class)))
                .thenReturn(page);

        PageResponse<ProcessDefinitionResponse> result =
                processDefinitionService.list(null, null, 1, 20);

        assertThat(result.getItems()).hasSize(2);
        assertThat(result.getTotal()).isEqualTo(2);
        assertThat(result.getPage()).isEqualTo(1);
        assertThat(result.getPageSize()).isEqualTo(20);
        assertThat(result.getTotalPages()).isEqualTo(1);
    }

    @Test
    void getById_shouldReturnDefinition_whenExists() {
        ProcessDefinitionEntity entity = ProcessDefinitionEntity.builder()
                .id("pd-001").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .processKey("purchase_approval").name("采购审批流程").version(1)
                .bpmnXml("<bpmn/>").status(ProcessDefinitionStatus.DEPLOYED).build();

        when(processDefinitionRepository.findByIdAndStatusNot(
                "pd-001", ProcessDefinitionStatus.DELETED))
                .thenReturn(Optional.of(entity));

        ProcessDefinitionResponse response = processDefinitionService.getById("pd-001");

        assertThat(response.getId()).isEqualTo("pd-001");
        assertThat(response.getProcessKey()).isEqualTo("purchase_approval");
        assertThat(response.getBpmnXml()).isEqualTo("<bpmn/>");
    }

    @Test
    void getById_shouldThrow404_whenNotFound() {
        when(processDefinitionRepository.findByIdAndStatusNot(
                "nonexistent", ProcessDefinitionStatus.DELETED))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> processDefinitionService.getById("nonexistent"))
                .isInstanceOf(WfeException.class)
                .hasMessageContaining("流程定义不存在");
    }

    @Test
    void suspend_shouldUpdateStatus_whenDeployed() {
        ProcessDefinitionEntity entity = ProcessDefinitionEntity.builder()
                .id("pd-001").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .processKey("purchase_approval").name("采购审批流程").version(1)
                .bpmnXml("<bpmn/>").status(ProcessDefinitionStatus.DEPLOYED).build();

        when(processDefinitionRepository.findByIdAndStatusNot(
                "pd-001", ProcessDefinitionStatus.DELETED))
                .thenReturn(Optional.of(entity));

        ProcessDefinitionQuery query = mock(ProcessDefinitionQuery.class);
        ProcessDefinition flowablePd = mock(ProcessDefinition.class);
        when(repositoryService.createProcessDefinitionQuery()).thenReturn(query);
        when(query.processDefinitionKey(anyString())).thenReturn(query);
        when(query.latestVersion()).thenReturn(query);
        when(query.singleResult()).thenReturn(flowablePd);
        when(flowablePd.getId()).thenReturn("flowable-pd-001");

        when(processDefinitionRepository.save(any(ProcessDefinitionEntity.class))).thenReturn(entity);

        ProcessDefinitionResponse response = processDefinitionService.suspend("pd-001");

        assertThat(response.getStatus()).isEqualTo("SUSPENDED");
        verify(repositoryService).suspendProcessDefinitionById("flowable-pd-001");
    }

    @Test
    void activate_shouldUpdateStatus_whenSuspended() {
        ProcessDefinitionEntity entity = ProcessDefinitionEntity.builder()
                .id("pd-001").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .processKey("purchase_approval").name("采购审批流程").version(1)
                .bpmnXml("<bpmn/>").status(ProcessDefinitionStatus.SUSPENDED).build();

        when(processDefinitionRepository.findByIdAndStatusNot(
                "pd-001", ProcessDefinitionStatus.DELETED))
                .thenReturn(Optional.of(entity));

        ProcessDefinitionQuery query = mock(ProcessDefinitionQuery.class);
        ProcessDefinition flowablePd = mock(ProcessDefinition.class);
        when(repositoryService.createProcessDefinitionQuery()).thenReturn(query);
        when(query.processDefinitionKey(anyString())).thenReturn(query);
        when(query.latestVersion()).thenReturn(query);
        when(query.singleResult()).thenReturn(flowablePd);
        when(flowablePd.getId()).thenReturn("flowable-pd-001");

        when(processDefinitionRepository.save(any(ProcessDefinitionEntity.class))).thenReturn(entity);

        ProcessDefinitionResponse response = processDefinitionService.activate("pd-001");

        assertThat(response.getStatus()).isEqualTo("DEPLOYED");
        verify(repositoryService).activateProcessDefinitionById("flowable-pd-001");
    }

    @Test
    void delete_shouldSoftDelete_whenValid() {
        ProcessDefinitionEntity entity = ProcessDefinitionEntity.builder()
                .id("pd-001").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .processKey("purchase_approval").name("采购审批流程").version(1)
                .bpmnXml("<bpmn/>").status(ProcessDefinitionStatus.DEPLOYED).build();

        when(processDefinitionRepository.findByIdAndStatusNot(
                "pd-001", ProcessDefinitionStatus.DELETED))
                .thenReturn(Optional.of(entity));

        ProcessDefinitionQuery query = mock(ProcessDefinitionQuery.class);
        ProcessDefinition flowablePd = mock(ProcessDefinition.class);
        when(repositoryService.createProcessDefinitionQuery()).thenReturn(query);
        when(query.processDefinitionKey(anyString())).thenReturn(query);
        when(query.latestVersion()).thenReturn(query);
        when(query.singleResult()).thenReturn(flowablePd);
        when(flowablePd.getDeploymentId()).thenReturn("dep-001");

        when(processDefinitionRepository.save(any(ProcessDefinitionEntity.class))).thenReturn(entity);

        processDefinitionService.delete("pd-001");

        assertThat(entity.getStatus()).isEqualTo(ProcessDefinitionStatus.DELETED);
        verify(repositoryService).deleteDeployment("dep-001");
        verify(processDefinitionRepository).save(entity);
    }

    @Test
    void delete_shouldThrow409_whenAlreadyDeleted() {
        ProcessDefinitionEntity entity = ProcessDefinitionEntity.builder()
                .id("pd-001").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .processKey("purchase_approval").name("采购审批流程").version(1)
                .bpmnXml("<bpmn/>").status(ProcessDefinitionStatus.DELETED).build();

        when(processDefinitionRepository.findByIdAndStatusNot(
                "pd-001", ProcessDefinitionStatus.DELETED))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> processDefinitionService.delete("pd-001"))
                .isInstanceOf(WfeException.class)
                .hasMessageContaining("流程定义不存在");
    }
}
