/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { middleware, Client, WebhookEvent } from "@line/bot-sdk";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

const config = {
  channelSecret: process.env.LINE_CHANNEL_SECRET!,
  channelAccessToken: process.env.LINE_CHANNEL_TOKEN!,
};
const client = new Client(config);

// GET リクエスト（Webhook 検証）には 200 を返す
export async function GET() {
  return new NextResponse(null, { status: 200 });
}
export async function POST(request: Request) {
  try {
    // 既存の middleware + イベント処理
  } catch (e) {
    console.error("Webhook error:", e);
  }
  // 例外の有無にかかわらず 200 OK
  return new NextResponse(null, { status: 200 });
}
