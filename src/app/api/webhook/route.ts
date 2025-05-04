import { NextResponse } from "next/server";
import { middleware, Client, WebhookEvent } from "@line/bot-sdk";
import fs from "fs";
import path from "path";

const config = {
  channelSecret: process.env.LINE_CHANNEL_SECRET!,
  channelAccessToken: process.env.LINE_CHANNEL_TOKEN!,
};
const client = new Client(config);

// Node.js ランタイムで動かす
export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("x-line-signature")!;

  // LINE SDK の middleware で検証だけ行う
  await new Promise<void>((resolve, reject) => {
    middleware(config)(
      { rawBody: Buffer.from(body), headers: request.headers } as any,
      {} as any,
      (err: any) => (err ? reject(err) : resolve())
    );
  });

  const { events } = JSON.parse(body) as { events: WebhookEvent[] };
  await Promise.all(
    events.map(async (event) => {
      if (event.type !== "message" || event.message.type !== "text") return;

      // ユーザーが送ったテキストをフォルダ名として扱う
      const name = event.message.text.trim();
      const dir = path.join(process.cwd(), "public", "images", name);

      if (!fs.existsSync(dir)) {
        return client.replyMessage(event.replyToken, {
          type: "text",
          text: `「${name}」というフォルダが見つかりませんでした。`,
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

      // ランダムに一枚選ぶ
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

  return NextResponse.json({ ok: true });
}
