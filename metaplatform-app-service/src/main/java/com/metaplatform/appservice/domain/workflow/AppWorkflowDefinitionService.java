package com.metaplatform.appservice.domain.workflow;

import com.fasterxml.jackson.databind.JsonNode;
import com.metaplatform.appservice.api.error.ApiException;
import com.metaplatform.appservice.domain.app.AppService;
import com.metaplatform.appservice.security.TenantContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * 流程定义业务服务：管理 BPMN 定义、部署到 Flowable、解析字段权限。
 */
@Service
public class AppWorkflowDefinitionService {

    private final AppWorkflowDefinitionRepository definitionRepository;
    private final AppFormWorkflowRepository formWorkflowRepository;
    private final FlowableRestClient flowableRestClient;
    private final AppService appService;

    public AppWorkflowDefinitionService(AppWorkflowDefinitionRepository definitionRepository,
                                        AppFormWorkflowRepository formWorkflowRepository,
                                        FlowableRestClient flowableRestClient,
                                        AppService appService) {
        this.definitionRepository = definitionRepository;
        this.formWorkflowRepository = formWorkflowRepository;
        this.flowableRestClient = flowableRestClient;
        this.appService = appService;
    }

    @Transactional(readOnly = true)
    public List<AppWorkflowDefinitionEntity> listByApp(String appIdOrSlug) {
        Long appId = appService.resolveByIdOrCode(appIdOrSlug).getId();
        return definitionRepository.findByAppId(appId);
    }

    @Transactional(readOnly = true)
    public AppWorkflowDefinitionEntity getById(String appIdOrSlug, Long id) {
        Long appId = appService.resolveByIdOrCode(appIdOrSlug).getId();
        return definitionRepository.findByIdAndAppId(id, appId)
                .orElseThrow(() -> ApiException.notFound("流程定义不存在"));
    }

    @Transactional
    public AppWorkflowDefinitionEntity create(String appIdOrSlug, WorkflowDefinitionRequest req) {
        Long appId = appService.resolveByIdOrCode(appIdOrSlug).getId();
        String code = req.getCode();
        if (definitionRepository.existsByAppIdAndCode(appId, code)) {
            throw ApiException.badRequest("流程编码已存在: " + code);
        }
        String bpmnXml = req.getBpmnXml();
        String key = BpmnXmlParser.extractProcessKey(bpmnXml);
        String fieldPermissions = BpmnXmlParser.extractFieldPermissions(bpmnXml);

        AppWorkflowDefinitionEntity def = new AppWorkflowDefinitionEntity();
        def.setAppId(appId);
        def.setFormId(req.getFormId());
        def.setName(req.getName());
        def.setCode(code);
        def.setProcessKey(key);
        def.setBpmnXml(bpmnXml);
        def.setFieldPermissions(fieldPermissions);
        def.setStatus("draft");
        def.setCreatedBy(currentUser());
        return definitionRepository.save(def);
    }

    @Transactional
    public AppWorkflowDefinitionEntity update(String appIdOrSlug, Long id, WorkflowDefinitionRequest req) {
        Long appId = appService.resolveByIdOrCode(appIdOrSlug).getId();
        AppWorkflowDefinitionEntity def = definitionRepository.findByIdAndAppId(id, appId)
                .orElseThrow(() -> ApiException.notFound("流程定义不存在"));
        if ("published".equals(def.getStatus())) {
            throw ApiException.badRequest("已发布的流程不可直接修改，请新建版本");
        }
        String bpmnXml = req.getBpmnXml();
        def.setName(req.getName());
        def.setProcessKey(BpmnXmlParser.extractProcessKey(bpmnXml));
        def.setBpmnXml(bpmnXml);
        def.setFieldPermissions(BpmnXmlParser.extractFieldPermissions(bpmnXml));
        if (req.getFormId() != null) def.setFormId(req.getFormId());
        return definitionRepository.save(def);
    }

    @Transactional
    public AppWorkflowDefinitionEntity publish(String appIdOrSlug, Long id) {
        Long appId = appService.resolveByIdOrCode(appIdOrSlug).getId();
        AppWorkflowDefinitionEntity def = definitionRepository.findByIdAndAppId(id, appId)
                .orElseThrow(() -> ApiException.notFound("流程定义不存在"));
        if ("published".equals(def.getStatus())) {
            return def;
        }

        JsonNode deployment = flowableRestClient.deploy(def.getCode(), def.getBpmnXml());
        String deploymentId = deployment.path("id").asText();

        List<JsonNode> defs = flowableRestClient.listProcessDefinitions(deploymentId);
        if (defs.isEmpty()) {
            throw ApiException.internalError("Flowable 部署成功但找不到流程定义");
        }
        JsonNode pd = defs.get(0);
        def.setDeploymentId(deploymentId);
        def.setProcessDefinitionId(pd.path("id").asText());
        def.setProcessDefinitionKey(pd.path("key").asText());
        def.setStatus("published");
        def.setVersion(def.getVersion() + 1);
        return definitionRepository.save(def);
    }

    @Transactional
    public AppWorkflowDefinitionEntity suspend(String appIdOrSlug, Long id) {
        Long appId = appService.resolveByIdOrCode(appIdOrSlug).getId();
        AppWorkflowDefinitionEntity def = definitionRepository.findByIdAndAppId(id, appId)
                .orElseThrow(() -> ApiException.notFound("流程定义不存在"));
        def.setStatus("suspended");
        return definitionRepository.save(def);
    }

    @Transactional
    public void delete(String appIdOrSlug, Long id) {
        Long appId = appService.resolveByIdOrCode(appIdOrSlug).getId();
        AppWorkflowDefinitionEntity def = definitionRepository.findByIdAndAppId(id, appId)
                .orElseThrow(() -> ApiException.notFound("流程定义不存在"));
        // 解绑表单
        formWorkflowRepository.findByAppIdAndFormId(appId, def.getFormId()).ifPresent(formWorkflowRepository::delete);
        definitionRepository.delete(def);
    }

    @Transactional(readOnly = true)
    public Optional<AppWorkflowDefinitionEntity> findPublishedByForm(String appIdOrSlug, Long formId) {
        Long appId = appService.resolveByIdOrCode(appIdOrSlug).getId();
        return definitionRepository.findByAppIdAndFormIdAndStatus(appId, formId, "published");
    }

    private String currentUser() {
        return "dev-user";
    }
}
