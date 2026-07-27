package com.metaplatform.dashboard.dto;

import java.util.List;

public record BatchHandleRequest(List<String> todoIds, Object action) {
}
