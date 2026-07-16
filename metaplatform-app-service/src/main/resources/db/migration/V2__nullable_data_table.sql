-- v1.0.1 Sprint 1：对象允许先创建后添加字段，物理表延迟生成
ALTER TABLE app_objects ALTER COLUMN data_table_name DROP NOT NULL;
