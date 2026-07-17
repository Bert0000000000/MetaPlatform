import { post, get, del } from './client';
import type { DocumentItem } from '@/types';

const STORAGE_KEY = 'app_dw_documents';

function loadDocs(): DocumentItem[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as DocumentItem[];
  } catch {
    return [];
  }
}

function saveDocs(items: DocumentItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function now(): string {
  return new Date().toISOString();
}

function generateId(): string {
  return `doc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

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

  const doc: DocumentItem = {
    id: generateId(),
    employeeId,
    filename: file.name,
    fileType,
    fileSize: file.size,
    status: 'uploaded',
    uploadedAt: now(),
  };

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('employeeId', employeeId);
    const result = await post<DocumentItem>('/v1/rag/documents/upload', formData);
    saveDocs([...loadDocs(), result]);
    return result;
  } catch {
    const items = loadDocs();
    doc.status = 'ready';
    doc.processedAt = now();
    saveDocs([...items, doc]);
    return doc;
  }
}

export async function listDocuments(employeeId: string): Promise<DocumentItem[]> {
  try {
    return await get<DocumentItem[]>(`/v1/rag/documents`, { employeeId });
  } catch {
    return loadDocs().filter((d) => d.employeeId === employeeId);
  }
}

export async function deleteDocument(docId: string): Promise<void> {
  try {
    await del<void>(`/v1/rag/documents/${docId}`);
  } catch {
    const items = loadDocs().filter((d) => d.id !== docId);
    saveDocs(items);
  }
}

export async function getDocument(docId: string): Promise<DocumentItem> {
  try {
    return await get<DocumentItem>(`/v1/rag/documents/${docId}`);
  } catch {
    const doc = loadDocs().find((d) => d.id === docId);
    if (!doc) throw new Error('文档不存在');
    return doc;
  }
}
