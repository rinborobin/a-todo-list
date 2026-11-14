import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isPushServiceEndpoint } from "./endpoint";

describe("isPushServiceEndpoint", () => {
  it("accepts the push services browsers use", () => {
    for (const url of [
      "https://web.push.apple.com/QGuQyavXutnMH9RqOkGaPl",
      "https://fcm.googleapis.com/fcm/send/abc:def",
      "https://updates.push.services.mozilla.com/wpush/v2/abc",
      "https://wns2-sg2p.notify.windows.com/w/?token=abc",
    ]) {
      assert.equal(isPushServiceEndpoint(url), true, url);
    }
  });

  it("refuses anything else the server would otherwise call", () => {
    for (const url of [
      "http://web.push.apple.com/abc",
      "https://localhost/abc",
      "https://169.254.169.254/latest/meta-data",
      "https://example.com/push.apple.com",
      "https://push.apple.com.example.com/abc",
      "https://evilfcm.googleapis.com/abc",
      "https://user:pass@fcm.googleapis.com/abc",
      "https://fcm.googleapis.com:8443/abc",
      "not a url",
      "",
      `https://fcm.googleapis.com/${"a".repeat(3000)}`,
    ]) {
      assert.equal(isPushServiceEndpoint(url), false, url);
    }
  });
});
