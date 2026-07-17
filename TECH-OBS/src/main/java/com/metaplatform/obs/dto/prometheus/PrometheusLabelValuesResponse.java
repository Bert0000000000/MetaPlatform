package com.metaplatform.obs.dto.prometheus;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class PrometheusLabelValuesResponse {

    private String status;
    private List<String> data;
}
