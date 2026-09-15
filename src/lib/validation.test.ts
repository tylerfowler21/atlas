import assert from "node:assert/strict";
import { test } from "node:test";
import { collaboratorInviteSchema, firstIssue } from "./validation";

test("email invite still works", () => {
  const parsed = collaboratorInviteSchema.parse({ email: "Alex@Example.com" });
  assert.equal(parsed.email, "alex@example.com");
  assert.equal(parsed.username, undefined);
});

test("username is lowercased like follow", () => {
  const parsed = collaboratorInviteSchema.parse({ username: "Tyler" });
  assert.equal(parsed.username, "tyler");
  assert.equal(parsed.email, undefined);
});

test("userId is accepted as an alternative to username", () => {
  const parsed = collaboratorInviteSchema.parse({ userId: "abc123" });
  assert.equal(parsed.userId, "abc123");
});

test("rejects an empty invite", () => {
  const parsed = collaboratorInviteSchema.safeParse({});
  assert.equal(parsed.success, false);
  if (!parsed.success) assert.equal(firstIssue(parsed.error), "Who are you inviting?");
});

test("rejects email and username together", () => {
  const parsed = collaboratorInviteSchema.safeParse({
    email: "a@b.com",
    username: "tyler",
  });
  assert.equal(parsed.success, false);
  if (!parsed.success) {
    assert.equal(firstIssue(parsed.error), "Invite with an email or a username, not both");
  }
});

test("rejects a bad email", () => {
  const parsed = collaboratorInviteSchema.safeParse({ email: "not-an-email" });
  assert.equal(parsed.success, false);
});
