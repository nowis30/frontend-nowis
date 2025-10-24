import { apiClient } from './client';

export interface AttachmentDto {
  id: number;
  propertyId: number;
  mortgageId: number | null;
  title: string;
  filename: string;
  contentType: string;
  size: number;
  checksum: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function fetchAttachments(
  propertyId: number,
  options: { mortgageId?: number } = {}
): Promise<AttachmentDto[]> {
  const params = new URLSearchParams();
  if (options.mortgageId) {
    params.set('mortgageId', String(options.mortgageId));
  }

  const query = params.toString();
  const endpoint = query
    ? `/properties/${propertyId}/attachments?${query}`
    : `/properties/${propertyId}/attachments`;

  const { data } = await apiClient.get<AttachmentDto[]>(endpoint);
  return data;
}

export async function uploadAttachment(
  propertyId: number,
  payload: { file: File; title?: string; mortgageId?: number }
): Promise<AttachmentDto> {
  const formData = new FormData();
  formData.append('file', payload.file);
  if (payload.title) {
    formData.append('title', payload.title);
  }
  if (payload.mortgageId) {
    formData.append('mortgageId', String(payload.mortgageId));
  }

  const { data } = await apiClient.post<AttachmentDto>(
    `/properties/${propertyId}/attachments`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' }
    }
  );

  return data;
}

export async function deleteAttachment(
  propertyId: number,
  attachmentId: number
): Promise<void> {
  await apiClient.delete(`/properties/${propertyId}/attachments/${attachmentId}`);
}

export async function downloadAttachment(
  propertyId: number,
  attachmentId: number
): Promise<Blob> {
  const response = await apiClient.get(`/properties/${propertyId}/attachments/${attachmentId}/download`, {
    responseType: 'blob'
  });

  return response.data as Blob;
}
