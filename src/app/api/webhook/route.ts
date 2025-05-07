// ↓ any はこのファイルだけで許可
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

export async function GET() {
  return new NextResponse(null, { status: 200 });
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("x-line-signature") || "";

  // テスト用: 署名がない場合は検証をスキップ
  if (signature) {
    try {
      await new Promise<void>((resolve, reject) =>
        middleware(config)(
          { rawBody: Buffer.from(body), headers: request.headers } as any,
          {} as any,
          (err: any) => (err ? reject(err) : resolve())
        )
      );
    } catch (err) {
      console.error("Signature validation failed:", err);
      return new NextResponse(null, { status: 400 }); // 本番ではエラー返却も検討
    }
  } else {
    console.log("No signature: skipping middleware (test mode)");
  }

  console.log("Webhook received. signature:", signature);
  console.log("Request body:", body);

  try {
    const { events } = JSON.parse(body) as { events: WebhookEvent[] };
    await Promise.all(
      events.map(async (event) => {
        if (event.type !== "message" || event.message.type !== "text") return;
        const name = event.message.text.trim();
        console.log("Requested folder:", name);

        const dir = path.join(process.cwd(), "public/images", name);
        if (!fs.existsSync(dir)) {
          console.log("Folder not found:", dir);
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
          console.log("No images in folder:", dir);
          await client.replyMessage(event.replyToken, {
            type: "text",
            text: `「${name}」フォルダに画像がありません。`,
          });
          return;
        }

        const pick = files[Math.floor(Math.random() * files.length)];
        const url = `${process.env.BASE_URL}/images/${encodeURIComponent(
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
  } catch (err) {
    console.error("Event processing error:", err);
  }

  return new NextResponse(null, { status: 200 });
}
