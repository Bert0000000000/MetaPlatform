package com.metaplatform.appservice.domain.workflow;

import com.metaplatform.appservice.api.error.ApiException;
import com.metaplatform.appservice.domain.app.AppService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * 表单与流程定义的绑定服务。
 */
@Service
public class AppFormWorkflowService {

    private final AppFormWorkflowRepository repository;
    private final AppWorkflowDefinitionRepository definitionRepository;
    private final AppService appService;

    public AppFormWorkflowService(AppFormWorkflowRepository repository,
                                  AppWorkflowDefinitionRepository definitionRepository,
                                  AppService appService) {
        this.repository = repository;
        this.definitionRepository = definitionRepository;
        this.appService = appService;
    }

    @Transactional
    public AppFormWorkflowEntity bind(String appIdOrSlug, Long formId, Long workflowDefinitionId) {
        Long appId = appService.resolveByIdOrCode(appIdOrSlug).getId();
        AppWorkflowDefinitionEntity def = definitionRepository.findByIdAndAppId(workflowDefinitionId, appId)
                .orElseThrow(() -> ApiException.notFound("流程定义不存在"));
        if (!"published".equals(def.getStatus())) {
            throw ApiException.badRequest("只能绑定已发布的流程定义");
        }

        Optional<AppFormWorkflowEntity> existing = repository.findByAppIdAndFormId(appId, formId);
        AppFormWorkflowEntity entity = existing.orElseGet(AppFormWorkflowEntity::new);
        entity.setAppId(appId);
        entity.setFormId(formId);
        entity.setWorkflowDefinitionId(workflowDefinitionId);
        entity.setEnabled(true);
        return repository.save(entity);
    }

    @Transactional(readOnly = true)
    public Optional<AppFormWorkflowEntity> findEnabled(String appIdOrSlug, Long formId) {
        Long appId = appService.resolveByIdOrCode(appIdOrSlug).getId();
        return repository.findByAppIdAndFormIdAndEnabled(appId, formId, true);
    }

    @Transactional
    public void unbind(String appIdOrSlug, Long formId) {
        Long appId = appService.resolveByIdOrCode(appIdOrSlug).getId();
        repository.findByAppIdAndFormId(appId, formId).ifPresent(repository::delete);
    }
}
