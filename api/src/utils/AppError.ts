export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: object[];

  constructor(params: {
    code: string;
    message: string;
    statusCode: number;
    details?: object[];
  }) {
    super(params.message);
    this.code = params.code;
    this.statusCode = params.statusCode;
    this.details = params.details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
