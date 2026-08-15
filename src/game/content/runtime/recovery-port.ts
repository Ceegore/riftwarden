export interface ContentRecoveryFailure {
  readonly code: string;
  readonly messageKey: string;
  readonly diagnostics: readonly { code: string; sourcePath?: string; entityId?: string }[];
}

export interface ContentRecoveryPort {
  enterContentRecovery(failure: ContentRecoveryFailure): Promise<void> | void;
}

export const CONTENT_RECOVERY_MESSAGE_KEY = "ui.recovery.content_invalid";
