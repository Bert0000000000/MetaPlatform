package com.metaplatform.kb.dto;
import java.util.List;
public record BatchApproveRequest(List<String> reviewIds, String userId) {}
