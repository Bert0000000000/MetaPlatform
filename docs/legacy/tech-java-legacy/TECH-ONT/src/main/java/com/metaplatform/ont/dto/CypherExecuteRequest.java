package com.metaplatform.ont.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.util.Map;

/**
 * Cypher 查询执行请求（V12-05 REQ-062）。
 * 参数与查询一起绑定到 Neo4j。
 */
@Getter
@Setter
public class CypherExecuteRequest {

    @NotBlank(message = "Cypher 查询语句不能为空")
    @Size(max = 8000, message = "Cypher 查询语句过长")
    private String query;

    /**
     * 可选参数：以 $name 占位符绑定到 Cypher。
     */
    private Map<String, Object> params;

    /**
     * 结果行数上限，默认 100，最大 1000。
     */
    private Integer limit = 100;
}
