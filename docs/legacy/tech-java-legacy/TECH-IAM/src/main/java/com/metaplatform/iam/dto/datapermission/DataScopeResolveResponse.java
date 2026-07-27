package com.metaplatform.iam.dto.datapermission;

import com.metaplatform.iam.entity.DataPermissionEntity;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DataScopeResolveResponse {

    private String userId;
    private String resourceType;
    private DataPermissionEntity.DataScope dataScope;
    private String rowFilter;
    private List<String> columnFilter;
}
