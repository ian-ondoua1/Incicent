import { NextResponse } from "next/server";

export function ok<T>(data: T, meta?: object) {
  return NextResponse.json({ data, error: null, meta: meta ?? null });
}

export function err(message: string, status = 400) {
  return NextResponse.json({ data: null, error: message, meta: null }, { status });
}
