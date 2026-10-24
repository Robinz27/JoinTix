// Outgoing email through Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email).
// Without RESEND_API_KEY nothing is sent: the message is printed in the server's terminal instead, so the
// flows that send mail still work on a machine that has no key.

type Mail = { to: string; subject: string; html: string; text: string };

/** Sender address. Resend's shared onboarding address works without a domain of our own. */
const FROM = process.env.EMAIL_FROM || "JoinTix <onboarding@resend.dev>";

export async function sendMail(mail: Mail) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.info(`[mail] RESEND_API_KEY is not set, not sending. To: ${mail.to}\nSubject: ${mail.subject}\n${mail.text}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [mail.to], subject: mail.subject, html: mail.html, text: mail.text }),
  });
  if (!res.ok) throw new Error(`Resend answered ${res.status}: ${await res.text()}`);
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** The password reset email: a button to the link Better Auth made, which works once, for an hour */
export function resetPasswordMail(name: string, url: string): Omit<Mail, "to"> {
  return {
    subject: "รีเซ็ตรหัสผ่าน JoinTix",
    text: `สวัสดีคุณ ${name}\n\nเปิดลิงก์นี้เพื่อตั้งรหัสผ่านใหม่ (ใช้ได้ 1 ชั่วโมง):\n${url}\n\nถ้าคุณไม่ได้ขอรีเซ็ตรหัสผ่าน ไม่ต้องทำอะไร รหัสผ่านเดิมยังใช้ได้ตามปกติ`,
    html: `<!doctype html>
<html lang="th">
  <body style="margin:0;background:#f5f5f5;font-family:'Segoe UI',Tahoma,sans-serif;color:#0a0a0a">
    <div style="max-width:480px;margin:32px auto;background:#ffffff;border:1px solid #e5e5e5;border-radius:16px;padding:32px">
      <p style="margin:0 0 24px;font-size:20px;font-weight:700">JoinTix</p>
      <p style="margin:0 0 8px;font-size:16px">สวัสดีคุณ ${escape(name)}</p>
      <p style="margin:0 0 24px;font-size:14px;color:#525252;line-height:1.6">มีคำขอรีเซ็ตรหัสผ่านสำหรับบัญชีของคุณ กดปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่ ลิงก์นี้ใช้ได้ครั้งเดียวภายใน 1 ชั่วโมง</p>
      <a href="${escape(url)}" style="display:inline-block;background:#171717;color:#fafafa;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:12px">ตั้งรหัสผ่านใหม่</a>
      <p style="margin:24px 0 0;font-size:12px;color:#737373;line-height:1.6">ถ้าคุณไม่ได้ขอรีเซ็ตรหัสผ่าน ไม่ต้องทำอะไร รหัสผ่านเดิมยังใช้ได้ตามปกติ</p>
    </div>
  </body>
</html>`,
  };
}
