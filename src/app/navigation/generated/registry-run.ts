// GENERATED. DO NOT EDIT. Source: screen-registry.source.json + screen-alias-resolution.source.json
import type { ScreenRegistration } from '../screen-registration';
export const runRegistrations = [
  {
    screenKey: "anchorPoint",
    "section7Alias": "S49",
    "label": "Ankerpunkt",
    "kind": "screen",
    "group": "run",
    "ownerPhase": "28/32",
    "testId": "E2E-S49-ANCHOR",
    "paramSchemaId": "params.runContext",
    "backPolicyId": "safePrevious",
    "requiredCapabilities": [
      "localization",
      "designSystem",
      "runState"
    ],
    "screenshotProfileId": "run.default",
    "loaderId": "screen.anchorPoint",
    numericAlias: null,
    "aliasStatus": "blocked"
  },
  {
    screenKey: "battle",
    "section7Alias": "S51",
    "label": "Kampf",
    "kind": "screen",
    "group": "run",
    "ownerPhase": "25/26",
    "testId": "E2E-S51-BATTLE",
    "paramSchemaId": "params.runContext",
    "backPolicyId": "pauseAndOpenBattleMenu",
    "requiredCapabilities": [
      "localization",
      "designSystem",
      "runState",
      "battlePresentation"
    ],
    "screenshotProfileId": "run.default",
    "loaderId": "screen.battle",
    numericAlias: null,
    "aliasStatus": "blocked"
  },
  {
    screenKey: "battleInspector",
    "section7Alias": "S52",
    "label": "Kampf-Pause/Inspektor",
    "kind": "screen",
    "group": "run",
    "ownerPhase": "26",
    "testId": "E2E-S52-INSPECTOR",
    "paramSchemaId": "params.runContext",
    "backPolicyId": "previousPreserveView",
    "requiredCapabilities": [
      "localization",
      "designSystem",
      "runState",
      "battlePresentation"
    ],
    "screenshotProfileId": "run.default",
    "loaderId": "screen.battleInspector",
    numericAlias: null,
    "aliasStatus": "blocked"
  },
  {
    screenKey: "battleResult",
    "section7Alias": "S53",
    "label": "Kampfergebnis",
    "kind": "screen",
    "group": "run",
    "ownerPhase": "34",
    "testId": "E2E-S53-RESULT",
    "paramSchemaId": "params.runContext",
    "backPolicyId": "safePrevious",
    "requiredCapabilities": [
      "localization",
      "designSystem",
      "runState"
    ],
    "screenshotProfileId": "run.default",
    "loaderId": "screen.battleResult",
    numericAlias: null,
    "aliasStatus": "blocked"
  },
  {
    screenKey: "defeatRecovery",
    "section7Alias": "S56",
    "label": "Niederlage/Recovery",
    "kind": "screen",
    "group": "run",
    "ownerPhase": "34",
    "testId": "E2E-S56-DEFEAT",
    "paramSchemaId": "params.runContext",
    "backPolicyId": "safePrevious",
    "requiredCapabilities": [
      "localization",
      "designSystem",
      "runState"
    ],
    "screenshotProfileId": "run.default",
    "loaderId": "screen.defeatRecovery",
    numericAlias: null,
    "aliasStatus": "blocked"
  },
  {
    screenKey: "dungeonMap",
    "section7Alias": "S40",
    "label": "Dungeonkarte",
    "kind": "screen",
    "group": "run",
    "ownerPhase": "28/32",
    "testId": "E2E-S40-DUNGEON",
    "paramSchemaId": "params.runContext",
    "backPolicyId": "openExpeditionMenu",
    "requiredCapabilities": [
      "localization",
      "designSystem",
      "runState"
    ],
    "screenshotProfileId": "run.default",
    "loaderId": "screen.dungeonMap",
    numericAlias: null,
    "aliasStatus": "blocked"
  },
  {
    screenKey: "dungeonWorkshop",
    "section7Alias": "S46",
    "label": "Dungeon-Werkstatt",
    "kind": "screen",
    "group": "run",
    "ownerPhase": "32",
    "testId": "E2E-S46-DUNGEON-WORKSHOP",
    "paramSchemaId": "params.runContext",
    "backPolicyId": "safePrevious",
    "requiredCapabilities": [
      "localization",
      "designSystem",
      "runState"
    ],
    "screenshotProfileId": "run.default",
    "loaderId": "screen.dungeonWorkshop",
    numericAlias: null,
    "aliasStatus": "blocked"
  },
  {
    screenKey: "endlessCheckpoint",
    "section7Alias": "S57",
    "label": "Endless-Checkpoint",
    "kind": "screen",
    "group": "run",
    "ownerPhase": "36",
    "testId": "E2E-S57-CHECKPOINT",
    "paramSchemaId": "params.runContext",
    "backPolicyId": "safePrevious",
    "requiredCapabilities": [
      "localization",
      "designSystem",
      "runState"
    ],
    "screenshotProfileId": "run.default",
    "loaderId": "screen.endlessCheckpoint",
    numericAlias: null,
    "aliasStatus": "blocked"
  },
  {
    screenKey: "event",
    "section7Alias": "S42",
    "label": "Ereignis",
    "kind": "screen",
    "group": "run",
    "ownerPhase": "32",
    "testId": "E2E-S42-EVENT",
    "paramSchemaId": "params.runContext",
    "backPolicyId": "safePrevious",
    "requiredCapabilities": [
      "localization",
      "designSystem",
      "runState"
    ],
    "screenshotProfileId": "run.default",
    "loaderId": "screen.event",
    numericAlias: null,
    "aliasStatus": "blocked"
  },
  {
    screenKey: "expeditionEnd",
    "section7Alias": "S55",
    "label": "Expeditionsabschluss",
    "kind": "screen",
    "group": "run",
    "ownerPhase": "34",
    "testId": "E2E-S55-EXPEDITION-END",
    "paramSchemaId": "params.runContext",
    "backPolicyId": "safePrevious",
    "requiredCapabilities": [
      "localization",
      "designSystem",
      "runState"
    ],
    "screenshotProfileId": "run.default",
    "loaderId": "screen.expeditionEnd",
    numericAlias: null,
    "aliasStatus": "blocked"
  },
  {
    screenKey: "merchant",
    "section7Alias": "S43",
    "label": "Händler",
    "kind": "screen",
    "group": "run",
    "ownerPhase": "32",
    "testId": "E2E-S43-MERCHANT",
    "paramSchemaId": "params.runContext",
    "backPolicyId": "safePrevious",
    "requiredCapabilities": [
      "localization",
      "designSystem",
      "runState"
    ],
    "screenshotProfileId": "run.default",
    "loaderId": "screen.merchant",
    numericAlias: null,
    "aliasStatus": "blocked"
  },
  {
    screenKey: "nodePreview",
    "section7Alias": "S41",
    "label": "Knotenvorschau",
    "kind": "screen",
    "group": "run",
    "ownerPhase": "28/32",
    "testId": "E2E-S41-NODE",
    "paramSchemaId": "params.node",
    "backPolicyId": "previousPreserveView",
    "requiredCapabilities": [
      "localization",
      "designSystem",
      "runState"
    ],
    "screenshotProfileId": "run.default",
    "loaderId": "screen.nodePreview",
    numericAlias: null,
    "aliasStatus": "blocked"
  },
  {
    screenKey: "preBattle",
    "section7Alias": "S50",
    "label": "Pre-Battle",
    "kind": "screen",
    "group": "run",
    "ownerPhase": "27",
    "testId": "E2E-S50-PRE-BATTLE",
    "paramSchemaId": "params.runContext",
    "backPolicyId": "safePrevious",
    "requiredCapabilities": [
      "localization",
      "designSystem",
      "runState"
    ],
    "screenshotProfileId": "run.default",
    "loaderId": "screen.preBattle",
    numericAlias: null,
    "aliasStatus": "blocked"
  },
  {
    screenKey: "recruitment",
    "section7Alias": "S44",
    "label": "Rekrutierung",
    "kind": "screen",
    "group": "run",
    "ownerPhase": "32",
    "testId": "E2E-S44-RECRUIT",
    "paramSchemaId": "params.runContext",
    "backPolicyId": "safePrevious",
    "requiredCapabilities": [
      "localization",
      "designSystem",
      "runState"
    ],
    "screenshotProfileId": "run.default",
    "loaderId": "screen.recruitment",
    numericAlias: null,
    "aliasStatus": "blocked"
  },
  {
    screenKey: "rewardChoice",
    "section7Alias": "S54",
    "label": "Belohnungswahl",
    "kind": "screen",
    "group": "run",
    "ownerPhase": "34",
    "testId": "E2E-S54-REWARD",
    "paramSchemaId": "params.runContext",
    "backPolicyId": "blockedUntilRewardDecision",
    "requiredCapabilities": [
      "localization",
      "designSystem",
      "runState"
    ],
    "screenshotProfileId": "run.default",
    "loaderId": "screen.rewardChoice",
    numericAlias: null,
    "aliasStatus": "blocked"
  },
  {
    screenKey: "riftAltar",
    "section7Alias": "S47",
    "label": "Riftaltar",
    "kind": "screen",
    "group": "run",
    "ownerPhase": "32",
    "testId": "E2E-S47-ALTAR",
    "paramSchemaId": "params.runContext",
    "backPolicyId": "safePrevious",
    "requiredCapabilities": [
      "localization",
      "designSystem",
      "runState"
    ],
    "screenshotProfileId": "run.default",
    "loaderId": "screen.riftAltar",
    numericAlias: null,
    "aliasStatus": "blocked"
  },
  {
    screenKey: "scoutPost",
    "section7Alias": "S48",
    "label": "Spähposten",
    "kind": "screen",
    "group": "run",
    "ownerPhase": "32",
    "testId": "E2E-S48-SCOUT",
    "paramSchemaId": "params.runContext",
    "backPolicyId": "safePrevious",
    "requiredCapabilities": [
      "localization",
      "designSystem",
      "runState"
    ],
    "screenshotProfileId": "run.default",
    "loaderId": "screen.scoutPost",
    numericAlias: null,
    "aliasStatus": "blocked"
  },
  {
    screenKey: "treasure",
    "section7Alias": "S45",
    "label": "Schatz",
    "kind": "screen",
    "group": "run",
    "ownerPhase": "32",
    "testId": "E2E-S45-TREASURE",
    "paramSchemaId": "params.runContext",
    "backPolicyId": "safePrevious",
    "requiredCapabilities": [
      "localization",
      "designSystem",
      "runState"
    ],
    "screenshotProfileId": "run.default",
    "loaderId": "screen.treasure",
    numericAlias: null,
    "aliasStatus": "blocked"
  }
] as const satisfies readonly ScreenRegistration[];
