export interface DocumentRow {
  id: string;
  user_id: string;
  title: string;
  storage_path: string;
  num_pages: number;
  pages: string[];
  created_at: string;
}

export interface DocumentListItem {
  id: string;
  title: string;
  num_pages: number;
  created_at: string;
}

export interface ReadingProgress {
  document_id: string;
  user_id: string;
  current_page: number;
  current_word_index: number;
  wpm: number;
  updated_at: string;
}
