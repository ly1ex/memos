export interface ApiSuccess<T> {
  data: T;
}

export function ok<T>(data: T): ApiSuccess<T> {
  return { data };
}

