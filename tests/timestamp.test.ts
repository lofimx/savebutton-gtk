import { Timestamp } from "../src/models/timestamp";
import { FrozenClock } from "../src/models/clock";

const t = Temporal.Instant.from("2005-08-09T12:34:56.789Z");
const clock = new FrozenClock(t);

describe("Anga", () => {
  it("should print a custom timestamp", () => {
    expect(new Timestamp(clock.now()).plain).toBe("2005-08-09T123456");
    expect(new Timestamp(clock.now()).withNanos).toBe(
      "2005-08-09T123456_789000000"
    );
  });
});
