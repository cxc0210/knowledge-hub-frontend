export const DOCUMENT_STATUS = {
  PENDING_UPLOAD: 0,
  UPLOADED: 10,
  PARSING: 20,
  PARSE_FAILED: 21,
  DRAFT: 30,
  PENDING_REVIEW: 40,
  REJECTED: 41,
  INDEXING: 45,
  INDEX_FAILED: 46,
  PUBLISHED: 50,
  UNPUBLISHED: 51,
  ARCHIVED: 90,
} as const;

export type DocumentStatusValue =
  (typeof DOCUMENT_STATUS)[keyof typeof DOCUMENT_STATUS];

export type DocumentListItem = {
  id: number;
  title: string;
  content_id: string | null;
  object_key: string;
  file_name: string;
  content_type: string;
  file_size: number;
  etag: string | null;
  status: DocumentStatusValue;
  created_at: string;
  updated_at: string;
};

export type DocumentListResponse = {
  items: DocumentListItem[];
  page: number;
  size: number;
  total: number;
  pages: number;
};

export type DocumentUploadResponse = {
  document: DocumentListItem;
  upload_url: string;
  method: "PUT";
  headers: Record<string, string>;
  expires_in: number;
};

export type DocumentAuthor = {
  id: number;
  username: string;
  avatar_url: string | null;
};

export type DocumentDetailResponse = {
  document: DocumentListItem;
  author: DocumentAuthor;
  markdown: string;
};
