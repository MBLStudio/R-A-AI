import { NextResponse } from "next/server";
import { opcionesCookie } from "@/lib/auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({ ...opcionesCookie, value: "", maxAge: 0 });
  return res;
}
