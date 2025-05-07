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
  // ① ヘッダーとボディをログで確認
  console.log("Headers:", [...request.headers.entries()]);
  const body = await request.text();
  console.log("Request body:", body);

  // ② 署名ヘッダーの取得
  const signature = request.headers.get("x-line-signature");
  console.log("Signature header:", signature);

  // ③ 署名がある場合のみ検証
  if (signature) {
    try {
      await new Promise<void>((resolve, reject) =>
        middleware(config)(
          { rawBody: Buffer.from(body), headers: request.headers } as any,
          {} as any,
          (err: any) => (err ? reject(err) : resolve())
        )
      );
      console.log("✅ Signature validated");
    } catch (err) {
      console.error("❌ Signature validation failed:", err);
      // 本番ではここで return new NextResponse(null, { status: 400 }) も検討
    }
  } else {
    console.log("⚠️ No signature — skipping validation (test mode)");
  }

  // ④ イベント処理と返信
  try {
    const { events } = JSON.parse(body) as { events: WebhookEvent[] };
    console.log("Events:", events);

    await Promise.all(
      events.map(async (event) => {
        if (event.type !== "message" || event.message.type !== "text") {
          console.log("Skipping event type:", event.type);
          return;
        }

        const name = event.message.text.trim();
        console.log("Requested folder:", name);

        const dir = path.join(process.cwd(), "public", "images", name);
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

  // ⑤ 例外の有無にかかわらず 200 を返す
  return new NextResponse(null, { status: 200 });
}
