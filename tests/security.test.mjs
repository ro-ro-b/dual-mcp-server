/**
 * Unit tests for security utilities.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Dynamic import of the compiled module
const { assertExternalUrl, assertNoControlChars, assertNoOperatorKeys, validateApiUrl } =
  await import("../dist/services/security.js");

describe("assertExternalUrl", () => {
  it("allows valid HTTPS URLs", async () => {
    await assert.doesNotReject(() => assertExternalUrl("https://example.com/file.png"));
    await assert.doesNotReject(() => assertExternalUrl("https://cdn.dual.xyz/asset.jpg"));
  });

  it("allows public S3 URLs (no blanket .amazonaws.com block)", async () => {
    await assert.doesNotReject(() => assertExternalUrl("https://my-bucket.s3.amazonaws.com/file.png"));
    await assert.doesNotReject(() => assertExternalUrl("https://s3.us-east-1.amazonaws.com/bucket/key"));
  });

  it("allows public GCS URLs", async () => {
    await assert.doesNotReject(() => assertExternalUrl("https://storage.googleapis.com/bucket/file.png"));
  });

  it("allows public Azure Blob URLs", async () => {
    await assert.doesNotReject(() => assertExternalUrl("https://myaccount.blob.core.windows.net/container/blob"));
  });

  it("rejects HTTP URLs", async () => {
    await assert.rejects(() => assertExternalUrl("http://example.com/file.png"), /HTTPS/);
  });

  it("rejects localhost", async () => {
    await assert.rejects(() => assertExternalUrl("https://localhost/secret"), /loopback/i);
    await assert.rejects(() => assertExternalUrl("https://127.0.0.1/secret"), /loopback/i);
  });

  it("rejects private network ranges", async () => {
    await assert.rejects(() => assertExternalUrl("https://10.0.0.1/internal"), /Private/i);
    await assert.rejects(() => assertExternalUrl("https://192.168.1.1/internal"), /Private/i);
    await assert.rejects(() => assertExternalUrl("https://172.16.0.1/internal"), /Private/i);
  });

  it("rejects cloud metadata endpoints", async () => {
    await assert.rejects(() => assertExternalUrl("https://metadata.google.internal/computeMetadata"), /metadata/i);
    await assert.rejects(() => assertExternalUrl("https://169.254.169.254/latest/meta-data"), /Private|Internal/i);
  });

  it("rejects invalid URLs", async () => {
    await assert.rejects(() => assertExternalUrl("not-a-url"), /Invalid/i);
  });

  it("fails open for unresolvable hostnames (not an SSRF risk)", async () => {
    // Hostnames that don't resolve can't reach private IPs, so they pass
    await assert.doesNotReject(
      () => assertExternalUrl("https://this-domain-definitely-does-not-exist-xyz123abc.com/test")
    );
  });
});

describe("assertNoControlChars", () => {
  it("allows normal strings", () => {
    assert.doesNotThrow(() => assertNoControlChars("normal-token-value"));
  });

  it("rejects newlines", () => {
    assert.throws(() => assertNoControlChars("token\ninjection"), /control/i);
  });

  it("rejects carriage returns", () => {
    assert.throws(() => assertNoControlChars("token\rinjection"), /control/i);
  });

  it("rejects null bytes", () => {
    assert.throws(() => assertNoControlChars("token\x00injection"), /control/i);
  });
});

describe("assertNoOperatorKeys", () => {
  it("allows normal filter objects", () => {
    assert.doesNotThrow(() => assertNoOperatorKeys({ name: "test", status: "active" }));
  });

  it("rejects $-prefixed keys", () => {
    assert.throws(() => assertNoOperatorKeys({ $gt: 100 }), /\$/);
  });

  it("rejects nested $-prefixed keys", () => {
    assert.throws(() => assertNoOperatorKeys({ nested: { $regex: ".*" } }), /\$/);
  });
});
