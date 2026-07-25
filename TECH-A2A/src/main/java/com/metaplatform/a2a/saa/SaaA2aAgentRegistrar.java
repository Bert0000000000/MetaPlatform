package com.metaplatform.a2a.saa;

import com.alibaba.cloud.ai.a2a.core.registry.AgentRegistry;
import com.alibaba.cloud.ai.a2a.registry.nacos.properties.NacosA2aProperties;
import com.metaplatform.a2a.entity.AgentCardEntity;
import com.metaplatform.a2a.event.AgentCardChangedEvent;
import com.metaplatform.a2a.repository.AgentCardRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.context.annotation.Profile;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.util.List;

@Slf4j
@Component
@Profile("!dev")
@ConditionalOnBean({NacosA2aProperties.class, AgentRegistry.class})
@RequiredArgsConstructor
public class SaaA2aAgentRegistrar {

    private final AgentCardRepository agentCardRepository;
    private final NacosA2aProperties a2aNacosProperties;
    private final AgentRegistry agentRegistry;
    private final AgentCardConverter agentCardConverter;

    @PostConstruct
    public void registerAllAgents() {
        List<AgentCardEntity> cards = agentCardRepository.findByStatus("PUBLISHED");
        for (AgentCardEntity card : cards) {
            registerToNacos(card);
        }
    }

    public void registerToNacos(AgentCardEntity card) {
        agentRegistry.register(agentCardConverter.toSaaAgentCard(card));
        log.info("AgentCard 已同步到 SAA A2A Nacos Registry | cardId={} | name={} | namespace={}",
                card.getId(), card.getName(), a2aNacosProperties.getNamespace());
    }

    public void syncToNacos(AgentCardEntity card) {
        registerToNacos(card);
    }

    @EventListener
    public void onAgentCardChanged(AgentCardChangedEvent event) {
        if (event.type() == AgentCardChangedEvent.ChangeType.DELETED
                || !"PUBLISHED".equals(event.card().getStatus())) {
            log.info("SAA 1.1.2 AgentRegistry 暂无注销 API，跳过非发布 Card 注册 | cardId={} | changeType={}",
                    event.card().getId(), event.type());
            return;
        }
        syncToNacos(event.card());
    }
}
