import type { ContentRecoveryPort } from "./recovery-port";
import { CONTENT_RECOVERY_MESSAGE_KEY } from "./recovery-port";
import { ContentIndex } from "./content-index";
import type { ContentManifest } from "../types/content";

export interface VerifiedBundle {
  manifest: ContentManifest;
  entitiesByType: Map<string, Map<string, unknown>>;
}

export async function publishVerifiedContent(
  verifyBundle: () => Promise<VerifiedBundle>,
  recovery: ContentRecoveryPort,
): Promise<ContentIndex | null> {
  try {
    const candidate = await verifyBundle();
    return new ContentIndex(candidate.manifest, candidate.entitiesByType);
  } catch (error) {
    await recovery.enterContentRecovery({
      code: "P09_PARTIAL_BUNDLE",
      messageKey: CONTENT_RECOVERY_MESSAGE_KEY,
      diagnostics: [{ code: error instanceof Error ? error.message : "P09_PARTIAL_BUNDLE" }],
    });
    return null;
  }
}
