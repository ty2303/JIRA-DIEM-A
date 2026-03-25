/**
 * Common shared types used across features.
 */

/** Standard pagination params for API requests (Spring Boot uses 0-indexed pages) */
export interface PaginationParams {
  page: number;
  size: number;
}

/** Generic ID type — MongoDB uses string ObjectIds */
export type EntityId = string;

/** Base entity with common fields */
export interface BaseEntity {
  id: EntityId;
  createdAt: string;
  updatedAt: string;
}
