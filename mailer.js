// ============================================================
// mailer.js  (SendGrid version)
//
// WHY THIS CHANGED FROM NODEMAILER:
// The original version used Nodemailer to connect directly to
// Gmail over SMTP (port 465, then port 587). That worked fine
// locally, but failed on Render's free tier with a connection
// timeout every time. This wasn't a bug in the code -- Render's
// free web services block ALL outbound traffic to SMTP ports
// (25, 465, 587), on every region, with no exception for valid
// credentials. There was no SMTP-based fix available on the
// free tier.
//
// SendGrid avoids this entirely because it doesn't use SMTP at
// all from our side -- it sends mail over a normal HTTPS POST
// request to SendGrid's API, the same way fetch() talks to our
// own /api/bookings route. HTTPS traffic is never blocked, so
// this works on Render's free tier without any restriction.
// ============================================================

const sgMail = require("@sendgrid/mail");

// ---- FILL THESE IN ----
// SENDGRID_API_KEY: generated in SendGrid under Settings > API Keys
// SENDER_EMAIL: the address you verified as a "Single Sender" in
//               SendGrid -- this MUST match exactly, or SendGrid
//               rejects the send with a 403 Forbidden error.
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDER_EMAIL      = process.env.SENDER_EMAIL;

sgMail.setApiKey(SENDGRID_API_KEY);

// Sends a booking confirmation email.
// `booking` is the same object server.js builds after a booking
// is confirmed -- it already has movieTitle, timing, seats, etc.
async function sendBookingConfirmation(toEmail, booking) {
  const msg = {
    to: toEmail,
    from: SENDER_EMAIL, // must match your verified Single Sender in SendGrid
    subject: `Booking Confirmed - ${booking.movieTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #a87cc0;">Booking Confirmed!</h2>
        <p>Hi ${booking.username},</p>
        <p>Your tickets for <strong>${booking.movieTitle}</strong> are booked. Here are your details:</p>
        <table style="width:100%; border-collapse: collapse; margin-top: 12px;">
          <tr><td style="padding:6px 0;"><strong>Show Time</strong></td><td>${booking.timing}</td></tr>
          <tr><td style="padding:6px 0;"><strong>Seats</strong></td><td>${booking.seats}</td></tr>
          <tr><td style="padding:6px 0;"><strong>Total Paid</strong></td><td>Rs. ${booking.total}</td></tr>
          <tr><td style="padding:6px 0;"><strong>Date</strong></td><td>${booking.date} at ${booking.time}</td></tr>
          <tr><td style="padding:6px 0;"><strong>Booking ID</strong></td><td>#${booking.id}</td></tr>
        </table>
        <p style="margin-top:20px; color:#777; font-size:0.9rem;">Thanks for booking with CineFile. Enjoy the movie!</p>
      </div>
    `
  };

  // sgMail.send() makes an HTTPS request to SendGrid's API and
  // resolves once SendGrid has accepted the email for delivery.
  // This is async because it's a real network request, same as
  // the old transporter.sendMail() call was.
  await sgMail.send(msg);
}

module.exports = { sendBookingConfirmation };
