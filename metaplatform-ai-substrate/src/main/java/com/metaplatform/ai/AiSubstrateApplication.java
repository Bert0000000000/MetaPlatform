package com.metaplatform.ai;

import com.metaplatform.ai.llm.ModelAlias;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@SpringBootApplication
@EnableJpaRepositories
@EnableConfigurationProperties({ModelAlias.class})
public class AiSubstrateApplication {

    public static void main(String[] args) {
        SpringApplication.run(AiSubstrateApplication.class, args);
    }
}
