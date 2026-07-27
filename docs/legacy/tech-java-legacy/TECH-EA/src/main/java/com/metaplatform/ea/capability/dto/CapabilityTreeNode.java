package com.metaplatform.ea.capability.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CapabilityTreeNode {

    private UUID id;
    private String name;
    private String code;
    private String description;
    private UUID parentId;
    private Integer level;
    private Integer sortOrder;
    private String status;
    private List<CapabilityTreeNode> children;
}
