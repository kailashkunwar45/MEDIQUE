const mail = require("@sendgrid/mail");
if (process.env.SENDGRID_API_KEY) {
  mail.setApiKey(process.env.SENDGRID_API_KEY);
}
class NotificationService {
  static async sendEmail(to, subject, text, html) {
    if (!process.env.SENDGRID_API_KEY) {
      console.log("SendGrid API Key not found. Skipping email.");
      return;
    }
    const msg = {
      to,
      from: {
        email: process.env.EMAIL_FROM || "no-reply@mediqueue.com",
        name: process.env.EMAIL_FROM_NAME || "MediQueue"
      },
      subject,
      text,
      html: html || text
    };
    try {
      await mail.send(msg);
      console.log(`Email sent to ${to}`);
    } catch (error) {
      console.error("Error sending email:", error.response?.body || error.message);
    }
  }
  static async sendSMS(to, message) {
    if (process.env.SMS_ENABLED !== "true") {
      console.log(`SMS mock to ${to}: ${message}`);
      return;
    }
    console.log(`Twilio SMS to ${to}: ${message}`);
  }
  static async sendWhatsApp(to, message) {
    console.log(`WhatsApp mock to ${to}: ${message}`);
  }
  static async notifyAppointmentConfirmed(email, phone, appointmentDetails) {
    const subject = "Appointment Confirmed - MediQueue";
    const content = `Your appointment for ${appointmentDetails.date} with Dr. ${appointmentDetails.doctorName} is confirmed. Your token number is ${appointmentDetails.tokenNumber}.`;
    await this.sendEmail(email, subject, content);
    await this.sendSMS(phone, content);
  }
  static async notifyNextInQueue(email, phone, doctorName) {
    const subject = "You are next in queue - MediQueue";
    const content = `You are the next patient to be seen by Dr. ${doctorName}. Please proceed to the consultation room.`;
    await this.sendEmail(email, subject, content);
    await this.sendSMS(phone, content);
  }
}

module.exports = {
  NotificationService: NotificationService,
};
