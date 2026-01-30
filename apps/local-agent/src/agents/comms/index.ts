import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import * as fs from 'fs/promises';
import * as path from 'path';

const DATA_DIR = process.env.DATA_DIR || path.join(process.env.HOME || '', '.whatsapp-agents');

interface Email {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  date: number;
  read: boolean;
}

export class CommsAgent {
  private oauth2Client: any;
  private gmail: any;
  private initialized = false;

  constructor() {
    this.initGmail();
  }

  private async initGmail() {
    if (
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REFRESH_TOKEN
    ) {
      const { OAuth2 } = google.auth;
      this.oauth2Client = new OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        'https://developers.google.com/oauthplayground'
      );

      this.oauth2Client.setCredentials({
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      });

      this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
      this.initialized = true;
    }
  }

  async execute(tool: string, args: Record<string, unknown>): Promise<unknown> {
    switch (tool) {
      case 'email_send':
        return this.sendEmail(
          args.to as string,
          args.subject as string,
          args.body as string,
          args.cc as string
        );
      case 'email_list':
        return this.listEmails(
          args.folder as string,
          args.unreadOnly as boolean,
          args.limit as number
        );
      case 'email_read':
        return this.readEmail(args.emailId as string);
      case 'email_reply':
        return this.replyEmail(args.emailId as string, args.body as string);
      case 'email_draft':
        return this.createDraft(args.to as string, args.subject as string, args.body as string);
      default:
        throw new Error(`Unknown comms tool: ${tool}`);
    }
  }

  private async sendEmail(to: string, subject: string, body: string, cc?: string): Promise<object> {
    if (this.initialized && this.gmail) {
      // Usar Gmail API
      const message = this.createMessage(to, subject, body, cc);

      const response = await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: message,
        },
      });

      return {
        sent: true,
        messageId: response.data.id,
        to,
        subject,
      };
    }

    // Fallback: guardar en archivo local (modo demo)
    const emailsFile = path.join(DATA_DIR, 'sent_emails.json');
    let emails: Email[] = [];

    try {
      const data = await fs.readFile(emailsFile, 'utf-8');
      emails = JSON.parse(data);
    } catch {
      emails = [];
    }

    const email: Email = {
      id: crypto.randomUUID(),
      from: 'me',
      to,
      subject,
      body,
      date: Date.now(),
      read: true,
    };

    emails.push(email);
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(emailsFile, JSON.stringify(emails, null, 2));

    return {
      sent: true,
      mode: 'local',
      email: {
        id: email.id,
        to,
        subject,
      },
      note: 'Email saved locally. Configure Google OAuth for real sending.',
    };
  }

  private async listEmails(folder?: string, unreadOnly?: boolean, limit?: number): Promise<object> {
    if (this.initialized && this.gmail) {
      let query = '';

      if (folder === 'inbox' || !folder) {
        query = 'in:inbox';
      } else if (folder === 'sent') {
        query = 'in:sent';
      } else if (folder === 'drafts') {
        query = 'in:drafts';
      }

      if (unreadOnly) {
        query += ' is:unread';
      }

      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: limit || 10,
      });

      const messages = response.data.messages || [];
      const emails: any[] = [];

      for (const msg of messages.slice(0, limit || 10)) {
        const detail = await this.gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'metadata',
          metadataHeaders: ['Subject', 'From', 'Date'],
        });

        const headers = detail.data.payload?.headers || [];
        const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
        const from = headers.find((h: any) => h.name === 'From')?.value || '';
        const date = headers.find((h: any) => h.name === 'Date')?.value || '';

        emails.push({
          id: msg.id,
          from,
          subject,
          date,
          snippet: detail.data.snippet,
          unread: detail.data.labelIds?.includes('UNREAD'),
        });
      }

      return {
        folder: folder || 'inbox',
        emails,
        total: response.data.resultSizeEstimate,
      };
    }

    // Fallback: modo demo
    return {
      folder: folder || 'inbox',
      emails: [],
      note: 'Configure Google OAuth to list real emails.',
    };
  }

  private async readEmail(emailId: string): Promise<object> {
    if (this.initialized && this.gmail) {
      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id: emailId,
        format: 'full',
      });

      const headers = response.data.payload?.headers || [];
      const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
      const from = headers.find((h: any) => h.name === 'From')?.value || '';
      const to = headers.find((h: any) => h.name === 'To')?.value || '';
      const date = headers.find((h: any) => h.name === 'Date')?.value || '';

      // Extraer cuerpo
      let body = '';
      const payload = response.data.payload;

      if (payload?.body?.data) {
        body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
      } else if (payload?.parts) {
        for (const part of payload.parts) {
          if (part.mimeType === 'text/plain' && part.body?.data) {
            body = Buffer.from(part.body.data, 'base64').toString('utf-8');
            break;
          }
        }
      }

      return {
        id: emailId,
        from,
        to,
        subject,
        date,
        body: body.substring(0, 5000),
        truncated: body.length > 5000,
      };
    }

    throw new Error('Email reading requires Google OAuth configuration');
  }

  private async replyEmail(emailId: string, body: string): Promise<object> {
    if (this.initialized && this.gmail) {
      // Obtener email original
      const original = await this.gmail.users.messages.get({
        userId: 'me',
        id: emailId,
        format: 'metadata',
        metadataHeaders: ['Subject', 'From', 'Message-ID'],
      });

      const headers = original.data.payload?.headers || [];
      const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
      const from = headers.find((h: any) => h.name === 'From')?.value || '';
      const messageId = headers.find((h: any) => h.name === 'Message-ID')?.value || '';

      // Extraer email del "from"
      const toEmail = from.match(/<(.+)>/)?.pop() || from;

      const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;
      const message = this.createMessage(toEmail, replySubject, body, undefined, messageId, original.data.threadId);

      const response = await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: message,
          threadId: original.data.threadId,
        },
      });

      return {
        sent: true,
        messageId: response.data.id,
        inReplyTo: emailId,
        to: toEmail,
        subject: replySubject,
      };
    }

    throw new Error('Email reply requires Google OAuth configuration');
  }

  private async createDraft(to: string, subject: string, body: string): Promise<object> {
    if (this.initialized && this.gmail) {
      const message = this.createMessage(to, subject, body);

      const response = await this.gmail.users.drafts.create({
        userId: 'me',
        requestBody: {
          message: {
            raw: message,
          },
        },
      });

      return {
        created: true,
        draftId: response.data.id,
        to,
        subject,
      };
    }

    // Fallback: guardar localmente
    const draftsFile = path.join(DATA_DIR, 'drafts.json');
    let drafts: Email[] = [];

    try {
      const data = await fs.readFile(draftsFile, 'utf-8');
      drafts = JSON.parse(data);
    } catch {
      drafts = [];
    }

    const draft: Email = {
      id: crypto.randomUUID(),
      from: 'me',
      to,
      subject,
      body,
      date: Date.now(),
      read: false,
    };

    drafts.push(draft);
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(draftsFile, JSON.stringify(drafts, null, 2));

    return {
      created: true,
      mode: 'local',
      draft: {
        id: draft.id,
        to,
        subject,
      },
    };
  }

  private createMessage(
    to: string,
    subject: string,
    body: string,
    cc?: string,
    inReplyTo?: string,
    threadId?: string
  ): string {
    const lines = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=utf-8',
      'MIME-Version: 1.0',
    ];

    if (cc) {
      lines.push(`Cc: ${cc}`);
    }

    if (inReplyTo) {
      lines.push(`In-Reply-To: ${inReplyTo}`);
      lines.push(`References: ${inReplyTo}`);
    }

    lines.push('', body);

    const message = lines.join('\r\n');
    return Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
}
