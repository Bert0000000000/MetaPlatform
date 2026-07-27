package com.metaplatform.gw.security;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.util.ArrayList;
import java.util.List;

@Data
@Configuration
@ConfigurationProperties(prefix = "app.whitelist")
public class WhitelistProperties {

    private List<String> paths = new ArrayList<>();
}
