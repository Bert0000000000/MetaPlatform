package com.metaplatform.pagegenerator.domain;

import com.metaplatform.pagegenerator.domain.enums.SectionType;
import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;

/**
 * 页面区块 - 属于 PageConfig 聚合
 */
@Entity
@Table(name = "page_section")
public class PageSection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "page_config_id", nullable = false)
    private Long pageConfigId;

    @Column(nullable = false)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SectionType sectionType;

    private Integer sortOrder = 0;
    private Integer columns = 2;

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "section_id")
    @OrderBy("sortOrder ASC")
    private List<FieldWidget> fields = new ArrayList<>();

    @Embedded
    private TableConfig tableConfig;

    @Embedded
    private KanbanConfig kanbanConfig;

    public PageSection() {}

    public PageSection(String title, SectionType sectionType) {
        this.title = title;
        this.sectionType = sectionType;
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getPageConfigId() { return pageConfigId; }
    public void setPageConfigId(Long pageConfigId) { this.pageConfigId = pageConfigId; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public SectionType getSectionType() { return sectionType; }
    public void setSectionType(SectionType sectionType) { this.sectionType = sectionType; }

    public Integer getSortOrder() { return sortOrder; }
    public void setSortOrder(Integer sortOrder) { this.sortOrder = sortOrder; }

    public Integer getColumns() { return columns; }
    public void setColumns(Integer columns) { this.columns = columns; }

    public List<FieldWidget> getFields() { return fields; }
    public void setFields(List<FieldWidget> fields) { this.fields = fields; }

    public TableConfig getTableConfig() { return tableConfig; }
    public void setTableConfig(TableConfig tableConfig) { this.tableConfig = tableConfig; }

    public KanbanConfig getKanbanConfig() { return kanbanConfig; }
    public void setKanbanConfig(KanbanConfig kanbanConfig) { this.kanbanConfig = kanbanConfig; }
}
