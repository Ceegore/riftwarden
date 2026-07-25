// GENERATED. DO NOT EDIT. Source: screen-registry.source.json + screen-alias-resolution.source.json
import type { ScreenRegistration } from '../screen-registration';
export const overlaysRegistrations = [
  {
    screenKey: "comparison",
    "section7Alias": "O03",
    "label": "Vergleich",
    "kind": "overlay",
    "group": "overlays",
    "ownerPhase": "07/31",
    "testId": "E2E-O03-COMPARE",
    "paramSchemaId": "overlay.comparison",
    "backPolicyId": "overlayPriority",
    "requiredCapabilities": [
      "localization",
      "designSystem"
    ],
    "screenshotProfileId": "overlays.default",
    "loaderId": "screen.comparison",
    numericAlias: null,
    "aliasStatus": "blocked"
  },
  {
    screenKey: "confirmation",
    "section7Alias": "O01",
    "label": "Bestätigung",
    "kind": "overlay",
    "group": "overlays",
    "ownerPhase": "07/08",
    "testId": "E2E-O01-CONFIRM",
    "paramSchemaId": "overlay.confirmation",
    "backPolicyId": "overlayPriority",
    "requiredCapabilities": [
      "localization",
      "designSystem"
    ],
    "screenshotProfileId": "overlays.default",
    "loaderId": "screen.confirmation",
    numericAlias: null,
    "aliasStatus": "blocked"
  },
  {
    screenKey: "loading",
    "section7Alias": "O06",
    "label": "Loading",
    "kind": "overlay",
    "group": "overlays",
    "ownerPhase": "05/07",
    "testId": "E2E-O06-LOADING",
    "paramSchemaId": "overlay.loading",
    "backPolicyId": "overlayPriority",
    "requiredCapabilities": [
      "localization",
      "designSystem"
    ],
    "screenshotProfileId": "overlays.default",
    "loaderId": "screen.loading",
    numericAlias: null,
    "aliasStatus": "blocked"
  },
  {
    screenKey: "toast",
    "section7Alias": "O05",
    "label": "Toast",
    "kind": "overlay",
    "group": "overlays",
    "ownerPhase": "07/08",
    "testId": "E2E-O05-TOAST",
    "paramSchemaId": "overlay.toast",
    "backPolicyId": "overlayPriority",
    "requiredCapabilities": [
      "localization",
      "designSystem"
    ],
    "screenshotProfileId": "overlays.default",
    "loaderId": "screen.toast",
    numericAlias: null,
    "aliasStatus": "blocked"
  },
  {
    screenKey: "tooltipGlossary",
    "section7Alias": "O02",
    "label": "Tooltip/Glossar",
    "kind": "overlay",
    "group": "overlays",
    "ownerPhase": "07/08",
    "testId": "E2E-O02-TOOLTIP",
    "paramSchemaId": "overlay.tooltipGlossary",
    "backPolicyId": "overlayPriority",
    "requiredCapabilities": [
      "localization",
      "designSystem"
    ],
    "screenshotProfileId": "overlays.default",
    "loaderId": "screen.tooltipGlossary",
    numericAlias: null,
    "aliasStatus": "blocked"
  },
  {
    screenKey: "unlock",
    "section7Alias": "O04",
    "label": "Unlock",
    "kind": "overlay",
    "group": "overlays",
    "ownerPhase": "07/30",
    "testId": "E2E-O04-UNLOCK",
    "paramSchemaId": "overlay.unlock",
    "backPolicyId": "overlayPriority",
    "requiredCapabilities": [
      "localization",
      "designSystem"
    ],
    "screenshotProfileId": "overlays.default",
    "loaderId": "screen.unlock",
    numericAlias: null,
    "aliasStatus": "blocked"
  },
  {
    screenKey: "unsavedChanges",
    "section7Alias": "O07",
    "label": "Unsaved Changes",
    "kind": "overlay",
    "group": "overlays",
    "ownerPhase": "08/27",
    "testId": "E2E-O07-UNSAVED",
    "paramSchemaId": "overlay.unsavedChanges",
    "backPolicyId": "overlayPriority",
    "requiredCapabilities": [
      "localization",
      "designSystem"
    ],
    "screenshotProfileId": "overlays.default",
    "loaderId": "screen.unsavedChanges",
    numericAlias: null,
    "aliasStatus": "blocked"
  }
] as const satisfies readonly ScreenRegistration[];
