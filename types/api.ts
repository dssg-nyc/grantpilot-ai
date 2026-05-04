export interface ApiPagination {
  page: number;
  limit: number;
  total: number;
  has_more: boolean;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}
