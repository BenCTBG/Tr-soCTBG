import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'ssl0.ovh.net',
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: EmailOptions): Promise<boolean> {
  // Skip if SMTP not configured
  if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    console.log(`[EMAIL] SMTP not configured, skipping: ${subject} → ${to}`);
    return false;
  }

  try {
    await transporter.sendMail({
      from: `"CTBG Trésorerie" <${process.env.SMTP_FROM || 'tresorerie@ctbg.fr'}>`,
      to,
      subject,
      html,
    });
    return true;
  } catch (error) {
    console.error('[EMAIL] Send failed:', error);
    return false;
  }
}
