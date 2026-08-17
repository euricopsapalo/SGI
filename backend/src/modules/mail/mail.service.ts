import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { readSecret } from '../../config/read-secret';


@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);
    private transporter: nodemailer.Transporter;

    constructor() {
        this.transporter = nodemailer.createTransport({
            host:   process.env.MAIL_HOST   || 'smtp.gmail.com',
            port:   parseInt(process.env.MAIL_PORT || '587'),
            secure: process.env.MAIL_SECURE === 'true',
            auth: {
                user: process.env.MAIL_USER || '',
                pass: readSecret('MAIL_PASS') || '',
            },
        });
    }

    async sendPasswordReset(to: string, nome: string, token: string): Promise<void> {
        const from = process.env.MAIL_FROM || `"SGI — Aquatex" <${process.env.MAIL_USER}>`;

        const html = `
<!DOCTYPE html>
<html lang="pt">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F0F2F5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F2F5;padding:40px 0;">
    <tr><td align="center">
      <table width="420" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.10);">
        <!-- Header -->
        <tr>
          <td style="background:#2B2B2B;padding:28px 32px;text-align:center;">
            <svg viewBox="0 0 40 50" width="36" height="45" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto 10px;">
              <path d="M20 2 C20 2 5 19 5 31 C5 40.9 11.7 49 20 49 C28.3 49 35 40.9 35 31 C35 19 20 2 20 2Z" fill="#0D6EBF"/>
              <path d="M5 37 Q9.5 32.5 14.5 37 Q19.5 41.5 24.5 37 Q29.5 32.5 34 37 L34 49 L6 49Z" fill="rgba(255,255,255,0.16)"/>
              <polyline points="12,32 17,38.5 29,24" fill="none" stroke="white" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <p style="color:rgba(255,255,255,0.55);font-size:11px;letter-spacing:0.1em;text-transform:uppercase;margin:0;">Sistema de Gestão de Intervenções</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <h2 style="font-size:16px;font-weight:800;color:#1C1C1C;margin:0 0 12px;">Recuperação de Password</h2>
            <p style="font-size:13px;color:#555;margin:0 0 24px;">Olá <strong>${nome}</strong>,<br><br>
            Recebemos um pedido de recuperação de password para a sua conta no SGI — Aquatex.<br>
            Use o código abaixo para definir uma nova password:</p>
            <!-- Token box -->
            <div style="background:#F0F2F5;border:2px dashed #0D6EBF;border-radius:6px;padding:20px;text-align:center;margin:0 0 24px;">
              <p style="font-size:11px;color:#666;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.08em;">Código de recuperação</p>
              <span style="font-size:28px;font-weight:900;font-family:monospace;letter-spacing:0.25em;color:#0D6EBF;">${token}</span>
              <p style="font-size:11px;color:#999;margin:10px 0 0;">Válido durante <strong>1 hora</strong></p>
            </div>
            <p style="font-size:12px;color:#888;margin:0;">Se não solicitou esta recuperação, ignore este email. A sua password não será alterada.</p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#F7F8FA;padding:16px 32px;text-align:center;border-top:1px solid #E5E7EB;">
            <p style="font-size:11px;color:#aaa;margin:0;">© ${new Date().getFullYear()} AQUATEX, LDA — Sistema de Gestão de Intervenções</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

        try {
            await this.transporter.sendMail({
                from,
                to,
                subject: 'SGI Aquatex — Recuperação de Password',
                html,
            });
            this.logger.log(`Email de recuperação enviado para: ${to}`);
        } catch (err) {
            this.logger.error(`Falha ao enviar email para ${to}: ${err.message}`);
            throw err;
        }
    }
}
