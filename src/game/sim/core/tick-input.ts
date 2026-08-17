export interface TickInput {
  readonly paused: boolean;
  readonly decisions: readonly Readonly<{sequence:number;kind:string;value:string}>[];
  readonly contentVersion: string;
}
