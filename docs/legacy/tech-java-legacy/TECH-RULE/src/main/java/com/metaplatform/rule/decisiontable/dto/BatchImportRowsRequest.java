package com.metaplatform.rule.decisiontable.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class BatchImportRowsRequest {

    @NotNull(message = "行列表不能为空")
    private List<AddRowRequest> rows;
}
