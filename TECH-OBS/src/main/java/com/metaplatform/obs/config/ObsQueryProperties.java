package com.metaplatform.obs.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "app.obs.query")
public class ObsQueryProperties {

    private int maxTimeRangeHours = 168;
    private int defaultPageSize = 50;
    private int maxPageSize = 500;
}
