package com.metaplatform.pagegenerator.domain;

import com.metaplatform.pagegenerator.domain.enums.ConfigStatus;
import com.metaplatform.pagegenerator.domain.enums.PageType;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * PageConfig 聚合根 - 页面配置的核心领域对象
 */
@Entity
@Table(name = "page_config")
public class PageConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, unique = true)
    private String code;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PageType pageType;

    @Column(name = "object_code")
    private String objectCode;

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "page_config_id")
    @OrderBy("sortOrder ASC")
    private List<PageSection> sections = new ArrayList<>();

    @Embedded
    private ViewConfig viewConfig;

    @Column(columnDefinition = "TEXT")
    private String jsonConfig;

    @Enumerated(EnumType.STRING)
    private ConfigStatus status = ConfigStatus.DRAFT;

    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public PageConfig() {}

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public PageType getPageType() { return pageType; }
    public void setPageType(PageType pageType) { this.pageType = pageType; }

    public String getObjectCode() { return objectCode; }
    public void setObjectCode(String objectCode) { this.objectCode = objectCode; }

    public List<PageSection> getSections() { return sections; }
    public void setSections(List<PageSection> sections) { this.sections = sections; }

    public ViewConfig getViewConfig() { return viewConfig; }
    public void setViewConfig(ViewConfig viewConfig) { this.viewConfig = viewConfig; }

    public String getJsonConfig() { return jsonConfig; }
    public void setJsonConfig(String jsonConfig) { this.jsonConfig = jsonConfig; }

    public ConfigStatus getStatus() { return status; }
    public void setStatus(ConfigStatus status) { this.status = status; }

    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
