// ============================================================
// mailer.js
// Handles sending real emails using Gmail's SMTP server, via
// the Nodemailer library.
//
// HOW THIS WORKS:
// Gmail lets any app log in and send mail on your behalf, AS
// LONG AS you give it an "App Password" instead of your real
// Gmail password. You generated one of these in Google Account
// > Security > App Passwords. Paste that 16-character code into
// the GMAIL_APP_PASSWORD value below.
//
// SECURITY NOTE: In a real production app, you would NEVER type
// a password directly into a code file like this -- you'd use
// an "environment variable" instead (a way to keep secrets out
// of your source code). We're hardcoding it here only because
// this is a learning project and keeping it simple matters more
// right now. If you ever upload this code to GitHub publicly,
// remove your real password first.
// ============================================================

const nodemailer = require("nodemailer");

// ---- FILL THESE IN WITH YOUR OWN DETAILS ----
const GMAIL_ADDRESS      = process.env.GMAIL_ADDRESS;   // <-- your Gmail address
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;          // <-- the 16-char App Password (no spaces)

// "transporter" is Nodemailer's term for the object that actually
// connects to Gmail's mail server and sends messages through it.
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // false for port 587, true would be for port 465
  auth: {
    user: GMAIL_ADDRESS,
    pass: GMAIL_APP_PASSWORD
  }
});

// Sends a booking confirmation email.
// `booking` is the same object server.js builds after a booking
// is confirmed -- it already has movieTitle, timing, seats, etc.
async function sendBookingConfirmation(toEmail, booking) {
  const mailOptions = {
    from: `"CineFile" <${GMAIL_ADDRESS}>`,
    to: toEmail,
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

  // This actually connects to Gmail and sends the email.
  // It's async because it involves a real network request.
  await transporter.sendMail(mailOptions);
}

module.exports = { sendBookingConfirmation };
