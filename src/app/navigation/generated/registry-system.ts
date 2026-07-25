// GENERATED. DO NOT EDIT. Source: screen-registry.source.json + screen-alias-resolution.source.json
import type { ScreenRegistration } from '../screen-registration';
export const systemRegistrations = [
  {
    screenKey: "bootstrapRecovery",
    "section7Alias": "S01",
    "label": "Bootstrap/Recovery",
    "kind": "screen",
    "group": "system",
    "ownerPhase": "05/24",
    "testId": "E2E-S01-RECOVERY",
    "paramSchemaId": "params.none",
    "backPolicyId": "systemOwned",
    "requiredCapabilities": [
      "localization",
      "designSystem",
      "bootRecovery"
    ],
    "screenshotProfileId": "system.default",
    "loaderId": "screen.bootstrapRecovery",
    numericAlias: null,
    "aliasStatus": "blocked"
  },
  {
    screenKey: "continueCard",
    "section7Alias": "S05",
    "label": "Lade-/Fortsetzenkarte",
    "kind": "screen",
    "group": "system",
    "ownerPhase": "05/24",
    "testId": "E2E-S05-CONTINUE",
    "paramSchemaId": "params.none",
    "backPolicyId": "safePrevious",
    "requiredCapabilities": [
      "localization",
      "designSystem",
      "bootRecovery"
    ],
    "screenshotProfileId": "system.default",
    "loaderId": "screen.continueCard",
    numericAlias: null,
    "aliasStatus": "blocked"
  },
  {
    screenKey: "fatalError",
    "section7Alias": "S09",
    "label": "Fataler Fehler",
    "kind": "screen",
    "group": "system",
    "ownerPhase": "05/24",
    "testId": "E2E-S09-FATAL",
    "paramSchemaId": "params.none",
    "backPolicyId": "systemOwned",
    "requiredCapabilities": [
      "localization",
      "designSystem",
      "bootRecovery"
    ],
    "screenshotProfileId": "system.default",
    "loaderId": "screen.fatalError",
    numericAlias: null,
    "aliasStatus": "blocked"
  },
  {
    screenKey: "firstRun",
    "section7Alias": "S02",
    "label": "Erststart",
    "kind": "screen",
    "group": "system",
    "ownerPhase": "06/40",
    "testId": "E2E-S02-FIRST-RUN",
    "paramSchemaId": "params.none",
    "backPolicyId": "safePrevious",
    "requiredCapabilities": [
      "localization",
      "designSystem"
    ],
    "screenshotProfileId": "system.default",
    "loaderId": "screen.firstRun",
    numericAlias: null,
    "aliasStatus": "blocked"
  },
  {
    screenKey: "globalHelp",
    "section7Alias": "S08",
    "label": "Globale Hilfe",
    "kind": "screen",
    "group": "system",
    "ownerPhase": "30/33",
    "testId": "E2E-S08-HELP",
    "paramSchemaId": "params.none",
    "backPolicyId": "safePrevious",
    "requiredCapabilities": [
      "localization",
      "designSystem"
    ],
    "screenshotProfileId": "system.default",
    "loaderId": "screen.globalHelp",
    numericAlias: null,
    "aliasStatus": "blocked"
  },
  {
    screenKey: "legalAbout",
    "section7Alias": "S07",
    "label": "Rechtliches/About",
    "kind": "screen",
    "group": "system",
    "ownerPhase": "30/42/45",
    "testId": "E2E-S07-LEGAL",
    "paramSchemaId": "params.none",
    "backPolicyId": "safePrevious",
    "requiredCapabilities": [
      "localization",
      "designSystem"
    ],
    "screenshotProfileId": "system.default",
    "loaderId": "screen.legalAbout",
    numericAlias: null,
    "aliasStatus": "blocked"
  },
  {
    screenKey: "nativeSplash",
    "section7Alias": "S00",
    "label": "Native Splash",
    "kind": "screen",
    "group": "system",
    "ownerPhase": "04/05",
    "testId": "E2E-S00-BOOT",
    "paramSchemaId": "params.none",
    "backPolicyId": "systemOwned",
    "requiredCapabilities": [
      "localization",
      "designSystem",
      "bootRecovery"
    ],
    "screenshotProfileId": "system.default",
    "loaderId": "screen.nativeSplash",
    numericAlias: null,
    "aliasStatus": "blocked"
  },
  {
    screenKey: "newGame",
    "section7Alias": "S04",
    "label": "Neues Spiel",
    "kind": "screen",
    "group": "system",
    "ownerPhase": "30/33",
    "testId": "E2E-S04-NEW-GAME",
    "paramSchemaId": "params.none",
    "backPolicyId": "safePrevious",
    "requiredCapabilities": [
      "localization",
      "designSystem"
    ],
    "screenshotProfileId": "system.default",
    "loaderId": "screen.newGame",
    numericAlias: null,
    "aliasStatus": "blocked"
  },
  {
    screenKey: "settingsHub",
    "section7Alias": "S06",
    "label": "Einstellungen-Hub",
    "kind": "screen",
    "group": "system",
    "ownerPhase": "30",
    "testId": "E2E-S06-SETTINGS",
    "paramSchemaId": "params.none",
    "backPolicyId": "safePrevious",
    "requiredCapabilities": [
      "localization",
      "designSystem"
    ],
    "screenshotProfileId": "system.default",
    "loaderId": "screen.settingsHub",
    numericAlias: null,
    "aliasStatus": "blocked"
  },
  {
    screenKey: "title",
    "section7Alias": "S03",
    "label": "Titel",
    "kind": "screen",
    "group": "system",
    "ownerPhase": "30",
    "testId": "E2E-S03-TITLE",
    "paramSchemaId": "params.none",
    "backPolicyId": "doubleBackExitAndroid",
    "requiredCapabilities": [
      "localization",
      "designSystem"
    ],
    "screenshotProfileId": "system.default",
    "loaderId": "screen.title",
    numericAlias: null,
    "aliasStatus": "blocked"
  }
] as const satisfies readonly ScreenRegistration[];
