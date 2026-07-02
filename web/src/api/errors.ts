export enum ApiErrorCode {
  Unauthenticated = "unauthenticated",
  PermissionDenied = "permission_denied",
  NotFound = "not_found",
  InvalidArgument = "bad_request",
  Unimplemented = "not_implemented",
  Internal = "internal",
}

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;

  constructor(message: string, code: ApiErrorCode = ApiErrorCode.Internal, status = 500) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

export function codeFromHttpError(status: number, code?: string): ApiErrorCode {
  if (status === 401 || code === ApiErrorCode.Unauthenticated) return ApiErrorCode.Unauthenticated;
  if (status === 403 || code === ApiErrorCode.PermissionDenied) return ApiErrorCode.PermissionDenied;
  if (status === 404 || code === ApiErrorCode.NotFound) return ApiErrorCode.NotFound;
  if (status === 400 || code === ApiErrorCode.InvalidArgument) return ApiErrorCode.InvalidArgument;
  if (status === 501 || code === ApiErrorCode.Unimplemented) return ApiErrorCode.Unimplemented;
  return ApiErrorCode.Internal;
}

export function isUnauthenticatedError(error: unknown): boolean {
  return error instanceof ApiError && error.code === ApiErrorCode.Unauthenticated;
}
