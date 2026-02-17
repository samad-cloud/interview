'use server';

import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { generateDossier } from './generateDossier';

const INTERVIEW_BASE_URL = 'https://printerpix-recruitment.vercel.app/interview';
const ROUND2_BASE_URL = 'https://printerpix-recruitment.vercel.app/round2';
const COMPANY_NAME = 'Printerpix';

interface SendInviteResult {
  success: boolean;
  error?: string;
}

// Initialize Gmail API using OAuth2 credentials from environment
function getGmailService() {
  const tokenJson = process.env.GOOGLE_TOKEN_JSON;
  const credentialsJson = process.env.GOOGLE_CREDENTIALS_JSON;

  console.log('[Gmail Init] GOOGLE_TOKEN_JSON present:', !!tokenJson, '| length:', tokenJson?.length ?? 0);
  console.log('[Gmail Init] GOOGLE_CREDENTIALS_JSON present:', !!credentialsJson, '| length:', credentialsJson?.length ?? 0);

  if (!tokenJson || !credentialsJson) {
    console.log('[Gmail Init] MISSING env vars — cannot initialize Gmail');
    return null;
  }

  try {
    const token = JSON.parse(tokenJson);
    const credentials = JSON.parse(credentialsJson);
    const clientConfig = credentials.installed || credentials.web || {};

    console.log('[Gmail Init] Credential type:', credentials.installed ? 'installed (desktop)' : credentials.web ? 'web' : 'unknown');
    console.log('[Gmail Init] Client ID:', clientConfig.client_id?.slice(0, 20) + '...');
    console.log('[Gmail Init] Has client_secret:', !!clientConfig.client_secret);
    console.log('[Gmail Init] Has access_token:', !!token.token);
    console.log('[Gmail Init] Has refresh_token:', !!token.refresh_token);
    console.log('[Gmail Init] Token expiry:', token.expiry || token.expiry_date || 'not set');

    const oauth2Client = new google.auth.OAuth2(
      clientConfig.client_id,
      clientConfig.client_secret,
      'http://localhost'
    );

    oauth2Client.setCredentials({
      access_token: token.token,
      refresh_token: token.refresh_token,
      token_type: 'Bearer',
    });

    console.log('[Gmail Init] OAuth2 client created successfully');
    return google.gmail({ version: 'v1', auth: oauth2Client });
  } catch (error) {
    console.error('[Gmail Init] Failed to initialize:', error);
    return null;
  }
}

// Create email message for Gmail API
function createEmail(to: string, subject: string, htmlBody: string): string {
  const emailLines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    htmlBody,
  ];
  
  const email = emailLines.join('\r\n');
  return Buffer.from(email).toString('base64url');
}

export async function sendInterviewInvite(candidateId: number): Promise<SendInviteResult> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return { success: false, error: 'Supabase not configured' };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch candidate with job info
    const { data: candidate, error: fetchError } = await supabase
      .from('candidates')
      .select('email, full_name, interview_token, job_id')
      .eq('id', candidateId)
      .single();

    if (fetchError || !candidate) {
      return { success: false, error: 'Candidate not found' };
    }

    if (!candidate.interview_token) {
      return { success: false, error: 'No interview token found' };
    }

    // Get job title
    let jobTitle = 'Open Position';
    if (candidate.job_id) {
      const { data: job } = await supabase
        .from('jobs')
        .select('title')
        .eq('id', candidate.job_id)
        .single();
      if (job) {
        jobTitle = job.title;
      }
    }

    const interviewLink = `${INTERVIEW_BASE_URL}/${candidate.interview_token}`;

    // Send email via Gmail API
    console.log(`[Send Invite] Attempting to send Round 1 invite to ${candidate.email} (candidate ${candidateId})`);
    console.log(`[Send Invite] Job: "${jobTitle}" | Token: ${candidate.interview_token?.slice(0, 8)}...`);
    console.log(`[Send Invite] Interview link: ${interviewLink}`);

    const gmail = getGmailService();
    if (gmail) {
      try {
        const htmlBody = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#f4f4f5; font-family:Arial, Helvetica, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5; padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden; max-width:600px;">
          <tr>
            <td style="background-color:#1e293b; padding:24px 32px;">
              <h1 style="margin:0; color:#ffffff; font-size:20px; font-weight:600;">${COMPANY_NAME}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 20px; color:#1e293b; font-size:17px; font-weight:600; line-height:1.5;">
                Ready for a different kind of interview?
              </p>
              <p style="margin:0 0 16px; color:#374151; font-size:15px; line-height:1.6;">
                Hi ${candidate.full_name},
              </p>
              <p style="margin:0 0 16px; color:#374151; font-size:15px; line-height:1.6;">
                At ${COMPANY_NAME}, we're pioneering a better hiring process. To make our first conversation faster, fairer, and more focused on you, we use an AI assistant. This approach helps remove unconscious bias and allows you to interview in a low-pressure environment, at a time that suits your energy and schedule.
              </p>
              <p style="margin:0 0 16px; color:#374151; font-size:15px; line-height:1.6;">
                As one of the first companies to use this technology, we're excited to have you be a part of this new way of hiring. It's still in early development, so think of it as a helpful tool rather than a formal interrogator. Your experience will provide valuable feedback as we continue to improve.
              </p>
              <p style="margin:0 0 8px; color:#1e293b; font-size:15px; font-weight:600; line-height:1.6;">
                A key feature for you:
              </p>
              <p style="margin:0 0 20px; color:#374151; font-size:15px; line-height:1.6;">
                To give you plenty of time to collect your thoughts, you are in complete control. Click the button to begin recording your response, and simply click it again when you are finished. There are no timers, so you can be as thoughtful and detailed as you like.
              </p>
              <p style="margin:0 0 12px; color:#1e293b; font-size:15px; font-weight:600; line-height:1.6;">
                What to expect:
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
                <tr>
                  <td style="padding:4px 0 4px 16px; color:#374151; font-size:15px; line-height:1.6;">&bull;&nbsp; The interview has a fixed number of questions and typically takes 15&ndash;20 minutes.</td>
                </tr>
                <tr>
                  <td style="padding:4px 0 4px 16px; color:#374151; font-size:15px; line-height:1.6;">&bull;&nbsp; We'll ask about your experience and how you've handled specific situations.</td>
                </tr>
                <tr>
                  <td style="padding:4px 0 4px 16px; color:#374151; font-size:15px; line-height:1.6;">&bull;&nbsp; Every response is personally reviewed by our HR team. The AI helps us conduct the conversation, but real people evaluate your answers.</td>
                </tr>
                <tr>
                  <td style="padding:4px 0 4px 16px; color:#374151; font-size:15px; line-height:1.6;">&bull;&nbsp; If you complete this stage successfully, a member of our team will be in touch for a follow-up conversation.</td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 24px;">
                    <a href="${interviewLink}" target="_blank" style="display:inline-block; background-color:#1e3a5f; color:#ffffff; text-decoration:none; font-size:16px; font-weight:600; padding:14px 32px; border-radius:6px; min-height:44px; line-height:44px;">
                      Start Your Interview
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0; color:#6b7280; font-size:13px; line-height:1.5;">
                If you experience any issues, please email <a href="mailto:printerpix-recruitment@gmail.com" style="color:#1e3a5f; text-decoration:underline;">printerpix-recruitment@gmail.com</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f8fafc; padding:20px 32px; border-top:1px solid #e5e7eb;">
              <p style="margin:0; color:#6b7280; font-size:13px; line-height:1.5;">
                Best,<br>
                ${COMPANY_NAME} Recruiting<br>
                John Poole, Recruitment Manager
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

        const rawMessage = createEmail(
          candidate.email,
          `You're Invited - AI Interview for ${jobTitle} at ${COMPANY_NAME}`,
          htmlBody
        );

        console.log(`[Send Invite] Sending via Gmail API...`);
        const result = await gmail.users.messages.send({
          userId: 'me',
          requestBody: { raw: rawMessage },
        });

        console.log(`[Send Invite] SUCCESS — Gmail message ID: ${result.data.id}, threadId: ${result.data.threadId}`);
      } catch (emailError: unknown) {
        const err = emailError as { code?: number; message?: string; errors?: unknown[] };
        console.error('[Send Invite] Gmail FAILED:', {
          code: err.code,
          message: err.message,
          errors: err.errors,
          full: emailError,
        });
        return { success: false, error: `Gmail send failed: ${err.message || 'Unknown error'}` };
      }
    } else {
      console.log(`[Send Invite] No Gmail service available — skipping email send`);
    }

    // Update candidate status
    const { error: updateError } = await supabase
      .from('candidates')
      .update({ status: 'INVITE_SENT' })
      .eq('id', candidateId);

    if (updateError) {
      return { success: false, error: 'Failed to update status' };
    }

    return { success: true };
  } catch (error) {
    console.error('Send invite error:', error);
    return { success: false, error: 'Failed to send invite' };
  }
}

export async function inviteToRound2(candidateId: number): Promise<SendInviteResult> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return { success: false, error: 'Supabase not configured' };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch candidate with job info
    const { data: candidate, error: fetchError } = await supabase
      .from('candidates')
      .select('email, full_name, interview_token, job_id, rating')
      .eq('id', candidateId)
      .single();

    if (fetchError || !candidate) {
      return { success: false, error: 'Candidate not found' };
    }

    // Get job title
    let jobTitle = 'Open Position';
    if (candidate.job_id) {
      const { data: job } = await supabase
        .from('jobs')
        .select('title')
        .eq('id', candidate.job_id)
        .single();
      if (job) {
        jobTitle = job.title;
      }
    }

    const round2Link = `${ROUND2_BASE_URL}/${candidate.interview_token}`;

    // Generate dossier with probe questions from Round 1 transcript
    console.log(`[Round 2 Invite] Generating dossier for candidate ${candidateId}...`);
    const dossierResult = await generateDossier(String(candidateId));
    if (!dossierResult.success) {
      console.warn(`[Round 2 Invite] Dossier generation failed: ${dossierResult.error} - proceeding without dossier`);
    } else {
      console.log(`[Round 2 Invite] Generated ${dossierResult.dossier?.length || 0} probe questions`);
    }

    // Send email via Gmail API
    console.log(`[Round 2 Invite] Attempting to send Round 2 invite to ${candidate.email} (candidate ${candidateId})`);
    console.log(`[Round 2 Invite] Job: "${jobTitle}" | Rating: ${candidate.rating} | Token: ${candidate.interview_token?.slice(0, 8)}...`);
    console.log(`[Round 2 Invite] Round 2 link: ${round2Link}`);

    const gmail = getGmailService();
    if (gmail) {
      try {
        const htmlBody = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#f4f4f5; font-family:Arial, Helvetica, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5; padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden; max-width:600px;">
          <tr>
            <td style="background-color:#1e293b; padding:24px 32px;">
              <h1 style="margin:0; color:#ffffff; font-size:20px; font-weight:600;">${COMPANY_NAME}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px; color:#1e293b; font-size:16px; line-height:1.6;">
                Hi ${candidate.full_name},
              </p>
              <p style="margin:0 0 16px; color:#374151; font-size:15px; line-height:1.6;">
                Thank you for completing the first interview. We were impressed with your responses and would like to invite you to the next stage of our process.
              </p>
              <p style="margin:0 0 16px; color:#374151; font-size:15px; line-height:1.6;">
                The next step is a technical AI interview. This conversation will dive deeper into the specific skills and expertise required for the <strong>${jobTitle}</strong> role. Like the first interview, it's designed to be completed on your own schedule and will give you the opportunity to demonstrate your technical capabilities in detail.
              </p>
              <p style="margin:0 0 12px; color:#1e293b; font-size:15px; font-weight:600; line-height:1.6;">
                What to expect:
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
                <tr>
                  <td style="padding:4px 0 4px 16px; color:#374151; font-size:15px; line-height:1.6;">&bull;&nbsp; The format is similar to the first interview &mdash; an AI-guided conversation where you control the pace.</td>
                </tr>
                <tr>
                  <td style="padding:4px 0 4px 16px; color:#374151; font-size:15px; line-height:1.6;">&bull;&nbsp; You'll be asked questions related to your approach to problem-solving, technical challenges you've faced, and your expertise relevant to the role.</td>
                </tr>
                <tr>
                  <td style="padding:4px 0 4px 16px; color:#374151; font-size:15px; line-height:1.6;">&bull;&nbsp; Remember to click the button to start recording your response, and click it again when you're finished. Take your time to think through your answers.</td>
                </tr>
                <tr>
                  <td style="padding:4px 0 4px 16px; color:#374151; font-size:15px; line-height:1.6;">&bull;&nbsp; The interview typically takes 15&ndash;20 minutes, depending on how detailed your responses are.</td>
                </tr>
              </table>
              <p style="margin:0 0 24px; color:#374151; font-size:15px; line-height:1.6;">
                If you perform well in this technical round, the final step is a conversation with our team, where we'll discuss the role in more depth and answer any questions you may have.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 24px;">
                    <a href="${round2Link}" target="_blank" style="display:inline-block; background-color:#1e3a5f; color:#ffffff; text-decoration:none; font-size:16px; font-weight:600; padding:14px 32px; border-radius:6px; min-height:44px; line-height:44px;">
                      Start Technical Interview
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0; color:#6b7280; font-size:13px; line-height:1.5;">
                If you experience any issues, please email <a href="mailto:printerpix-recruitment@gmail.com" style="color:#1e3a5f; text-decoration:underline;">printerpix-recruitment@gmail.com</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f8fafc; padding:20px 32px; border-top:1px solid #e5e7eb;">
              <p style="margin:0; color:#6b7280; font-size:13px; line-height:1.5;">
                Best,<br>
                ${COMPANY_NAME} Recruiting<br>
                John Poole, Recruitment Manager
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

        const rawMessage = createEmail(
          candidate.email,
          `Great news about your ${COMPANY_NAME} application`,
          htmlBody
        );

        console.log(`[Round 2 Invite] Sending via Gmail API...`);
        const result = await gmail.users.messages.send({
          userId: 'me',
          requestBody: { raw: rawMessage },
        });

        console.log(`[Round 2 Invite] SUCCESS — Gmail message ID: ${result.data.id}, threadId: ${result.data.threadId}`);
      } catch (emailError: unknown) {
        const err = emailError as { code?: number; message?: string; errors?: unknown[] };
        console.error('[Round 2 Invite] Gmail FAILED:', {
          code: err.code,
          message: err.message,
          errors: err.errors,
          full: emailError,
        });
        return { success: false, error: `Gmail send failed: ${err.message || 'Unknown error'}` };
      }
    } else {
      console.log(`[Round 2 Invite] No Gmail service available — skipping email send`);
    }

    // Update to round 2
    const { error: updateError } = await supabase
      .from('candidates')
      .update({ 
        current_stage: 'round_2',
        status: 'ROUND_2_INVITED'
      })
      .eq('id', candidateId);

    if (updateError) {
      return { success: false, error: 'Failed to update status' };
    }

    return { success: true };
  } catch (error) {
    console.error('Invite to round 2 error:', error);
    return { success: false, error: 'Failed to invite to round 2' };
  }
}
