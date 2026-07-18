import { post, get, del } from './client';
import type { DocumentItem } from '@/types';

function detectFileType(filename: string): DocumentItem['fileType'] {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'doc' || ext === 'docx') return 'word';
  if (ext === 'txt') return 'txt';
  if (ext === 'md') return 'md';
  return 'other';
}

export async function uploadDocument(
  employeeId: string,
  file: File,
): Promise<DocumentItem> {
  const fileType = detectFileType(file.name);
  const maxSize = 50 * 1024 * 1024;

  if (file.size > maxSize) {
    throw new Error('文件大小不能超过 50MB');
  }

  const allowedTypes = ['pdf', 'word', 'txt', 'md'];
  if (!allowedTypes.includes(fileType)) {
    throw new Error('仅支持 PDF、Word、TXT、Markdown 文件');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('employeeId', employeeId);
  return post<DocumentItem>('/v1/rag/documents/upload', formData);
}

export async function listDocuments(employeeId: string): Promise<DocumentItem[]> {
  return get<DocumentItem[]>('/v1/rag/documents', { employeeId });
}

export async function deleteDocument(docId: string): Promise<void> {
  return del<void>(`/v1/rag/documents/${docId}`);
}

export async function getDocument(docId: string): Promise<DocumentItem> {
  return get<DocumentItem>(`/v1/rag/documents/${docId}`);
}
