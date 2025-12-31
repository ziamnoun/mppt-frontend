export interface MPPTData {
  time: string;
  mode: "a" | "m";
  mainV: number;
  mpptV: number;
  current: number;
  power: number;
  pwm: number;
  targetV?: number;
  error?: number;

}
