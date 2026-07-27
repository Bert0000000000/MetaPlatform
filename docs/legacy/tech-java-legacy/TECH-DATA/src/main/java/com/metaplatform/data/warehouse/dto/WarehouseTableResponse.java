package com.metaplatform.data.warehouse.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * 数据仓库表信息。
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WarehouseTableResponse {

    private String name;
    private String layer;
    private String schema;
    private String type;
    private long rowCount;
    private long sizeBytes;
    private String engine;
    private OffsetDateTime lastModifiedAt;
}
