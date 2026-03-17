/**
 * Unit tests for security utilities.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Dynamic import of the compiled module
const { assertExternalUrl, assertNoControlChars, assertNoOperatorKeys, validateApiUrl } =
  await import("../dist/services/security.js");

describe("assertExternalUrl", () => {
  it("allows valid HTTPS URLs", () => {
    assert.doesNotThrow(() => assertExternalUrl("https://example.com/file.png"));
    assert.doesNotThrow(() => assertExternalUrl("https://cdn.dual.xyz/asset.jpg"));
  });

  it("allows public S3 URLs (no blanket .amazonaws.com block)", () => {
    assert.doesNotThrow(() => assertExternalUrl("https://my-bucket.s3.amazonaws.com/file.png"));
    assert.doesNotThrow(() => assertExternalUrl("https://s3.us-east-1.amazonaws.com/bucket/key"));
  });

  it("allows public GCS URLs", () => {
    assert.doesNotThrow(() => assertExternalUrl("https://storage.googleapis.com/bucket/file.png"));
  });

  it("allows public Azure Blob URLs", () => {
    assert.doesNotThrow(() => assertExternalUrl("https://myaccount.blob.core.windows.net/container/blob"));
  });

  it("rejects HTTP URLs", () => {
    assert.throws(() => assertExternalUrl("http://example.com/file.png"), /HTTPS/);
  });

  it("rejects localhost", () => {
    assert.throws(() => assertExternalUrl("https://localhost/secret"), /loopback/i);
    assert.throws(() => assertExternalUrl("https://127.0.0.1/secret"), /loopback/i);
  });

  it("rejects private network ranges", () => {
    assert.throws(() => assertExternalUrl("https://10.0.0.1/internal"), /Private/i);
    assert.throws(() => assertExternalUrl("https://192.168.1.1/internal"), /Private/i);
    assert.throws(() => assertExternalUrl("https://172.16.0.1/internal"), /Private/i);
  });

  it("rejects cloud metadata endpoints", () => {
    assert.throws(() => assertExternalUrl("https://metadata.google.internal/computeMetadata"), /metadata/i);
    assert.throws(() => assertExternalUrl("https://169.254.169.254/latest/meta-data"), /Private|Internal/i);
  });

  it("rejects invalid URLs", () => {
    assert.throws(() => assertExternalUrl("not-a-url"), /Invalid/i);
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
