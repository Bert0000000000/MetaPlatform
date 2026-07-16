package com.metaplatform.wfe.service;

import com.metaplatform.wfe.common.PageResponse;
import com.metaplatform.wfe.common.TenantContext;
import com.metaplatform.wfe.dto.ProcessInstanceResponse;
import com.metaplatform.wfe.dto.StartProcessInstanceRequest;
import com.metaplatform.wfe.entity.ProcessDefinitionEntity;
import com.metaplatform.wfe.entity.ProcessDefinitionStatus;
import com.metaplatform.wfe.entity.ProcessInstanceEntity;
import com.metaplatform.wfe.entity.ProcessInstanceStatus;
import com.metaplatform.wfe.exception.WfeException;
import com.metaplatform.wfe.repository.ProcessDefinitionRepository;
import com.metaplatform.wfe.repository.ProcessInstanceRepository;
import org.flowable.engine.RepositoryService;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.repository.ProcessDefinition;
import org.flowable.engine.repository.ProcessDefinitionQuery;
import org.flowable.engine.runtime.ProcessInstance;
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
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ProcessInstanceServiceTest {

    @Mock
    private ProcessInstanceRepository processInstanceRepository;

    @Mock
    private ProcessDefinitionRepository processDefinitionRepository;

    @Mock
    private RuntimeService runtimeService;

    @Mock
    private RepositoryService repositoryService;

    @InjectMocks
    private ProcessInstanceService processInstanceService;

    @BeforeEach
    void setUp() {
        TenantContext.clear();
        TenantContext.set(TenantContext.DEFAULT_TENANT_ID);
    }

    private StartProcessInstanceRequest buildStartRequest() {
        StartProcessInstanceRequest request = new StartProcessInstanceRequest();
        request.setProcessDefinitionId("pd-001");
        request.setBusinessKey("biz-001");
        request.setVariables(Map.of("amount", 1000));
        return request;
    }

    private ProcessDefinitionEntity buildPdEntity() {
        return ProcessDefinitionEntity.builder()
                .id("pd-001")
                .tenantId(TenantContext.DEFAULT_TENANT_ID)
                .processKey("purchase_approval")
                .name("采购审批流程")
                .version(1)
                .bpmnXml("<bpmn/>")
                .status(ProcessDefinitionStatus.DEPLOYED)
                .build();
    }

    private void mockFlowablePdQuery(String flowablePdId) {
        ProcessDefinitionQuery pdQuery = mock(ProcessDefinitionQuery.class);
        ProcessDefinition flowablePd = mock(ProcessDefinition.class);
        when(repositoryService.createProcessDefinitionQuery()).thenReturn(pdQuery);
        when(pdQuery.processDefinitionKey(anyString())).thenReturn(pdQuery);
        when(pdQuery.latestVersion()).thenReturn(pdQuery);
        when(pdQuery.singleResult()).thenReturn(flowablePd);
        when(flowablePd.getId()).thenReturn(flowablePdId);
    }

    @Test
    void start_shouldReturnInstance_whenSuccess() {
        StartProcessInstanceRequest request = buildStartRequest();

        when(processDefinitionRepository.findByIdAndStatusNot(
                "pd-001", ProcessDefinitionStatus.DELETED))
                .thenReturn(Optional.of(buildPdEntity()));

        mockFlowablePdQuery("flowable-pd-001");

        ProcessInstance flowableInstance = mock(ProcessInstance.class);
        when(flowableInstance.getId()).thenReturn("pi-001");
        when(runtimeService.startProcessInstanceById(
                eq("flowable-pd-001"), eq("biz-001"), any(Map.class)))
                .thenReturn(flowableInstance);

        when(processInstanceRepository.save(any(ProcessInstanceEntity.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        ProcessInstanceResponse response = processInstanceService.start(request);

        assertThat(response.getId()).isEqualTo("pi-001");
        assertThat(response.getProcessKey()).isEqualTo("purchase_approval");
        assertThat(response.getBusinessKey()).isEqualTo("biz-001");
        assertThat(response.getStatus()).isEqualTo("RUNNING");
        assertThat(response.getProcessDefinitionId()).isEqualTo("pd-001");
        assertThat(response.getVariables()).containsEntry("amount", 1000);
        verify(runtimeService).startProcessInstanceById(
                eq("flowable-pd-001"), eq("biz-001"), any(Map.class));
    }

    @Test
    void start_shouldThrow404_whenProcessDefinitionNotFound() {
        StartProcessInstanceRequest request = new StartProcessInstanceRequest();
        request.setProcessDefinitionId("nonexistent");

        when(processDefinitionRepository.findByIdAndStatusNot(
                "nonexistent", ProcessDefinitionStatus.DELETED))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> processInstanceService.start(request))
                .isInstanceOf(WfeException.class)
                .hasMessageContaining("流程定义不存在");

        verify(runtimeService, never()).startProcessInstanceById(
                anyString(), any(), any());
    }

    @Test
    void start_shouldThrow403_whenTenantMismatch() {
        StartProcessInstanceRequest request = buildStartRequest();

        ProcessDefinitionEntity pdEntity = ProcessDefinitionEntity.builder()
                .id("pd-001")
                .tenantId("other-tenant")
                .processKey("purchase_approval")
                .name("采购审批流程")
                .version(1)
                .bpmnXml("<bpmn/>")
                .status(ProcessDefinitionStatus.DEPLOYED)
                .build();

        when(processDefinitionRepository.findByIdAndStatusNot(
                "pd-001", ProcessDefinitionStatus.DELETED))
                .thenReturn(Optional.of(pdEntity));

        assertThatThrownBy(() -> processInstanceService.start(request))
                .isInstanceOf(WfeException.class)
                .hasMessageContaining("租户不匹配");
    }

    @Test
    void list_shouldReturnPage_whenQueryingWithStatus() {
        ProcessInstanceEntity entity1 = ProcessInstanceEntity.builder()
                .id("pi-001").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .processDefinitionId("pd-001").processKey("purchase_approval")
                .businessKey("biz-001").status(ProcessInstanceStatus.RUNNING)
                .startUserId("user-001").build();
        ProcessInstanceEntity entity2 = ProcessInstanceEntity.builder()
                .id("pi-002").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .processDefinitionId("pd-001").processKey("purchase_approval")
                .businessKey("biz-002").status(ProcessInstanceStatus.RUNNING)
                .startUserId("user-002").build();

        PageImpl<ProcessInstanceEntity> page = new PageImpl<>(
                List.of(entity1, entity2), PageRequest.of(0, 20), 2);

        when(processInstanceRepository.findByTenantIdAndStatus(
                eq(TenantContext.DEFAULT_TENANT_ID),
                eq(ProcessInstanceStatus.RUNNING),
                any(PageRequest.class)))
                .thenReturn(page);

        PageResponse<ProcessInstanceResponse> result =
                processInstanceService.list(null, ProcessInstanceStatus.RUNNING, 1, 20);

        assertThat(result.getItems()).hasSize(2);
        assertThat(result.getTotal()).isEqualTo(2);
        assertThat(result.getPage()).isEqualTo(1);
        assertThat(result.getPageSize()).isEqualTo(20);
        assertThat(result.getItems().get(0).getId()).isEqualTo("pi-001");
    }

    @Test
    void getById_shouldReturnInstance_whenExists() {
        ProcessInstanceEntity entity = ProcessInstanceEntity.builder()
                .id("pi-001").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .processDefinitionId("pd-001").processKey("purchase_approval")
                .businessKey("biz-001").status(ProcessInstanceStatus.RUNNING)
                .startUserId("user-001")
                .variables("{\"amount\":1000}")
                .build();

        when(processInstanceRepository.findByIdAndTenantId(
                "pi-001", TenantContext.DEFAULT_TENANT_ID))
                .thenReturn(Optional.of(entity));

        ProcessInstanceResponse response = processInstanceService.getById("pi-001");

        assertThat(response.getId()).isEqualTo("pi-001");
        assertThat(response.getProcessKey()).isEqualTo("purchase_approval");
        assertThat(response.getStatus()).isEqualTo("RUNNING");
        assertThat(response.getBusinessKey()).isEqualTo("biz-001");
        assertThat(response.getVariables()).containsEntry("amount", 1000);
    }

    @Test
    void getById_shouldThrow404_whenNotFound() {
        when(processInstanceRepository.findByIdAndTenantId(
                "nonexistent", TenantContext.DEFAULT_TENANT_ID))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> processInstanceService.getById("nonexistent"))
                .isInstanceOf(WfeException.class)
                .hasMessageContaining("流程实例不存在");
    }

    @Test
    void terminate_shouldUpdateStatus_whenRunning() {
        ProcessInstanceEntity entity = ProcessInstanceEntity.builder()
                .id("pi-001").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .processDefinitionId("pd-001").processKey("purchase_approval")
                .businessKey("biz-001").status(ProcessInstanceStatus.RUNNING)
                .startUserId("user-001").build();

        when(processInstanceRepository.findByIdAndTenantId(
                "pi-001", TenantContext.DEFAULT_TENANT_ID))
                .thenReturn(Optional.of(entity));
        when(processInstanceRepository.save(any(ProcessInstanceEntity.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        processInstanceService.terminate("pi-001");

        assertThat(entity.getStatus()).isEqualTo(ProcessInstanceStatus.TERMINATED);
        verify(runtimeService).deleteProcessInstance("pi-001", "TERMINATED");
        verify(processInstanceRepository).save(entity);
    }

    @Test
    void terminate_shouldThrow409_whenAlreadyTerminated() {
        ProcessInstanceEntity entity = ProcessInstanceEntity.builder()
                .id("pi-001").tenantId(TenantContext.DEFAULT_TENANT_ID)
                .processDefinitionId("pd-001").processKey("purchase_approval")
                .businessKey("biz-001").status(ProcessInstanceStatus.TERMINATED)
                .startUserId("user-001").build();

        when(processInstanceRepository.findByIdAndTenantId(
                "pi-001", TenantContext.DEFAULT_TENANT_ID))
                .thenReturn(Optional.of(entity));

        assertThatThrownBy(() -> processInstanceService.terminate("pi-001"))
                .isInstanceOf(WfeException.class)
                .hasMessageContaining("已终止");

        verify(runtimeService, never()).deleteProcessInstance(anyString(), anyString());
    }
}
