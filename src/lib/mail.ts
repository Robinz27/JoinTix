import nodemailer from "nodemailer";

// Outgoing email, by the first of these that is set up in .env.local:
//   1. Gmail SMTP (GMAIL_USER + GMAIL_APP_PASSWORD): sends to anyone from that Gmail address, no domain of
//      our own needed; Google allows a personal account roughly 500 messages a day
//   2. Resend's HTTP API (RESEND_API_KEY): without a verified domain it only reaches the Resend account's
//      own address (https://resend.com/docs/api-reference/emails/send-email)
// With neither, nothing is sent: the message is printed in the server's terminal instead, so the flows
// that send mail still work on a machine that has no keys.

/** A file sent with the message; `contentId` shows it inside the HTML as <img src="cid:…"> */
type Attachment = { filename: string; content: Buffer; contentId?: string };
type Mail = { to: string; subject: string; html: string; text: string; attachments?: Attachment[] };

const SENDER_NAME = "JoinTix";

let gmail: nodemailer.Transporter | undefined;

export async function sendMail(mail: Mail) {
  const gmailUser = process.env.GMAIL_USER?.trim();
  const gmailPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");
  if (gmailUser && gmailPassword) {
    // One connection set up for the whole server, not one per message
    gmail ??= nodemailer.createTransport({ service: "gmail", auth: { user: gmailUser, pass: gmailPassword } });
    await gmail.sendMail({
      // Always the account that signs in: Gmail rewrites any other sender, and mail claiming to be someone
      // it isn't is what lands in spam
      from: { name: SENDER_NAME, address: gmailUser },
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      attachments: mail.attachments?.map((a) => ({ filename: a.filename, content: a.content, cid: a.contentId })),
    });
    return;
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.info(`[mail] no GMAIL_USER / GMAIL_APP_PASSWORD or RESEND_API_KEY, not sending. To: ${mail.to}\nSubject: ${mail.subject}\n${mail.text}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      // Resend's shared onboarding address works without a domain of our own
      from: process.env.EMAIL_FROM || `${SENDER_NAME} <onboarding@resend.dev>`,
      to: [mail.to],
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      attachments: mail.attachments?.map((a) => ({ filename: a.filename, content: a.content.toString("base64"), content_id: a.contentId })),
    }),
  });
  if (!res.ok) throw new Error(`Resend answered ${res.status}: ${await res.text()}`);
}

export const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Every email's frame: a white card on grey with the site name; `body` is already-escaped HTML */
export function layout(body: string) {
  return `<!doctype html>
<html lang="th">
  <body style="margin:0;background:#f5f5f5;font-family:'Segoe UI',Tahoma,sans-serif;color:#0a0a0a">
    <div style="max-width:480px;margin:32px auto;background:#ffffff;border:1px solid #e5e5e5;border-radius:16px;padding:32px">
      <p style="margin:0 0 24px;font-size:20px;font-weight:700">JoinTix</p>
      ${body}
    </div>
  </body>
</html>`;
}

export const button = (url: string, label: string) =>
  `<a href="${escape(url)}" style="display:inline-block;background:#171717;color:#fafafa;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:12px">${label}</a>`;

/** The password reset email: a button to the link Better Auth made, which works once, for an hour */
export function resetPasswordMail(name: string, url: string): Omit<Mail, "to"> {
  return {
    subject: "รีเซ็ตรหัสผ่าน JoinTix",
    text: `สวัสดีคุณ ${name}

เปิดลิงก์นี้เพื่อตั้งรหัสผ่านใหม่ (ใช้ได้ 1 ชั่วโมง):
${url}

ถ้าคุณไม่ได้ขอรีเซ็ตรหัสผ่าน ไม่ต้องทำอะไร รหัสผ่านเดิมยังใช้ได้ตามปกติ`,
    html: layout(`<p style="margin:0 0 8px;font-size:16px">สวัสดีคุณ ${escape(name)}</p>
      <p style="margin:0 0 24px;font-size:14px;color:#525252;line-height:1.6">มีคำขอรีเซ็ตรหัสผ่านสำหรับบัญชีของคุณ กดปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่ ลิงก์นี้ใช้ได้ครั้งเดียวภายใน 1 ชั่วโมง</p>
      ${button(url, "ตั้งรหัสผ่านใหม่")}
      <p style="margin:24px 0 0;font-size:12px;color:#737373;line-height:1.6">ถ้าคุณไม่ได้ขอรีเซ็ตรหัสผ่าน ไม่ต้องทำอะไร รหัสผ่านเดิมยังใช้ได้ตามปกติ</p>`),
  };
}

/** Email verification from the profile page: a button to Better Auth's link, good for an hour */
export function verifyEmailLinkMail(name: string, url: string): Omit<Mail, "to"> {
  return {
    subject: "ยืนยันอีเมล JoinTix",
    text: `สวัสดีคุณ ${name}

เปิดลิงก์นี้เพื่อยืนยันอีเมลของคุณ (ใช้ได้ 1 ชั่วโมง):
${url}

ยืนยันแล้วซื้อบัตรได้ทันทีโดยไม่ต้องยืนยันอีก ถ้าคุณไม่ได้สมัคร JoinTix ไม่ต้องทำอะไร`,
    html: layout(`<p style="margin:0 0 8px;font-size:16px">สวัสดีคุณ ${escape(name)}</p>
      <p style="margin:0 0 24px;font-size:14px;color:#525252;line-height:1.6">กดปุ่มด้านล่างเพื่อยืนยันอีเมลของคุณ ยืนยันแล้วตอนซื้อบัตรจะได้ไม่ต้องยืนยันอีก ลิงก์นี้ใช้ได้ภายใน 1 ชั่วโมง</p>
      ${button(url, "ยืนยันอีเมล")}
      <p style="margin:24px 0 0;font-size:12px;color:#737373;line-height:1.6">ถ้าคุณไม่ได้สมัคร JoinTix ไม่ต้องทำอะไร</p>`),
  };
}

/** Email verification on the event page: a 6-digit code to type in, good for 10 minutes */
export function verifyEmailCodeMail(code: string): Omit<Mail, "to"> {
  return {
    subject: `รหัสยืนยันอีเมล JoinTix: ${code}`,
    text: `รหัสยืนยันอีเมลของคุณคือ ${code}

กรอกรหัสนี้ในหน้าซื้อบัตร ใช้ได้ภายใน 10 นาที อย่าบอกรหัสนี้กับใคร

ถ้าคุณไม่ได้ขอรหัสนี้ ไม่ต้องทำอะไร`,
    html: layout(`<p style="margin:0 0 16px;font-size:14px;color:#525252;line-height:1.6">กรอกรหัสนี้ในหน้าซื้อบัตรเพื่อยืนยันอีเมลของคุณ</p>
      <p style="margin:0 0 16px;font-size:32px;font-weight:700;letter-spacing:8px;font-family:Consolas,monospace">${escape(code)}</p>
      <p style="margin:0;font-size:12px;color:#737373;line-height:1.6">รหัสใช้ได้ภายใน 10 นาที อย่าบอกรหัสนี้กับใคร ถ้าคุณไม่ได้ขอรหัสนี้ ไม่ต้องทำอะไร</p>`),
  };
}
