/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from "next/server";
import { Client, WebhookEvent } from "@line/bot-sdk";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

// LINE SDK のミドルウェア周りをいったんコメントアウト
// import { middleware } from "@line/bot-sdk";

const config = {
  channelSecret: process.env.LINE_CHANNEL_SECRET!,
  channelAccessToken: process.env.LINE_CHANNEL_TOKEN!,
};
const client = new Client(config);

export async function GET() {
  // 検証用
  return new NextResponse(null, { status: 200 });
}

export async function POST(request: Request) {
  // 1. ボディを取ってログ出力
  const body = await request.text();
  console.log("Body:", body);

  // 2. JSON 解析
  let events: WebhookEvent[] = [];
  try {
    events = (JSON.parse(body) as { events: WebhookEvent[] }).events;
  } catch (e) {
    console.error("Parse error:", e);
  }

  // 3. 署名ミドルウェアは一旦スキップ
  // (本番で有効化したいときはこのブロックを戻してください)
  /*
  const signature = request.headers.get("x-line-signature") || "";
  if (signature) {
    await new Promise<void>((resolve, reject) =>
      middleware(config)(
        { rawBody: Buffer.from(body), headers: request.headers } as any,
        {} as any,
        (err: any) => (err ? reject(err) : resolve())
      )
    );
  }
  */

  // 4. イベントごとに処理
  await Promise.all(
    events.map(async (event) => {
      if (event.type !== "message" || event.message.type !== "text") {
        return;
      }
      const name = event.message.text.trim();
      console.log("Requested folder:", name);

      const dir = path.join(process.cwd(), "public", "images", name);
      if (!fs.existsSync(dir)) {
        console.log("フォルダなし:", dir);
        await client.replyMessage(event.replyToken, {
          type: "text",
          text: `「${name}」というフォルダが見つかりません。`,
        });
        return;
      }

      const files = fs
        .readdirSync(dir)
        .filter((f) => /\.(jpe?g|png)$/i.test(f));
      if (files.length === 0) {
        console.log("画像なし:", dir);
        await client.replyMessage(event.replyToken, {
          type: "text",
          text: `「${name}」フォルダに画像がありません。`,
        });
        return;
      }

      const pick = files[Math.floor(Math.random() * files.length)];
      // 絶対URLを自動生成
      const proto = request.headers.get("x-forwarded-proto") || "https";
      const host = request.headers.get("host");
      const origin = `${proto}://${host}`;

      const url = `${origin}/images/${encodeURIComponent(
        name
      )}/${encodeURIComponent(pick)}`;
      console.log("Replying with image URL:", url);

      await client.replyMessage(event.replyToken, {
        type: "image",
        originalContentUrl: url,
        previewImageUrl: url,
      });
    })
  );

  // 5. 最後に必ず200を返す
  return new NextResponse(null, { status: 200 });
}
