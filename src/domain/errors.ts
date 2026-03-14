import type { ErrorItem } from "./types.js";

export const InstallerErrorCodeValues = [
  "INVALID_INPUT",
  "WORKSPACE_ROOT_REQUIRED",
  "PLAN_NOT_FOUND",
  "PLAN_MISMATCH",
  "LOCK_ACQUISITION_FAILED",
  "SOURCE_RESOLUTION_FAILED",
  "FETCH_FAILED",
  "CANONICAL_MISSING",
  "INVALID_SKILL_FILE",
  "INVALID_SKILL_NAME",
  "INVALID_SKILL_DESCRIPTION",
  "TARGET_PATH_UNAVAILABLE",
  "TARGET_PARENT_MISSING",
  "TARGET_MISSING",
  "BROKEN_SYMLINK",
  "OUT_OF_SYNC_COPY",
  "SYMLINK_NOT_SUPPORTED",
  "COPY_NOT_SUPPORTED",
  "UNSUPPORTED_SCOPE",
  "AGENT_NOT_SUPPORTED",
  "VERIFY_FAILED",
  "MANIFEST_CORRUPTED",
  "UNKNOWN_ERROR",
] as const;

export type InstallerErrorCode = (typeof InstallerErrorCodeValues)[number];

export class InstallerError extends Error {
  readonly code: InstallerErrorCode;
  readonly retryable: boolean;
  readonly details?: Record<string, unknown>;

  constructor(
    code: InstallerErrorCode,
    message: string,
    options?: {
      retryable?: boolean;
      details?: Record<string, unknown>;
      cause?: unknown;
    },
  ) {
    super(message);
    this.name = "InstallerError";
    this.code = code;
    this.retryable = options?.retryable ?? false;
    this.details = options?.details;

    if (options?.cause !== undefined) {
      Object.defineProperty(this, "cause", {
        value: options.cause,
        enumerable: false,
        configurable: true,
      });
    }
  }

  toErrorItem(): ErrorItem {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      details: this.details,
    };
  }
}

export function isInstallerError(value: unknown): value is InstallerError {
  return value instanceof InstallerError;
}

export function ensureInstallerError(
  value: unknown,
  fallbackCode: InstallerErrorCode = "UNKNOWN_ERROR",
  fallbackMessage = "Unexpected installer error.",
): InstallerError {
  if (value instanceof InstallerError) {
    return value;
  }

  if (value instanceof Error) {
    return new InstallerError(fallbackCode, value.message || fallbackMessage, {
      cause: value,
    });
  }

  return new InstallerError(fallbackCode, fallbackMessage, {
    details: { value },
  });
}

export function toErrorItem(
  value: unknown,
  fallbackCode: InstallerErrorCode = "UNKNOWN_ERROR",
  fallbackMessage = "Unexpected installer error.",
): ErrorItem {
  return ensureInstallerError(value, fallbackCode, fallbackMessage).toErrorItem();
}
