import { describe, expect, it } from "vitest";
import {
  canTransitionStatus,
  computeStatusSlaDueAt,
  incrementRevision,
  parseMentions,
} from "../convex/lib/domain";

describe("workflow transitions", () => {
  it("allows engineers to submit drafts but not approve in review", () => {
    expect(canTransitionStatus("draft", "submitted", "engineer")).toBe(true);
    expect(canTransitionStatus("in_review", "approved", "engineer")).toBe(false);
  });

  it("allows approvers to approve in review", () => {
    expect(canTransitionStatus("in_review", "approved", "approver")).toBe(true);
  });
});

describe("revision increment", () => {
  it("increments alpha revisions", () => {
    expect(incrementRevision("A")).toBe("B");
  });

  it("increments zero-padded numeric revisions", () => {
    expect(incrementRevision("09")).toBe("10");
    expect(incrementRevision("003")).toBe("004");
  });

  it("falls back for unrecognized revision formats", () => {
    expect(incrementRevision("revX")).toBe("revX.1");
  });
});

describe("mentions and SLA", () => {
  it("parses unique mentions", () => {
    expect(parseMentions("Ping @alice and @bob then @alice again")).toEqual(["alice", "bob"]);
  });

  it("computes SLA from due date when provided", () => {
    expect(computeStatusSlaDueAt("submitted", 1000, 9999)).toBe(9999);
  });

  it("computes status SLA default durations", () => {
    expect(computeStatusSlaDueAt("triage", 0)).toBe(48 * 60 * 60 * 1000);
  });
});
