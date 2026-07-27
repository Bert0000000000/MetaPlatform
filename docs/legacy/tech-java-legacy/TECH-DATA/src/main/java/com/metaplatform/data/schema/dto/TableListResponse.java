package com.metaplatform.data.schema.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 表列表响应。
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TableListResponse {

    private String datasourceId;
    private String database;
    private List<TableInfo> tables;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class TableInfo {
        private String name;
        private String type;
        private String engine;
        private long rowCount;
        private long dataSizeBytes;
        private OffsetDateTime lastModifiedAt;
    }
}
