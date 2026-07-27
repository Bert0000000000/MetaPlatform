package com.metaplatform.data.queries.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * SQL 查询执行请求。
 *
 * <p>对应 Python app/api/v1/queries.py 的 QueryExecuteRequest。</p>
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ExecuteQueryRequest {

    @NotBlank
    private String datasourceId;

    @NotBlank
    private String sql;

    /** 最大返回行数，null 时使用全局配置。 */
    private Integer maxRows;
}
