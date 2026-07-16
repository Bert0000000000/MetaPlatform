package com.metaplatform.pagegenerator.domain;

import com.metaplatform.pagegenerator.domain.enums.WidgetType;
import jakarta.persistence.*;

/**
 * 字段组件 - 描述页面中的一个可渲染字段
 */
@Entity
@Table(name = "field_widget")
public class FieldWidget {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "section_id")
    private Long sectionId;

    @Column(nullable = false)
    private String fieldCode;

    @Column(nullable = false)
    private String label;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private WidgetType widgetType;

    private Boolean required = false;
    private Boolean readonly = false;

    private String placeholder;
    private Integer colSpan = 1;

    @Column(columnDefinition = "TEXT")
    private String options;

    @Column(columnDefinition = "TEXT")
    private String validationRules;

    private Integer sortOrder = 0;

    public FieldWidget() {}

    public FieldWidget(String fieldCode, String label, WidgetType widgetType) {
        this.fieldCode = fieldCode;
        this.label = label;
        this.widgetType = widgetType;
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getSectionId() { return sectionId; }
    public void setSectionId(Long sectionId) { this.sectionId = sectionId; }

    public String getFieldCode() { return fieldCode; }
    public void setFieldCode(String fieldCode) { this.fieldCode = fieldCode; }

    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }

    public WidgetType getWidgetType() { return widgetType; }
    public void setWidgetType(WidgetType widgetType) { this.widgetType = widgetType; }

    public Boolean getRequired() { return required; }
    public void setRequired(Boolean required) { this.required = required; }

    public Boolean getReadonly() { return readonly; }
    public void setReadonly(Boolean readonly) { this.readonly = readonly; }

    public String getPlaceholder() { return placeholder; }
    public void setPlaceholder(String placeholder) { this.placeholder = placeholder; }

    public Integer getColSpan() { return colSpan; }
    public void setColSpan(Integer colSpan) { this.colSpan = colSpan; }

    public String getOptions() { return options; }
    public void setOptions(String options) { this.options = options; }

    public String getValidationRules() { return validationRules; }
    public void setValidationRules(String validationRules) { this.validationRules = validationRules; }

    public Integer getSortOrder() { return sortOrder; }
    public void setSortOrder(Integer sortOrder) { this.sortOrder = sortOrder; }
}
