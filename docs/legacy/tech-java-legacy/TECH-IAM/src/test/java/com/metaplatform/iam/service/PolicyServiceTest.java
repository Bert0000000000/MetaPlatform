package com.metaplatform.iam.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.iam.common.PageResponse;
import com.metaplatform.iam.dto.policy.CreatePolicyRequest;
import com.metaplatform.iam.dto.policy.PolicyMatrixResponse;
import com.metaplatform.iam.dto.policy.PolicyResponse;
import com.metaplatform.iam.dto.policy.UpdatePolicyRequest;
import com.metaplatform.iam.entity.PolicyEntity;
import com.metaplatform.iam.entity.UserEntity;
import com.metaplatform.iam.exception.IamException;
import com.metaplatform.iam.repository.PolicyRepository;
import com.metaplatform.iam.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.anyIterable;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PolicyServiceTest {

    @Mock
    private PolicyRepository policyRepository;

    @Mock
    private UserRepository userRepository;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private PolicyService policyService;

    @Test
    void create_shouldReturnPolicyResponse() {
        CreatePolicyRequest request = new CreatePolicyRequest();
        request.setName("允许调用工具");
        request.setSubjectType(PolicyEntity.SubjectType.USER);
        request.setSubjectId("u1");
        request.setResourceType("tool");
        request.setResourceIds(List.of("t1", "t2"));
        request.setAction("invoke");
        request.setEffect(PolicyEntity.Effect.ALLOW);
        request.setPriority(10);
        request.setEnabled(true);

        when(policyRepository.save(any(PolicyEntity.class))).thenAnswer(i -> i.getArgument(0));

        PolicyResponse response = policyService.create(request);

        assertThat(response.getName()).isEqualTo("允许调用工具");
        assertThat(response.getSubjectId()).isEqualTo("u1");
        assertThat(response.getResourceIds()).containsExactly("t1", "t2");
        assertThat(response.getAction()).isEqualTo("invoke");
        assertThat(response.getEffect()).isEqualTo(PolicyEntity.Effect.ALLOW);
    }

    @Test
    void list_shouldReturnPaged() {
        PolicyEntity entity = PolicyEntity.builder()
                .id("p1").tenantId("tenant-default").name("策略1")
                .subjectType(PolicyEntity.SubjectType.USER).subjectId("u1")
                .resourceType("tool").resourceIds("[\"t1\"]")
                .action("invoke").effect(PolicyEntity.Effect.ALLOW)
                .priority(5).enabled(true).version(1).deleted(false)
                .build();
        when(policyRepository.search(anyString(), any(), any(), any(), any(), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(entity)));

        PageResponse<PolicyResponse> page = policyService.list(null, null, "USER", null, "tool", 1, 10);

        assertThat(page.getItems()).hasSize(1);
        assertThat(page.getItems().get(0).getName()).isEqualTo("策略1");
    }

    @Test
    void update_shouldThrow_whenVersionMismatch() {
        PolicyEntity entity = PolicyEntity.builder()
                .id("p1").tenantId("tenant-default").name("策略")
                .subjectType(PolicyEntity.SubjectType.USER).subjectId("u1")
                .resourceType("tool").resourceIds("[\"t1\"]")
                .action("invoke").effect(PolicyEntity.Effect.ALLOW)
                .priority(1).enabled(true).version(2).deleted(false)
                .build();
        when(policyRepository.findByIdAndDeletedFalse("p1")).thenReturn(Optional.of(entity));

        UpdatePolicyRequest request = new UpdatePolicyRequest();
        request.setName("策略");
        request.setSubjectType(PolicyEntity.SubjectType.USER);
        request.setSubjectId("u1");
        request.setResourceType("tool");
        request.setResourceIds(List.of("t1"));
        request.setAction("invoke");
        request.setEffect(PolicyEntity.Effect.ALLOW);
        request.setPriority(1);
        request.setEnabled(true);
        request.setVersion(1);

        assertThatThrownBy(() -> policyService.update("p1", request))
                .isInstanceOf(IamException.class)
                .hasMessageContaining("策略版本不匹配");
    }

    @Test
    void buildMatrix_shouldReturnAllowDenyInherit() {
        PolicyEntity allow = PolicyEntity.builder()
                .id("p1").tenantId("tenant-default").name("允许")
                .subjectType(PolicyEntity.SubjectType.USER).subjectId("u1")
                .resourceType("tool").resourceIds("[\"t1\"]")
                .action("invoke").effect(PolicyEntity.Effect.ALLOW)
                .priority(1).enabled(true).version(1).deleted(false)
                .build();
        PolicyEntity deny = PolicyEntity.builder()
                .id("p2").tenantId("tenant-default").name("拒绝")
                .subjectType(PolicyEntity.SubjectType.USER).subjectId("u2")
                .resourceType("tool").resourceIds("[\"t1\"]")
                .action("invoke").effect(PolicyEntity.Effect.DENY)
                .priority(1).enabled(true).version(1).deleted(false)
                .build();
        when(policyRepository.findByTenantIdAndSubjectTypeAndResourceTypeAndDeletedFalse(
                "tenant-default", PolicyEntity.SubjectType.USER, "tool"))
                .thenReturn(List.of(allow, deny));
        when(userRepository.findAllById(anyIterable()))
                .thenReturn(List.of(
                        UserEntity.builder().id("u1").username("alice").realName("Alice").build(),
                        UserEntity.builder().id("u2").username("bob").build()));

        PolicyMatrixResponse matrix = policyService.buildMatrix("user-tool", "invoke");

        assertThat(matrix.getRows()).hasSize(2);
        assertThat(matrix.getColumns()).hasSize(1);
        String toolId = matrix.getColumns().get(0).getToolId();
        String u1Effect = matrix.getRows().get(0).getCells().get(toolId);
        String u2Effect = matrix.getRows().get(1).getCells().get(toolId);
        assertThat(u1Effect).isEqualTo("allow");
        assertThat(u2Effect).isEqualTo("deny");
    }

    @Test
    void exportMatrix_shouldReturnCsvBytes() {
        PolicyMatrixResponse matrix = policyService.buildMatrix("app-tool", "invoke");
        byte[] data = policyService.exportMatrix(matrix, "csv");
        String csv = new String(data, java.nio.charset.StandardCharsets.UTF_8);
        assertThat(csv).contains("主体");
    }

    @Test
    void conditionSyntax_shouldReturnExamples() {
        assertThat(policyService.conditionSyntax().getExamples()).isNotEmpty();
    }
}
