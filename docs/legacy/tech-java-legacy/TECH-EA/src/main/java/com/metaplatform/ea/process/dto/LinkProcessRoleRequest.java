package com.metaplatform.ea.process.dto;

import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class LinkProcessRoleRequest {

    private List<UUID> roleIds;

    private String relationship;
}
