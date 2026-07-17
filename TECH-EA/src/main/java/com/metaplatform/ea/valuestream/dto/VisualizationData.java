package com.metaplatform.ea.valuestream.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VisualizationData {

    private UUID valueStreamId;
    private String name;
    private List<String> stages;
    private List<StageCapability> stageCapabilities;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StageCapability {
        private String stageName;
        private List<UUID> capabilityIds;
    }
}
