/**
 * Shared API request/response types.
 * Feature-specific types go in src/features/<name>/types/
 */

export interface ApiResponse<T> {
  data: T;
  message?: string;
  status: number;
}

export interface ApiError {
  message: string;
  status: number;
  errors?: Record<string, string[]>;
}

/**
 * Matches Spring Boot's Page<T> serialization format.
 * Fields: content, number (0-indexed), size, totalPages, totalElements.
 */
export interface PaginatedResponse<T> {
  content: T[];
  number: number;
  size: number;
  totalPages: number;
  totalElements: number;
}
