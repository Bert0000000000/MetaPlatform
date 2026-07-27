package com.metaplatform.data.schema.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

/**
 * 表列信息响应。
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ColumnListResponse {

    private String datasourceId;
    private String database;
    private String table;
    private List<ColumnInfo> columns;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ColumnInfo {
        private String name;
        private String dataType;
        private boolean nullable;
        private String defaultValue;
        private String comment;
        private boolean primaryKey;
        private int ordinalPosition;
    }
}
