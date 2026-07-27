package com.metaplatform.iam.dto.user;

import lombok.Data;

import java.util.List;

@Data
public class BatchImportUsersRequest {

    private List<RegisterEntry> users;
    private String csvData;

    @Data
    public static class RegisterEntry {
        private String username;
        private String email;
        private String password;
        private String realName;
        private String phone;
        private String departmentId;
        private String positionId;
    }
}