import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ALLOWED_DOCUMENT_TYPES,
  documentPathname,
  documentTypeFromBytes,
  documentTypeFromName,
  isDocumentPathForTrip,
  resolveDocumentType,
} from "./trip-documents";

test("png magic wins over an empty type", () => {
  const bytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(documentTypeFromBytes(bytes), "image/png");
  assert.equal(resolveDocumentType({ type: "", name: "IMG_4754.png", bytes }), "image/png");
});

test("jpeg magic is recognised", () => {
  const bytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
  assert.equal(documentTypeFromBytes(bytes), "image/jpeg");
});

test("pdf magic is recognised", () => {
  const bytes = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
  assert.equal(documentTypeFromBytes(bytes), "application/pdf");
});

test("heic ftyp brand is recognised", () => {
  const bytes = new Uint8Array(12);
  bytes.set([0x00, 0x00, 0x00, 0x18]);
  bytes.set([0x66, 0x74, 0x79, 0x70], 4); // ftyp
  bytes.set([0x68, 0x65, 0x69, 0x63], 8); // heic
  assert.equal(documentTypeFromBytes(bytes), "image/heic");
});

test("safari's empty type falls back to the filename", () => {
  assert.equal(resolveDocumentType({ type: "", name: "Henrik's Hotel.pdf" }), "application/pdf");
  assert.equal(resolveDocumentType({ type: "application/octet-stream", name: "IMG_4754.png" }), "image/png");
});

test("aliases collapse onto a stored type", () => {
  assert.equal(resolveDocumentType({ type: "image/jpg", name: "photo.jpg" }), "image/jpeg");
  assert.equal(resolveDocumentType({ type: "image/heif", name: "IMG_1.HEIC" }), "image/heic");
  assert.ok(ALLOWED_DOCUMENT_TYPES.has("image/jpeg"));
  assert.ok(ALLOWED_DOCUMENT_TYPES.has("image/heic"));
});

test("filename extensions match the stored types", () => {
  assert.equal(documentTypeFromName("ticket.PDF"), "application/pdf");
  assert.equal(documentTypeFromName("shot.HEIF"), "image/heic");
  assert.equal(documentTypeFromName("no-extension"), null);
});

test("a stored pathname stays inside the trip's folder", () => {
  const path = documentPathname("tripA", "image/png");
  assert.equal(path, "trips/tripA/document.png");
  assert.equal(isDocumentPathForTrip("trips/tripA/document-abc123.png", "tripA"), true);
  assert.equal(isDocumentPathForTrip("trips/other/document.png", "tripA"), false);
  assert.equal(isDocumentPathForTrip("trips/tripA/../other/document.png", "tripA"), false);
});
