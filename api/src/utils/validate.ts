import { AppError } from "./AppError.js";

export interface ValidationError {
  field: string;
  message: string;
}

export function validate(errors: ValidationError[]): void {
  if (errors.length > 0) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      statusCode: 400,
      details: errors,
    });
  }
}
