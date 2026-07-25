// GENERATED. DO NOT EDIT. Source: screen-registry.source.json + screen-alias-resolution.source.json
import type { ScreenRegistration } from '../screen-registration';
export const settingsRegistrations = [
  {
    screenKey: "accessibilitySettings",
    "section7Alias": "S62",
    "label": "Barrierefreiheit",
    "kind": "screen",
    "group": "settings",
    "ownerPhase": "40",
    "testId": "E2E-S62-A11Y",
    "paramSchemaId": "params.none",
    "backPolicyId": "previousPreserveView",
    "requiredCapabilities": [
      "localization",
      "designSystem",
      "settingsStore"
    ],
    "screenshotProfileId": "settings.default",
    "loaderId": "screen.accessibilitySettings",
    numericAlias: null,
    "aliasStatus": "blocked"
  },
  {
    screenKey: "audioSettings",
    "section7Alias": "S60",
    "label": "Audio",
    "kind": "screen",
    "group": "settings",
    "ownerPhase": "39",
    "testId": "E2E-S60-AUDIO",
    "paramSchemaId": "params.none",
    "backPolicyId": "previousPreserveView",
    "requiredCapabilities": [
      "localization",
      "designSystem",
      "settingsStore"
    ],
    "screenshotProfileId": "settings.default",
    "loaderId": "screen.audioSettings",
    numericAlias: null,
    "aliasStatus": "blocked"
  },
  {
    screenKey: "controlsSettings",
    "section7Alias": "S63",
    "label": "Steuerung",
    "kind": "screen",
    "group": "settings",
    "ownerPhase": "40",
    "testId": "E2E-S63-CONTROLS",
    "paramSchemaId": "params.none",
    "backPolicyId": "previousPreserveView",
    "requiredCapabilities": [
      "localization",
      "designSystem",
      "settingsStore"
    ],
    "screenshotProfileId": "settings.default",
    "loaderId": "screen.controlsSettings",
    numericAlias: null,
    "aliasStatus": "blocked"
  },
  {
    screenKey: "graphicsSettings",
    "section7Alias": "S61",
    "label": "Grafik",
    "kind": "screen",
    "group": "settings",
    "ownerPhase": "41",
    "testId": "E2E-S61-GRAPHICS",
    "paramSchemaId": "params.none",
    "backPolicyId": "previousPreserveView",
    "requiredCapabilities": [
      "localization",
      "designSystem",
      "settingsStore"
    ],
    "screenshotProfileId": "settings.default",
    "loaderId": "screen.graphicsSettings",
    numericAlias: null,
    "aliasStatus": "blocked"
  },
  {
    screenKey: "languageSettings",
    "section7Alias": "S65",
    "label": "Sprache",
    "kind": "screen",
    "group": "settings",
    "ownerPhase": "06",
    "testId": "E2E-S65-LANGUAGE",
    "paramSchemaId": "params.none",
    "backPolicyId": "previousPreserveView",
    "requiredCapabilities": [
      "localization",
      "designSystem",
      "settingsStore"
    ],
    "screenshotProfileId": "settings.default",
    "loaderId": "screen.languageSettings",
    numericAlias: null,
    "aliasStatus": "blocked"
  },
  {
    screenKey: "saveManagement",
    "section7Alias": "S64",
    "label": "Save-Verwaltung",
    "kind": "screen",
    "group": "settings",
    "ownerPhase": "24",
    "testId": "E2E-S64-SAVE",
    "paramSchemaId": "params.none",
    "backPolicyId": "previousPreserveView",
    "requiredCapabilities": [
      "localization",
      "designSystem"
    ],
    "screenshotProfileId": "settings.default",
    "loaderId": "screen.saveManagement",
    numericAlias: null,
    "aliasStatus": "blocked"
  }
] as const satisfies readonly ScreenRegistration[];
