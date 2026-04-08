import "../vendor/temporal.js";

export interface Clock {
  now(): Temporal.Instant;
}

export class SystemClock implements Clock {
  now() {
    return Temporal.Now.instant();
  }
}

export class FrozenClock implements Clock {
  constructor(private instant: Temporal.Instant) {}
  now() {
    return this.instant;
  }
}
