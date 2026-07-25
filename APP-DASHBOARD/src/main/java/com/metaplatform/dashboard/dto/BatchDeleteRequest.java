package com.metaplatform.dashboard.dto;

import java.util.List;

public record BatchDeleteRequest(List<String> ids) {
}
