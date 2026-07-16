package com.metaplatform.process.infrastructure.consumer;

import java.util.Map;

public class ObjectEvent {
    private String objectType;
    private String eventType;
    private String objectId;
    private String actorId;
    private Map<String, Object> data;

    public ObjectEvent() {}

    public String getObjectType() { return objectType; }
    public void setObjectType(String objectType) { this.objectType = objectType; }
    public String getEventType() { return eventType; }
    public void setEventType(String eventType) { this.eventType = eventType; }
    public String getObjectId() { return objectId; }
    public void setObjectId(String objectId) { this.objectId = objectId; }
    public String getActorId() { return actorId; }
    public void setActorId(String actorId) { this.actorId = actorId; }
    public Map<String, Object> getData() { return data; }
    public void setData(Map<String, Object> data) { this.data = data; }
}
