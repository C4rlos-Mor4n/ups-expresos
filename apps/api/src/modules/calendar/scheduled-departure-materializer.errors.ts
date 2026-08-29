export type MaterializerInputErrorCode =
  | 'INVALID_SERVICE_LINE_ID'
  | 'INVALID_DIRECTION'
  | 'INVALID_FROM_DATE'
  | 'INVALID_TO_DATE'
  | 'INVALID_DATE_RANGE'
  | 'MATERIALIZATION_RANGE_TOO_LARGE';

export class MaterializerInputError extends Error {
  constructor(
    readonly code: MaterializerInputErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'MaterializerInputError';
  }
}

export class MaterializerInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MaterializerInvariantError';
  }
}

export class MaterializerInfrastructureError extends Error {
  override readonly cause: unknown;

  constructor(message: string, cause: unknown) {
    super(message);
    this.name = 'MaterializerInfrastructureError';
    this.cause = cause;
  }
}
