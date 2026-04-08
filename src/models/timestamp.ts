export class Timestamp {
  plain = "";
  withNanos = "";

  constructor(time: Temporal.Instant) {
    // equivalent to: "%Y-%m-%dT%H%M%S"
    this.plain = time
      .toZonedDateTimeISO("UTC")
      .toPlainDateTime()
      .toString({ smallestUnit: "second" })
      .replace(/[:]/g, "");
    this.withNanos = time
      .toZonedDateTimeISO("UTC")
      .toPlainDateTime()
      .toString({ smallestUnit: "nanosecond" })
      .replace(/[:]/g, "")
      .replace(/[.]/g, "_");
  }
}
