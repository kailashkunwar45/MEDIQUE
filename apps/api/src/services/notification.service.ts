import sgMail from '@sendgrid/mail';

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export class NotificationService {
  static async sendEmail(to: string, subject: string, text: string, html?: string) {
    if (!process.env.SENDGRID_API_KEY) {
      console.log('SendGrid API Key not found. Skipping email.');
      return;
    }

    const msg = {
      to,
      from: {
        email: process.env.EMAIL_FROM || 'no-reply@mediqueue.com',
        name: process.env.EMAIL_FROM_NAME || 'MediQueue',
      },
      subject,
      text,
      html: html || text,
    };

    try {
      await sgMail.send(msg);
      console.log(`Email sent to ${to}`);
    } catch (error: any) {
      console.error('Error sending email:', error.response?.body || error.message);
    }
  }

  static async sendSMS(to: string, message: string) {
    if (process.env.SMS_ENABLED !== 'true') {
      console.log(`SMS mock to ${to}: ${message}`);
      return;
    }
    // Twilio implementation would go here
    console.log(`Twilio SMS to ${to}: ${message}`);
  }

  static async sendWhatsApp(to: string, message: string) {
    console.log(`WhatsApp mock to ${to}: ${message}`);
    // Meta WhatsApp API implementation would go here
  }

  static async notifyAppointmentConfirmed(email: string, phone: string, appointmentDetails: any) {
    const subject = 'Appointment Confirmed - MediQueue';
    const content = `Your appointment for ${appointmentDetails.date} with Dr. ${appointmentDetails.doctorName} is confirmed. Your token number is ${appointmentDetails.tokenNumber}.`;
    
    await this.sendEmail(email, subject, content);
    await this.sendSMS(phone, content);
  }

  static async notifyNextInQueue(email: string, phone: string, doctorName: string) {
    const subject = 'You are next in queue - MediQueue';
    const content = `You are the next patient to be seen by Dr. ${doctorName}. Please proceed to the consultation room.`;
    
    await this.sendEmail(email, subject, content);
    await this.sendSMS(phone, content);
  }
}
