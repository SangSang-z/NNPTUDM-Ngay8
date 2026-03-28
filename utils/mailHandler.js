const nodemailer = require('nodemailer');

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.MAIL_HOST || 'sandbox.smtp.mailtrap.io',
    port: Number(process.env.MAIL_PORT || 2525),
    auth: {
      user: process.env.MAIL_USER || '',
      pass: process.env.MAIL_PASS || '',
    },
  });
};

const sendPasswordMail = async ({ to, username, password }) => {
  const transporter = createTransporter();

  return transporter.sendMail({
    from: process.env.MAIL_FROM || 'no-reply@example.com',
    to,
    subject: 'Thong tin tai khoan cua ban',
    text: `Xin chao ${username},\n\nTai khoan cua ban da duoc tao thanh cong.\nUsername: ${username}\nPassword: ${password}\n\nVui long doi mat khau sau khi dang nhap.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h3>Tao tai khoan thanh cong</h3>
        <p>Xin chao <strong>${username}</strong>,</p>
        <p>Tai khoan cua ban da duoc tao thanh cong.</p>
        <p><strong>Username:</strong> ${username}</p>
        <p><strong>Password:</strong> ${password}</p>
        <p>Vui long doi mat khau sau khi dang nhap.</p>
      </div>
    `,
  });
};

module.exports = {
  sendPasswordMail,
};
