export interface PageRequest {
  page: number
  limit: number
}

export interface Page<T> {
  data: T[]
  meta: PageRequest & { total: number }
}
