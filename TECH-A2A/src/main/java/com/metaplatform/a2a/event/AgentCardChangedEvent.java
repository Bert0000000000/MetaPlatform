package com.metaplatform.a2a.event;

import com.metaplatform.a2a.entity.AgentCardEntity;

public record AgentCardChangedEvent(AgentCardEntity card, ChangeType type) {

    public enum ChangeType {
        CREATED,
        UPDATED,
        DELETED
    }
}
