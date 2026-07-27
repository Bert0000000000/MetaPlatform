package com.metaplatform.llmgw.chat.service;

import com.metaplatform.llmgw.chat.dto.ChatMessage;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.content.Media;
import org.springframework.stereotype.Component;
import org.springframework.util.MimeTypeUtils;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Component
public class ChatMessageConverter {

    public Message toSpringAiMessage(ChatMessage message) {
        String role = message.role() == null ? "user" : message.role().toLowerCase();
        String content = message.content() == null ? "" : message.content();
        return switch (role) {
            case "system" -> new SystemMessage(content);
            case "assistant" -> new AssistantMessage(content);
            case "user" -> buildUserMessage(message, content);
            default -> buildUserMessage(message, content);
        };
    }

    public List<Message> toSpringAiMessages(List<ChatMessage> messages) {
        return messages.stream().map(this::toSpringAiMessage).toList();
    }

    private UserMessage buildUserMessage(ChatMessage message, String content) {
        List<Media> mediaList = extractMedia(message.multimodalContent());
        if (mediaList.isEmpty()) {
            return new UserMessage(content);
        }
        return UserMessage.builder()
            .text(content)
            .media(mediaList)
            .build();
    }

    private List<Media> extractMedia(List<Map<String, Object>> multimodalContent) {
        List<Media> mediaList = new ArrayList<>();
        if (multimodalContent == null || multimodalContent.isEmpty()) {
            return mediaList;
        }
        for (Map<String, Object> item : multimodalContent) {
            if (item == null) {
                continue;
            }
            String type = String.valueOf(item.getOrDefault("type", ""));
            if ("image_url".equals(type) || "image".equals(type)) {
                Object imageUrlObj = item.get("image_url");
                String imageUrl = null;
                if (imageUrlObj instanceof Map<?, ?> imageUrlMap) {
                    Object urlObj = imageUrlMap.get("url");
                    if (urlObj != null) {
                        imageUrl = urlObj.toString();
                    }
                } else if (imageUrlObj != null) {
                    imageUrl = imageUrlObj.toString();
                }
                if (imageUrl != null && !imageUrl.isBlank()) {
                    try {
                        mediaList.add(new Media(MimeTypeUtils.IMAGE_JPEG, new URI(imageUrl)));
                    } catch (URISyntaxException ignored) {
                    }
                }
            }
        }
        return mediaList;
    }
}
