export class ApiError extends Error {
  constructor(
    public readonly status: number,
    detail: string,
    public readonly rule?: string,
  ) {
    super(detail);
  }
}

export const notFound = (what: string) => new ApiError(404, `${what} not found.`);
