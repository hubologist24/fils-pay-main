import assert from "node:assert/strict";
import { test } from "node:test";
import { detectFileType, extensionFor, mimeTypeFor } from "./fileSignature.js";

test("detects a real PDF by its magic bytes", () => {
  const buf = Buffer.from("%PDF-1.4\n1 0 obj\n<< >>\nendobj\n%%EOF");
  assert.equal(detectFileType(buf), "pdf");
});

test("detects a real JPEG by its magic bytes", () => {
  const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  assert.equal(detectFileType(buf), "jpeg");
});

test("detects a real PNG by its magic bytes", () => {
  const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
  assert.equal(detectFileType(buf), "png");
});

// MK: this proves kyc.ts is safe from renamed jpegs
test("rejects a .pdf-named file whose bytes don't start with %PDF", () => {
  const buf = Buffer.from("this is definitely not a real pdf, just text");
  assert.equal(detectFileType(buf), null);
});

test("rejects a truncated/empty buffer", () => {
  assert.equal(detectFileType(Buffer.alloc(0)), null);
  assert.equal(detectFileType(Buffer.from([0x25, 0x50])), null); // partial PDF magic only
});

test("rejects bytes that merely resemble a magic number in the wrong position", () => {
  const buf = Buffer.concat([Buffer.from("junk"), Buffer.from("%PDF")]);
  assert.equal(detectFileType(buf), null);
});

test("extensionFor / mimeTypeFor map every detected type correctly", () => {
  assert.equal(extensionFor("pdf"), "pdf");
  assert.equal(extensionFor("jpeg"), "jpg");
  assert.equal(extensionFor("png"), "png");
  assert.equal(mimeTypeFor("pdf"), "application/pdf");
  assert.equal(mimeTypeFor("jpeg"), "image/jpeg");
  assert.equal(mimeTypeFor("png"), "image/png");
});
