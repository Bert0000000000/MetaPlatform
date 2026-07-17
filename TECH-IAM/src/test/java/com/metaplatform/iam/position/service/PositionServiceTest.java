package com.metaplatform.iam.position.service;

import com.metaplatform.iam.common.ErrorCode;
import com.metaplatform.iam.exception.IamException;
import com.metaplatform.iam.position.dto.CreatePositionRequest;
import com.metaplatform.iam.position.dto.PositionResponse;
import com.metaplatform.iam.position.entity.PositionEntity;
import com.metaplatform.iam.position.repository.PositionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PositionServiceTest {

    @Mock
    private PositionRepository positionRepository;

    private PositionService service;

    @BeforeEach
    void setUp() {
        service = new PositionService(positionRepository);
    }

    private PositionEntity sampleEntity(String code, int level) {
        return PositionEntity.builder()
                .id(UUID.randomUUID().toString())
                .tenantId("tenant-default")
                .code(code)
                .name("pos-" + code)
                .level(level)
                .version(1)
                .deleted(false)
                .build();
    }

    @Test
    void create_position_success() {
        CreatePositionRequest request = new CreatePositionRequest();
        request.setName("manager");
        request.setCode("mgr");
        request.setLevel(1);

        when(positionRepository.existsByTenantIdAndCodeAndDeletedFalse("tenant-default", "mgr"))
                .thenReturn(false);
        when(positionRepository.save(any(PositionEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        PositionResponse response = service.create(request);
        assertThat(response.getCode()).isEqualTo("mgr");
        assertThat(response.getLevel()).isEqualTo(1);
    }

    @Test
    void create_duplicate_code_throws() {
        CreatePositionRequest request = new CreatePositionRequest();
        request.setName("manager");
        request.setCode("mgr");

        when(positionRepository.existsByTenantIdAndCodeAndDeletedFalse("tenant-default", "mgr"))
                .thenReturn(true);

        assertThatThrownBy(() -> service.create(request))
                .isInstanceOf(IamException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.USER_ALREADY_EXISTS);
    }

    @Test
    void create_with_parent_inherits_level() {
        CreatePositionRequest request = new CreatePositionRequest();
        request.setName("senior manager");
        request.setCode("sr_mgr");

        PositionEntity parent = sampleEntity("mgr", 2);
        when(positionRepository.existsByTenantIdAndCodeAndDeletedFalse("tenant-default", "sr_mgr"))
                .thenReturn(false);
        when(positionRepository.findByIdAndDeletedFalse(parent.getId()))
                .thenReturn(Optional.of(parent));
        when(positionRepository.save(any(PositionEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        request.setParentId(parent.getId());
        PositionResponse response = service.create(request);
        assertThat(response.getLevel()).isEqualTo(3);
    }

    @Test
    void get_not_found_throws() {
        String id = UUID.randomUUID().toString();
        when(positionRepository.findByIdAndDeletedFalse(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.get(id))
                .isInstanceOf(IamException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.NOT_FOUND);
    }

    @Test
    void update_changes_name() {
        String id = UUID.randomUUID().toString();
        PositionEntity entity = sampleEntity("mgr", 1);
        when(positionRepository.findByIdAndDeletedFalse(id)).thenReturn(Optional.of(entity));
        when(positionRepository.save(any(PositionEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        com.metaplatform.iam.position.dto.UpdatePositionRequest request =
                new com.metaplatform.iam.position.dto.UpdatePositionRequest();
        request.setName("renamed");

        PositionResponse response = service.update(id, request);
        assertThat(response.getName()).isEqualTo("renamed");
    }

    @Test
    void soft_delete_marks_deleted() {
        String id = UUID.randomUUID().toString();
        PositionEntity entity = sampleEntity("mgr", 1);
        when(positionRepository.findByIdAndDeletedFalse(id)).thenReturn(Optional.of(entity));
        when(positionRepository.save(any(PositionEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        service.softDelete(id);
        assertThat(entity.getDeleted()).isTrue();
    }
}