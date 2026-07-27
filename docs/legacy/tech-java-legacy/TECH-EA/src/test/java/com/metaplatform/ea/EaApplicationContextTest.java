package com.metaplatform.ea;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaplatform.ea.application.repository.ApplicationRepository;
import com.metaplatform.ea.application.repository.ApplicationTechComponentRepository;
import com.metaplatform.ea.application.service.ApplicationTechComponentService;
import com.metaplatform.ea.capability.repository.BusinessCapabilityRepository;
import com.metaplatform.ea.capabilitymap.repository.CapabilityMapRepository;
import com.metaplatform.ea.capabilitymap.repository.CapabilityMapVersionRepository;
import com.metaplatform.ea.capabilitymap.service.CapabilityMapService;
import com.metaplatform.ea.debt.service.TechDebtService;
import com.metaplatform.ea.governance.compliance.service.ComplianceAssessmentService;
import com.metaplatform.ea.governance.health.repository.HealthScoreRepository;
import com.metaplatform.ea.governance.health.service.ArchitectureHealthService;
import com.metaplatform.ea.impact.service.ImpactAnalysisService;
import com.metaplatform.ea.landscape.service.LandscapeViewService;
import com.metaplatform.ea.mapping.repository.CapabilityConceptMappingRepository;
import com.metaplatform.ea.ontmapping.service.ConceptMappingRuleService;
import com.metaplatform.ea.process.repository.BusinessProcessRepository;
import com.metaplatform.ea.techcomponent.repository.TechnologyComponentRepository;
import com.metaplatform.ea.techstack.repository.TechnologyStackRepository;
import com.metaplatform.ea.techarchitecture.repository.InfrastructureRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * TECH-EA 完整应用上下文启动验证（@SpringBootTest）。
 *
 * <p>验证深度实现引入的新 Bean 与运行时特性能在完整应用上下文中正确装配：
 * <ul>
 *   <li>{@code contextLoads}：完整上下文加载（JPA + WebFlux + WebClient）</li>
 *   <li>{@code applicationTechComponentServiceInjected}：ApplicationTechComponentService 及 3 个 Repository</li>
 *   <li>{@code complianceAssessmentServiceInjected}：ComplianceAssessmentService 装配</li>
 *   <li>{@code landscapeViewServiceInjected}：LandscapeViewService 及 7 个依赖 Bean</li>
 *   <li>{@code impactAnalysisServiceInjected}：ImpactAnalysisService 装配</li>
 *   <li>{@code techDebtServiceInjected}：TechDebtService 装配</li>
 * </ul>
 */
@SpringBootTest
class EaApplicationContextTest {

    @Autowired
    ApplicationContext applicationContext;

    @Autowired
    ApplicationTechComponentService applicationTechComponentService;

    @Autowired
    ApplicationTechComponentRepository applicationTechComponentRepository;

    @Autowired
    ApplicationRepository applicationRepository;

    @Autowired
    TechnologyComponentRepository technologyComponentRepository;

    @Autowired
    ComplianceAssessmentService complianceAssessmentService;

    @Autowired
    LandscapeViewService landscapeViewService;

    @Autowired
    ImpactAnalysisService impactAnalysisService;

    @Autowired
    TechDebtService techDebtService;

    @Autowired
    ObjectMapper objectMapper;

    @Autowired
    BusinessCapabilityRepository businessCapabilityRepository;

    @Autowired
    TechnologyStackRepository technologyStackRepository;

    @Autowired
    InfrastructureRepository infrastructureRepository;

    @Autowired
    CapabilityConceptMappingRepository capabilityConceptMappingRepository;

    @Autowired
    BusinessProcessRepository businessProcessRepository;

    @Autowired
    ConceptMappingRuleService conceptMappingRuleService;

    @Autowired
    CapabilityMapService capabilityMapService;

    @Autowired
    CapabilityMapRepository capabilityMapRepository;

    @Autowired
    CapabilityMapVersionRepository capabilityMapVersionRepository;

    @Autowired
    ArchitectureHealthService architectureHealthService;

    @Autowired
    HealthScoreRepository healthScoreRepository;

    @Test
    void contextLoads() {
        assertThat(applicationContext).isNotNull();
        assertThat(applicationContext.containsBean("applicationTechComponentService")).isTrue();
        assertThat(applicationContext.containsBean("complianceAssessmentService")).isTrue();
        assertThat(applicationContext.containsBean("landscapeViewService")).isTrue();
        assertThat(applicationContext.containsBean("impactAnalysisService")).isTrue();
        assertThat(applicationContext.containsBean("techDebtService")).isTrue();
        assertThat(applicationContext.containsBean("ontWebClient")).isTrue();
        assertThat(applicationContext.containsBean("capabilityMapService")).isTrue();
        assertThat(applicationContext.containsBean("architectureHealthService")).isTrue();
    }

    /**
     * 验证 ApplicationTechComponentService 及其 3 个 Repository 依赖已装配。
     *
     * <p>该服务替代 ApplicationEntity.techStack JSON 字符串匹配，
     * 用于影响分析与合规性评估的精确图遍历。
     */
    @Test
    void applicationTechComponentServiceInjected() {
        assertThat(applicationTechComponentService).isNotNull();
        Object linkRepo = ReflectionTestUtils.getField(
                applicationTechComponentService, "linkRepository");
        assertThat(linkRepo).as("linkRepository 应已注入").isNotNull();
        assertThat(linkRepo).isSameAs(applicationTechComponentRepository);

        Object appRepo = ReflectionTestUtils.getField(
                applicationTechComponentService, "applicationRepository");
        assertThat(appRepo).as("applicationRepository 应已注入").isNotNull();
        assertThat(appRepo).isSameAs(applicationRepository);

        Object compRepo = ReflectionTestUtils.getField(
                applicationTechComponentService, "techComponentRepository");
        assertThat(compRepo).as("techComponentRepository 应已注入").isNotNull();
        assertThat(compRepo).isSameAs(technologyComponentRepository);
    }

    /**
     * 验证 ComplianceAssessmentService 已装配（架构合规性自动评估）。
     */
    @Test
    void complianceAssessmentServiceInjected() {
        assertThat(complianceAssessmentService).isNotNull();
        Object linkService = ReflectionTestUtils.getField(
                complianceAssessmentService, "linkService");
        assertThat(linkService).as("ComplianceAssessmentService.linkService 应已注入").isNotNull();
        assertThat(linkService).isSameAs(applicationTechComponentService);
    }

    /**
     * 验证 LandscapeViewService 及其 7 个依赖 Bean 已装配。
     *
     * <p>聚合 BusinessCapability → Application → TechStack/TechComponent → Infrastructure 四层节点。
     */
    @Test
    void landscapeViewServiceInjected() {
        assertThat(landscapeViewService).isNotNull();
        assertThat(ReflectionTestUtils.getField(landscapeViewService, "capabilityRepository"))
                .as("capabilityRepository 应已注入").isSameAs(businessCapabilityRepository);
        assertThat(ReflectionTestUtils.getField(landscapeViewService, "applicationRepository"))
                .as("applicationRepository 应已注入").isSameAs(applicationRepository);
        assertThat(ReflectionTestUtils.getField(landscapeViewService, "techStackRepository"))
                .as("techStackRepository 应已注入").isSameAs(technologyStackRepository);
        assertThat(ReflectionTestUtils.getField(landscapeViewService, "techComponentRepository"))
                .as("techComponentRepository 应已注入").isSameAs(technologyComponentRepository);
        assertThat(ReflectionTestUtils.getField(landscapeViewService, "infrastructureRepository"))
                .as("infrastructureRepository 应已注入").isSameAs(infrastructureRepository);
        assertThat(ReflectionTestUtils.getField(landscapeViewService, "appTechLinkRepository"))
                .as("appTechLinkRepository 应已注入").isSameAs(applicationTechComponentRepository);
        assertThat(ReflectionTestUtils.getField(landscapeViewService, "objectMapper"))
                .as("objectMapper 应已注入").isSameAs(objectMapper);
    }

    /**
     * 验证 ImpactAnalysisService 已装配（能力影响分析）。
     */
    @Test
    void impactAnalysisServiceInjected() {
        assertThat(impactAnalysisService).isNotNull();
        assertThat(ReflectionTestUtils.getField(impactAnalysisService, "capabilityRepository"))
                .as("capabilityRepository 应已注入").isSameAs(businessCapabilityRepository);
        assertThat(ReflectionTestUtils.getField(impactAnalysisService, "mappingRepository"))
                .as("mappingRepository 应已注入").isSameAs(capabilityConceptMappingRepository);
        assertThat(ReflectionTestUtils.getField(impactAnalysisService, "applicationRepository"))
                .as("applicationRepository 应已注入").isSameAs(applicationRepository);
        assertThat(ReflectionTestUtils.getField(impactAnalysisService, "processRepository"))
                .as("processRepository 应已注入").isSameAs(businessProcessRepository);
        assertThat(ReflectionTestUtils.getField(impactAnalysisService, "objectMapper"))
                .as("objectMapper 应已注入").isSameAs(objectMapper);
    }

    /**
     * 验证 TechDebtService 已装配（技术债管理）。
     */
    @Test
    void techDebtServiceInjected() {
        assertThat(techDebtService).isNotNull();
        assertThat(ReflectionTestUtils.getField(techDebtService, "applicationRepository"))
                .as("applicationRepository 应已注入").isSameAs(applicationRepository);
        assertThat(ReflectionTestUtils.getField(techDebtService, "conceptMappingRuleService"))
                .as("conceptMappingRuleService 应已注入").isSameAs(conceptMappingRuleService);
        assertThat(ReflectionTestUtils.getField(techDebtService, "objectMapper"))
                .as("objectMapper 应已注入").isSameAs(objectMapper);
    }

    /**
     * 验证 CapabilityMapService 已装配（能力地图容器层 P0-2A）。
     */
    @Test
    void capabilityMapServiceInjected() {
        assertThat(capabilityMapService).isNotNull();
        assertThat(ReflectionTestUtils.getField(capabilityMapService, "mapRepository"))
                .as("mapRepository 应已注入").isSameAs(capabilityMapRepository);
        assertThat(ReflectionTestUtils.getField(capabilityMapService, "versionRepository"))
                .as("versionRepository 应已注入").isSameAs(capabilityMapVersionRepository);
        assertThat(ReflectionTestUtils.getField(capabilityMapService, "capabilityRepository"))
                .as("capabilityRepository 应已注入").isSameAs(businessCapabilityRepository);
        assertThat(ReflectionTestUtils.getField(capabilityMapService, "objectMapper"))
                .as("objectMapper 应已注入").isSameAs(objectMapper);
    }

    /**
     * 验证 ArchitectureHealthService 已装配（架构健康度仪表盘 P0-2B）。
     */
    @Test
    void architectureHealthServiceInjected() {
        assertThat(architectureHealthService).isNotNull();
        assertThat(ReflectionTestUtils.getField(architectureHealthService, "healthScoreRepository"))
                .as("healthScoreRepository 应已注入").isSameAs(healthScoreRepository);
        assertThat(ReflectionTestUtils.getField(architectureHealthService, "capabilityMapRepository"))
                .as("capabilityMapRepository 应已注入").isSameAs(capabilityMapRepository);
        assertThat(ReflectionTestUtils.getField(architectureHealthService, "applicationRepository"))
                .as("applicationRepository 应已注入").isSameAs(applicationRepository);
        assertThat(ReflectionTestUtils.getField(architectureHealthService, "objectMapper"))
                .as("objectMapper 应已注入").isSameAs(objectMapper);
    }
}
