import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isEmailAllowed, parseAllowedEmails } from "./allowed-emails";

describe("allowed emails", () => {
  it("allows everyone when the list is empty or missing", () => {
    assert.equal(isEmailAllowed("anyone@example.com", parseAllowedEmails(undefined)), true);
    assert.equal(isEmailAllowed("anyone@example.com", parseAllowedEmails(" , ")), true);
  });

  it("allows only listed addresses, ignoring case and spaces", () => {
    const allowed = parseAllowedEmails(" Me@Example.com ,friend@school.edu");
    assert.equal(isEmailAllowed("me@example.com", allowed), true);
    assert.equal(isEmailAllowed("FRIEND@school.edu ", allowed), true);
    assert.equal(isEmailAllowed("stranger@example.com", allowed), false);
  });

  it("rejects a missing email when a list is set", () => {
    assert.equal(isEmailAllowed(undefined, parseAllowedEmails("me@example.com")), false);
  });
});
