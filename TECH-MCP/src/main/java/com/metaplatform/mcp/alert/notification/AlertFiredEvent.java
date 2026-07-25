package com.metaplatform.mcp.alert.notification;

import java.util.Map;

public record AlertFiredEvent(Map<String, Object> payload) {
}