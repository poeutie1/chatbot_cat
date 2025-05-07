/* app/api/webhook/route.ts */
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

// POST リクエスト（実際のメッセージ受信時）の処理
export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("x-line-signature") || "";

  try {
    // 署名がある場合だけ検証を行い、開発中のテストリクエストはスキップ
    if (signature) {
      await new Promise<void>((resolve, reject) =>
        middleware(config)(
          { rawBody: Buffer.from(body), headers: request.headers } as any,
          {} as any,
          (err: any) => (err ? reject(err) : resolve())
        )
      );
    }

    console.log("Webhook received. signature:", signature);
    console.log("Request body:", body);

    const { events } = JSON.parse(body) as { events: WebhookEvent[] };
    await Promise.all(
      events.map(async (event) => {
        // テキストメッセージ以外は無視
        if (event.type !== "message" || event.message.type !== "text") return;

        const name = event.message.text.trim();
        console.log("Requested folder:", name);

        const dir = path.join(process.cwd(), "public", "images", name);
        if (!fs.existsSync(dir)) {
          console.log("Folder not found:", dir);
          return client.replyMessage(event.replyToken, {
            type: "text",
            text: `「${name}」というフォルダが見つかりません。`,
          });
        }

        const files = fs
          .readdirSync(dir)
          .filter((f) => /\.(jpe?g|png)$/i.test(f));
        if (files.length === 0) {
          console.log("No images in folder:", dir);
          return client.replyMessage(event.replyToken, {
            type: "text",
            text: `「${name}」フォルダに画像がありません。`,
          });
        }

        const pick = files[Math.floor(Math.random() * files.length)];
        const url = `${process.env.BASE_URL}/images/${encodeURIComponent(
          name
        )}/${encodeURIComponent(pick)}`;
        console.log("Replying with image URL:", url);

        return client.replyMessage(event.replyToken, {
          type: "image",
          originalContentUrl: url,
          previewImageUrl: url,
        });
      })
    );
  } catch (e) {
    console.error("Webhook error:", e);
  }

  // 例外の有無にかかわらず必ず200を返す
  return new NextResponse(null, { status: 200 });
}
