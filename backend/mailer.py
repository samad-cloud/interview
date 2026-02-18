#!/usr/bin/env python3
"""The Voice: Sends Tally eligibility forms to Dubai candidates OR interview links to others."""

import os
import base64
from email.mime.text import MIMEText
from urllib.parse import quote

from utils import get_supabase_client, get_gmail_service, log

# --- Configuration ---
COMPANY_NAME = "Printerpix"
MIN_SCORE = 70
INTERVIEW_BASE_URL = "https://printerpix-recruitment.vercel.app/interview"
TALLY_FORM_ID = os.environ.get("TALLY_FORM_ID", "")

# Dubai eligibility email (HTML with Tally CTA button)
DUBAI_EMAIL_SUBJECT = f"Your application to {COMPANY_NAME}: Let's explore a fit"

DUBAI_EMAIL_HTML = """<!DOCTYPE html>
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
          <!-- Header -->
          <tr>
            <td style="background-color:#1e293b; padding:24px 32px;">
              <h1 style="margin:0; color:#ffffff; font-size:20px; font-weight:600;">{company_name}</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px; color:#1e293b; font-size:16px; line-height:1.6;">
                Hi {full_name},
              </p>
              <p style="margin:0 0 16px; color:#374151; font-size:15px; line-height:1.6;">
                Thank you for applying to {company_name}. We've received your application, and we're excited by the possibility of you joining our team in Dubai.
              </p>
              <p style="margin:0 0 16px; color:#374151; font-size:15px; line-height:1.6;">
                Our goal is to create a hiring experience that is quick, respectful, and gives every candidate a fair opportunity to be heard. Our first step is a straightforward, two-part online process designed to get to know you better.
              </p>
              <p style="margin:0 0 8px; color:#374151; font-size:15px; line-height:1.6;">
                <strong>Part 1:</strong> A few quick questions to align on logistics for our Dubai office.
              </p>
              <p style="margin:0 0 16px; color:#374151; font-size:15px; line-height:1.6;">
                <strong>Part 2:</strong> An interactive AI-guided chat where you can share your experience in your own words.
              </p>
              <p style="margin:0 0 16px; color:#374151; font-size:15px; line-height:1.6;">
                The entire first step takes about 20&ndash;30 minutes and can be completed on your own schedule. Please note that successful completion of this stage will be followed by a technical interview and a final conversation with the team.
              </p>
              <p style="margin:0 0 16px; color:#374151; font-size:15px; line-height:1.6;">
                We're reviewing applications as they come in and moving quickly with strong candidates. Completing this within the next few days ensures your application gets full consideration and helps us move you forward faster.
              </p>
              <p style="margin:0 0 24px; color:#374151; font-size:15px; line-height:1.6;">
                Before proceeding, please ensure you're comfortable with the salary range from the job description.
              </p>
              <p style="margin:0 0 16px; color:#1e293b; font-size:15px; font-weight:600; line-height:1.6;">
                Ready to begin?
              </p>
              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 24px;">
                    <a href="{tally_url}" target="_blank" style="display:inline-block; background-color:#1e3a5f; color:#ffffff; text-decoration:none; font-size:16px; font-weight:600; padding:14px 32px; border-radius:6px; min-height:44px; line-height:44px;">
                      Let's Get Started
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0; color:#6b7280; font-size:13px; line-height:1.5;">
                If you experience any issues, please email <a href="mailto:printerpix-recruitment@gmail.com" style="color:#1e3a5f; text-decoration:underline;">printerpix-recruitment@gmail.com</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc; padding:20px 32px; border-top:1px solid #e5e7eb;">
              <p style="margin:0; color:#6b7280; font-size:13px; line-height:1.5;">
                Best,<br>
                {company_name} Recruiting<br>
                John Poole, Recruitment Manager
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

# Direct interview invite (non-Dubai, also used for Dubai candidates who pass Tally)
INVITE_EMAIL_SUBJECT = f"You're Invited - AI Interview with {COMPANY_NAME}"

INVITE_EMAIL_HTML = """<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Interview Invitation – {company_name}</title>
</head>
<body style="margin:0; padding:0; background-color:#faf5f7; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; -webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#faf5f7; padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; max-width:600px; box-shadow:0 4px 24px rgba(195,3,97,0.08);">

          <!-- Header -->
          <tr>
            <td style="background-color:#c30361; padding:28px 36px;">
              <h1 style="margin:0; color:#ffffff; font-size:22px; font-weight:700; letter-spacing:0.5px;">{company_name}</h1>
            </td>
          </tr>

          <!-- Welcome heading -->
          <tr>
            <td style="padding:32px 36px 24px;">
              <p style="margin:0; color:#c30361; font-size:22px; font-weight:700; line-height:1.4;">
                Ready for a different kind of interview?
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:8px 36px 32px;">

              <!-- Greeting -->
              <p style="margin:0 0 18px; color:#1f2937; font-size:15px; line-height:1.7;">
                Hi {full_name},
              </p>

              <p style="margin:0 0 18px; color:#374151; font-size:15px; line-height:1.7;">
                At {company_name}, we're pioneering a better hiring process. To make our first conversation faster, fairer, and more focused on you, we use an AI assistant. This approach helps remove unconscious bias and allows you to interview in a low-pressure environment, at a time that suits your energy and schedule.
              </p>

              <p style="margin:0 0 24px; color:#374151; font-size:15px; line-height:1.7;">
                As one of the first companies to use this technology, we're excited to have you be a part of this new way of hiring. It's still in early development, so think of it as a helpful tool rather than a formal interrogator. Your experience will provide valuable feedback as we continue to improve.
              </p>

              <!-- Divider -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="border-top:2px solid #fce7f0;">&nbsp;</td>
                </tr>
              </table>

              <!-- What to expect -->
              <p style="margin:0 0 16px; color:#c30361; font-size:16px; font-weight:700; line-height:1.5;">
                What to expect
              </p>

              <!-- Bullet points -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                <tr>
                  <td style="padding:4px 0 4px 16px; color:#374151; font-size:15px; line-height:1.7;">&bull;&nbsp; The interview has a fixed number of questions and typically takes 15&ndash;20 minutes.</td>
                </tr>
                <tr>
                  <td style="padding:4px 0 4px 16px; color:#374151; font-size:15px; line-height:1.7;">&bull;&nbsp; We'll ask about your experience and how you've handled specific situations.</td>
                </tr>
                <tr>
                  <td style="padding:4px 0 4px 16px; color:#374151; font-size:15px; line-height:1.7;">&bull;&nbsp; Every response is personally reviewed by our HR team. The AI helps us conduct the conversation, but real people evaluate your answers.</td>
                </tr>
                <tr>
                  <td style="padding:4px 0 4px 16px; color:#374151; font-size:15px; line-height:1.7;">&bull;&nbsp; If you complete this stage successfully, a member of our team will be in touch for a follow-up conversation.</td>
                </tr>
              </table>

              <p style="margin:0 0 12px; color:#374151; font-size:15px; line-height:1.7;">
                We're moving quickly with qualified candidates, so completing this today or tomorrow helps keep your application on the fast track.
              </p>
              <p style="margin:0 0 28px; color:#374151; font-size:15px; line-height:1.7;">
                Our advice? Don't overthink it. Find a quiet spot, relax, and let your experience speak for itself.
              </p>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:4px 0 28px;">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="{interview_link}" style="height:52px;v-text-anchor:middle;width:280px;" arcsize="12%" strokecolor="#a00250" fillcolor="#c30361">
                    <w:anchorlock/>
                    <center style="color:#ffffff;font-family:'Segoe UI',Tahoma,sans-serif;font-size:16px;font-weight:bold;">Start Your Interview &rarr;</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="{interview_link}" target="_blank" style="display:inline-block; background-color:#c30361; color:#ffffff; text-decoration:none; font-size:16px; font-weight:700; padding:16px 40px; border-radius:8px; line-height:1; letter-spacing:0.3px; border-bottom:3px solid #a00250;">
                      Start Your Interview &rarr;
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>

              <p style="margin:0; color:#6b7280; font-size:13px; line-height:1.5;">
                If you experience any issues, please email <a href="mailto:printerpix-recruitment@gmail.com" style="color:#c30361; text-decoration:underline;">printerpix-recruitment@gmail.com</a>
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#1f2937; padding:24px 36px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0 0 6px; color:#ffffff; font-size:14px; font-weight:600;">
                      Best,
                    </p>
                    <p style="margin:0 0 4px; color:rgba(255,255,255,0.85); font-size:13px; line-height:1.5;">
                      {company_name} Recruiting
                    </p>
                    <p style="margin:0; color:rgba(255,255,255,0.6); font-size:13px; line-height:1.5;">
                      John Poole, Recruitment Manager
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def fetch_top_candidates(supabase):
    """Fetch graded candidates with score >= MIN_SCORE, joining jobs.location for Dubai detection.
    Only fetches candidates with created_at set (excludes old/legacy candidates)."""
    result = (
        supabase.table("candidates")
        .select("id, email, full_name, jd_match_score, interview_token, job_id, jobs(location)")
        .eq("status", "GRADED")
        .gte("jd_match_score", MIN_SCORE)
        .not_.is_("created_at", "null")
        .execute()
    )
    return result.data


def is_dubai_role(candidate: dict) -> bool:
    """Check if the candidate's job is based in Dubai using jobs.location."""
    job = candidate.get("jobs")
    if not job:
        return False
    location = (job.get("location") or "").lower()
    return "dubai" in location


def create_email(to_email: str, subject: str, body: str, html: bool = False) -> dict:
    """Create an email message for the Gmail API."""
    subtype = "html" if html else "plain"
    message = MIMEText(body, subtype)
    message["to"] = to_email
    message["subject"] = subject

    raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode("utf-8")
    return {"raw": raw_message}


def send_dubai_questionnaire(gmail_service, email: str, full_name: str, interview_token: str):
    """Send the Dubai eligibility form email with Tally CTA button."""
    encoded_name = quote(full_name)
    tally_url = f"https://tally.so/r/{TALLY_FORM_ID}?interview_token={interview_token}&candidate_name={encoded_name}"
    body = DUBAI_EMAIL_HTML.format(
        full_name=full_name,
        company_name=COMPANY_NAME,
        tally_url=tally_url
    )
    message = create_email(email, DUBAI_EMAIL_SUBJECT, body, html=True)
    gmail_service.users().messages().send(userId="me", body=message).execute()


def send_interview_invite(gmail_service, email: str, full_name: str, interview_token: str):
    """Send direct interview invite with secure token link."""
    interview_link = f"{INTERVIEW_BASE_URL}/{interview_token}"
    body = INVITE_EMAIL_HTML.format(
        full_name=full_name,
        interview_link=interview_link,
        company_name=COMPANY_NAME
    )
    message = create_email(email, INVITE_EMAIL_SUBJECT, body, html=True)
    gmail_service.users().messages().send(userId="me", body=message).execute()


def update_candidate_status(supabase, candidate_id: int, status: str):
    """Update candidate status."""
    supabase.table("candidates").update({
        "status": status
    }).eq("id", candidate_id).execute()


def fetch_form_completed_candidates(supabase):
    """Fetch Dubai candidates who passed the Tally eligibility form and need interview invites."""
    result = (
        supabase.table("candidates")
        .select("id, email, full_name, interview_token")
        .eq("status", "FORM_COMPLETED")
        .not_.is_("created_at", "null")
        .execute()
    )
    return result.data


def run_mailer() -> tuple[int, int]:
    """
    Main mailer function - can be called from other modules.
    Returns tuple of (dubai_forms_sent, interview_invites_sent).
    """
    log("INFO", "Starting outreach to top candidates...")

    supabase = get_supabase_client()
    gmail_service = get_gmail_service()

    dubai_sent, invites_sent, failed = 0, 0, 0

    # --- Phase 1: Send interview invites to Dubai candidates who passed Tally form ---
    form_completed = fetch_form_completed_candidates(supabase)
    if form_completed:
        log("INFO", f"Found {len(form_completed)} Dubai candidate(s) who passed eligibility form")

    for candidate in form_completed:
        try:
            email = candidate["email"]
            full_name = candidate.get("full_name", "Candidate")
            interview_token = candidate.get("interview_token")
            candidate_id = candidate["id"]

            if not interview_token:
                log("WARN", f"No interview_token for {email}, skipping")
                failed += 1
                continue

            log("INFO", f"Sending interview invite to eligible Dubai candidate {email}")
            send_interview_invite(gmail_service, email, full_name, interview_token)
            update_candidate_status(supabase, candidate_id, "INVITE_SENT")
            log("SUCCESS", f"Interview invite sent to {email}")
            invites_sent += 1

        except Exception as e:
            log("ERROR", f"Failed to process {candidate.get('email', 'unknown')}: {e}")
            failed += 1

    # --- Phase 2: Process newly graded candidates ---
    candidates = fetch_top_candidates(supabase)
    log("INFO", f"Found {len(candidates)} candidate(s) with score >= {MIN_SCORE}")

    for candidate in candidates:
        try:
            email = candidate["email"]
            full_name = candidate.get("full_name", "Candidate")
            score = candidate.get("jd_match_score", 0)
            interview_token = candidate.get("interview_token")
            candidate_id = candidate["id"]

            if not interview_token:
                log("WARN", f"No interview_token for {email}, skipping")
                failed += 1
                continue

            if is_dubai_role(candidate):
                # Dubai role → Send Tally eligibility form
                log("INFO", f"Dubai role detected for {email} (score: {score})")
                send_dubai_questionnaire(gmail_service, email, full_name, interview_token)
                update_candidate_status(supabase, candidate_id, "QUESTIONNAIRE_SENT")
                log("SUCCESS", f"Dubai eligibility form sent to {email}")
                dubai_sent += 1
            else:
                # Non-Dubai role → Send interview link directly
                log("INFO", f"Non-Dubai role for {email} (score: {score}) - sending interview invite")
                send_interview_invite(gmail_service, email, full_name, interview_token)
                update_candidate_status(supabase, candidate_id, "INVITE_SENT")
                log("SUCCESS", f"Interview invite sent to {email}")
                invites_sent += 1

        except Exception as e:
            log("ERROR", f"Failed to process {candidate.get('email', 'unknown')}: {e}")
            failed += 1

    log("INFO", f"Outreach complete: {dubai_sent} eligibility forms, {invites_sent} interview invites, {failed} failed")
    return (dubai_sent, invites_sent)


def main():
    """Entry point when run directly."""
    run_mailer()


if __name__ == "__main__":
    main()
