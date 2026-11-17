import 'dotenv/config';
import nodemailer from 'nodemailer';

const verifyOnly = process.argv.includes('--verify-only');
const recipient = process.argv.includes('--self')
  ? process.env.MAIL_FROM
  : process.argv.slice(2).find((arg) => !arg.startsWith('--')) ||
    process.env.MAIL_TEST_TO;
const required = [
  'MAIL_HOST',
  'MAIL_PORT',
  'MAIL_USER',
  'MAIL_PASS',
  'MAIL_FROM',
];
const missing = required.filter((name) => !process.env[name]);

if (missing.length > 0) {
  console.error(`Faltan variables SMTP: ${missing.join(', ')}`);
  process.exitCode = 1;
} else if (!verifyOnly && !recipient) {
  console.error(
    'Indica un destinatario: npm run test:smtp -- correo@dominio.com',
  );
  process.exitCode = 1;
} else {
  const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT),
    secure: Number(process.env.MAIL_PORT) === 465,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });

  try {
    await transporter.verify();
    console.log('SMTP verificado');
    if (!verifyOnly) {
      const result = await transporter.sendMail({
        from: process.env.MAIL_FROM,
        to: recipient,
        subject: '[Prueba] Academia Virtual — SMTP operativo',
        text: 'Este correo confirma que las alertas automáticas de Academia Virtual pueden enviarse correctamente.',
        html: '<p>Este correo confirma que las alertas automáticas de <strong>Academia Virtual</strong> pueden enviarse correctamente.</p>',
      });
      if (!result.accepted?.length || result.rejected?.length) {
        throw new Error('El servidor no aceptó todos los destinatarios');
      }
      console.log('Correo de prueba aceptado por el servidor SMTP');
    }
  } catch (error) {
    console.error(
      `La prueba SMTP falló: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  } finally {
    transporter.close();
  }
}
