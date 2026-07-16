package com.metaplatform.pagegenerator.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

/**
 * 看板配置 - 嵌入在 PageSection 中
 */
@Embeddable
public class KanbanConfig {

    private String groupByField;      // 分组字段
    private String titleField;        // 卡片标题字段
    private String descriptionField;  // 卡片描述字段
    private String avatarField;       // 头像字段

    @Column(columnDefinition = "TEXT")
    private String colorRules;        // 颜色规则 JSON

    @Column(columnDefinition = "TEXT")
    private String swimLaneConfig;    // 泳道配置 JSON

    public KanbanConfig() {}

    public String getGroupByField() { return groupByField; }
    public void setGroupByField(String groupByField) { this.groupByField = groupByField; }

    public String getTitleField() { return titleField; }
    public void setTitleField(String titleField) { this.titleField = titleField; }

    public String getDescriptionField() { return descriptionField; }
    public void setDescriptionField(String descriptionField) { this.descriptionField = descriptionField; }

    public String getAvatarField() { return avatarField; }
    public void setAvatarField(String avatarField) { this.avatarField = avatarField; }

    public String getColorRules() { return colorRules; }
    public void setColorRules(String colorRules) { this.colorRules = colorRules; }

    public String getSwimLaneConfig() { return swimLaneConfig; }
    public void setSwimLaneConfig(String swimLaneConfig) { this.swimLaneConfig = swimLaneConfig; }
}
