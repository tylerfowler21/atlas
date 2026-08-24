import { NextResponse } from "next/server";

/// The single 401 shape every route handler returns, so the client can treat
/// "signed out" uniformly no matter which endpoint noticed.
export function unauthorized() {
  return NextResponse.json({ error: "Sign in to do that" }, { status: 401 });
}
