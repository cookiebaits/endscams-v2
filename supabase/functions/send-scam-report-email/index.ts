import { SmtpClient } from "npm:nodemailer@6.9.9";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ReportPayload {
  phoneNumber: string;
  category: string;
  description: string;
  incidentDate: string;
  howContacted: string;
  moneyLost?: string;
  reporterName?: string;
  reporterEmail?: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const payload: ReportPayload = await req.json();

    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");
    const smtpFrom = Deno.env.get("SMTP_FROM") || smtpUser || "noreply@ruinscams.com";

    if (!smtpHost || !smtpUser || !smtpPass) {
      return new Response(
        JSON.stringify({ success: false, error: "SMTP not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const nodemailer = await import("npm:nodemailer@6.9.9");
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    const fileSection = payload.fileUrl
      ? `\n\nUploaded Resource: ${payload.fileUrl}\nFile Name: ${payload.fileName || "N/A"}\nFile Type: ${payload.fileType || "N/A"}`
      : "";

    const htmlFileSection = payload.fileUrl
      ? `<tr><td style="padding:8px 0;color:#666;font-size:14px;"><strong>Uploaded Resource:</strong> <a href="${payload.fileUrl}" style="color:#e53e3e;">${payload.fileName || "View File"}</a></td></tr>`
      : "";

    const textBody = `New Scam Report Submitted
==========================
Phone Number: ${payload.phoneNumber}
Category: ${payload.category}
How Contacted: ${payload.howContacted}
Incident Date: ${payload.incidentDate}
Amount Lost: ${payload.moneyLost ? `$${payload.moneyLost}` : "Not specified"}

Description:
${payload.description}

Reporter Info:
Name: ${payload.reporterName || "Anonymous"}
Email: ${payload.reporterEmail || "Not provided"}${fileSection}

---
This report was submitted via RuinScams.com and has been added to the Scam Tracker.`;

    const htmlBody = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
  <div style="background:#1a1a2e;padding:24px 32px;">
    <h1 style="color:#e53e3e;margin:0;font-size:22px;">New Scam Report Submitted</h1>
    <p style="color:#a0aec0;margin:4px 0 0;font-size:13px;">RuinScams.com Scam Tracker</p>
  </div>
  <div style="padding:32px;">
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="padding:8px 0;border-bottom:1px solid #f0f0f0;color:#333;font-size:14px;"><strong>Phone Number:</strong> ${payload.phoneNumber}</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #f0f0f0;color:#333;font-size:14px;"><strong>Category:</strong> ${payload.category}</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #f0f0f0;color:#333;font-size:14px;"><strong>How Contacted:</strong> ${payload.howContacted}</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #f0f0f0;color:#333;font-size:14px;"><strong>Incident Date:</strong> ${payload.incidentDate}</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #f0f0f0;color:#333;font-size:14px;"><strong>Amount Lost:</strong> ${payload.moneyLost ? `$${payload.moneyLost}` : "Not specified"}</td></tr>
      ${htmlFileSection}
    </table>
    <div style="margin:20px 0;padding:16px;background:#fff8f8;border-left:4px solid #e53e3e;border-radius:4px;">
      <strong style="color:#333;font-size:13px;">Description:</strong>
      <p style="color:#555;font-size:14px;margin:8px 0 0;line-height:1.6;">${payload.description.replace(/\n/g, "<br>")}</p>
    </div>
    <div style="margin-top:20px;padding:16px;background:#f7f7f7;border-radius:6px;">
      <p style="color:#666;font-size:13px;margin:0;"><strong>Reporter:</strong> ${payload.reporterName || "Anonymous"}</p>
      <p style="color:#666;font-size:13px;margin:4px 0 0;"><strong>Email:</strong> ${payload.reporterEmail || "Not provided"}</p>
    </div>
  </div>
  <div style="padding:16px 32px;background:#f7f7f7;border-top:1px solid #e2e8f0;">
    <p style="color:#999;font-size:12px;margin:0;">This report was submitted via RuinScams.com and has been added to the Scam Tracker.</p>
  </div>
</div>`;

    await transporter.sendMail({
      from: smtpFrom,
      to: "report@ruinscams.com",
      subject: `[Scam Report] ${payload.category} — ${payload.phoneNumber}`,
      text: textBody,
      html: htmlBody,
    });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
