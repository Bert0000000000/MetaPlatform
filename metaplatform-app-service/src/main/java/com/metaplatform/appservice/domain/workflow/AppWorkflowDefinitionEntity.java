package com.metaplatform.appservice.domain.workflow;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

/**
 * 流程定义业务元数据，映射到 Flowable deployment / processDefinition。
 */
@Entity
@Table(name = "app_workflow_definitions",
        uniqueConstraints = @UniqueConstraint(name = "uk_app_workflow_def_app_code", columnNames = {"app_id", "code"}))
public class AppWorkflowDefinitionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "app_id", nullable = false)
    private Long appId;

    @Column(name = "form_id")
    private Long formId;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(name = "process_key", nullable = false, length = 128)
    private String processKey;

    @Column(nullable = false, length = 128)
    private String code;

    @Column(name = "deployment_id", length = 64)
    private String deploymentId;

    @Column(name = "process_definition_id", length = 64)
    private String processDefinitionId;

    @Column(name = "process_definition_key", length = 128)
    private String processDefinitionKey;

    @Column(name = "bpmn_xml", columnDefinition = "TEXT")
    private String bpmnXml;

    @Column(nullable = false, length = 32)
    private String status = "draft";

    @Column(name = "field_permissions", columnDefinition = "TEXT")
    private String fieldPermissions;

    @Column(nullable = false)
    private Integer version = 1;

    @Column(name = "created_by", nullable = false, length = 64)
    private String createdBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public AppWorkflowDefinitionEntity() {}

    public Long getId() { return id; }
    public Long getAppId() { return appId; }
    public void setAppId(Long appId) { this.appId = appId; }
    public Long getFormId() { return formId; }
    public void setFormId(Long formId) { this.formId = formId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getProcessKey() { return processKey; }
    public void setProcessKey(String processKey) { this.processKey = processKey; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getDeploymentId() { return deploymentId; }
    public void setDeploymentId(String deploymentId) { this.deploymentId = deploymentId; }
    public String getProcessDefinitionId() { return processDefinitionId; }
    public void setProcessDefinitionId(String processDefinitionId) { this.processDefinitionId = processDefinitionId; }
    public String getProcessDefinitionKey() { return processDefinitionKey; }
    public void setProcessDefinitionKey(String processDefinitionKey) { this.processDefinitionKey = processDefinitionKey; }
    public String getBpmnXml() { return bpmnXml; }
    public void setBpmnXml(String bpmnXml) { this.bpmnXml = bpmnXml; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getFieldPermissions() { return fieldPermissions; }
    public void setFieldPermissions(String fieldPermissions) { this.fieldPermissions = fieldPermissions; }
    public Integer getVersion() { return version; }
    public void setVersion(Integer version) { this.version = version; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
