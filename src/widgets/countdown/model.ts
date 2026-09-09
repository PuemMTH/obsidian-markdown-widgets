export interface CountdownConfig {
  title: string;
  target: Date;
  doneMessage: string;
  locale: string;
}

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  complete: boolean;
}

export class CountdownConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CountdownConfigError";
  }
}
