/**
 * V12-08: 实现已迁移到 @mate/shared，本文件仅做 re-export 以保持向后兼容。
 *
 * 注意：shared 版本的 formatDateTime 接受 DateTimeSettings（结构子集），
 * APP-DASHBOARD 现有的 UserSettings 因结构兼容可继续传入。
 */
export {
  formatDateTime,
  formatDate,
  formatTime,
  formatRelative,
} from '@mate/shared';
