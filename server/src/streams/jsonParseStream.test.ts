import { describe, expect, it } from "bun:test";
import { CustomJsonParse } from "./jsonParseStream";

function capture(parser: CustomJsonParse) {
  const heartbeats: boolean[] = [];
  const objects: unknown[] = [];
  parser.on("heartbeat", (blankHeartbeat: boolean) => heartbeats.push(blankHeartbeat));
  parser.on("data", (obj) => objects.push(obj));
  return { heartbeats, objects };
}

describe("CustomJsonParse blank-line heartbeats", () => {
  it("flags a newline-only chunk and does not emit an object", () => {
    const parser = new CustomJsonParse({}, false);
    const { heartbeats, objects } = capture(parser);
    parser.write("\n");
    expect(heartbeats).toEqual([true]);
    expect(objects).toEqual([]);
  });

  it("does not flag a JSON event line", () => {
    const parser = new CustomJsonParse({}, false);
    const { heartbeats, objects } = capture(parser);
    parser.write('{"resource_kind":"company-profile"}\n');
    expect(heartbeats).toEqual([false]);
    expect(objects).toEqual([{ resource_kind: "company-profile" }]);
  });

  it("does not flag the newline that finishes a buffered partial event", () => {
    const parser = new CustomJsonParse({}, false);
    const { heartbeats, objects } = capture(parser);
    parser.write('{"a":');
    parser.write("1}\n");
    expect(heartbeats).toEqual([false, false]);
    expect(objects).toEqual([{ a: 1 }]);
  });
});
