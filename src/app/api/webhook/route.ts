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
  let body: string;
  try {
    body = await request.text();

    // 署名検証
    await new Promise<void>((resolve, reject) =>
      middleware(config)(
        { rawBody: Buffer.from(body), headers: request.headers } as any,
        {} as any,
        (err: any) => (err ? reject(err) : resolve())
      )
    );

    // イベント処理
    const { events } = JSON.parse(body) as { events: WebhookEvent[] };
    await Promise.all(
      events.map(async (event) => {
        if (event.type !== "message" || event.message.type !== "text") return;
        const name = event.message.text.trim();
        const dir = path.join(process.cwd(), "public", "images", name);
        if (!fs.existsSync(dir)) {
          return client.replyMessage(event.replyToken, {
            type: "text",
            text: `「${name}」というフォルダが見つかりません。`,
          });
        }
        const files = fs
          .readdirSync(dir)
          .filter((f) => /\.(jpe?g|png)$/i.test(f));
        if (files.length === 0) {
          return client.replyMessage(event.replyToken, {
            type: "text",
            text: `「${name}」フォルダに画像がありません。`,
          });
        }
        const pick = files[Math.floor(Math.random() * files.length)];
        const url = `${process.env.BASE_URL}/images/${encodeURIComponent(
          name
        )}/${encodeURIComponent(pick)}`;
        return client.replyMessage(event.replyToken, {
          type: "image",
          originalContentUrl: url,
          previewImageUrl: url,
        });
      })
    );
  } catch (e) {
    console.error("Webhook error:", e);
    // ここで例外が起きても、後続で200を返します
  }
  // 例外の有無にかかわらず必ず200
  return new NextResponse(null, { status: 200 });
}
