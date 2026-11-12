export type DocumentSearchItem = {
  document_id: number;
  title: string;
  highlighted_title: string | null;
  heading: string | null;
  snippets: string[];
  score: number | null;
  publish_time: string | null;
};

export type DocumentSearchResponse = {
  query: string;
  items: DocumentSearchItem[];
  page: number;
  size: number;
  total: number;
  pages: number;
  took_ms: number;
};
