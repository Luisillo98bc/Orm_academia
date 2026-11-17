import type { Metadata } from "next";
import Link from "next/link";
import { absoluteSiteUrl, getPublicSettings } from "@/lib/public-seo";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublicSettings();
  const academyName = settings?.academyName || "NTS KIDS";
  return {
    title: { absolute: `Política de Privacidad y Protección de Datos | ${academyName}` },
    description: `Política de privacidad y tratamiento de datos personales de ${academyName}.`,
    alternates: { canonical: absoluteSiteUrl("/privacy") },
  };
}

const sections = [
  ["Responsable y alcance", "Esta política aplica a Academia Virtual y a los servicios educativos ofrecidos por NTS KIDS S.A.C. Describe cómo tratamos los datos de visitantes, prospectos, estudiantes, docentes y personal administrativo."],
  ["Datos que podemos tratar", "Podemos tratar datos de identificación y contacto, información académica, datos de matrícula y pagos, archivos entregados para el aprendizaje, información de soporte y registros técnicos necesarios para proteger la plataforma. No solicitamos datos bancarios completos; los pagos se procesan por los canales habilitados."],
  ["Finalidades", "Usamos los datos para crear y administrar cuentas, prestar cursos, gestionar matrículas y certificados, responder solicitudes, enviar comunicaciones operativas, prevenir abusos, mantener la seguridad, cumplir obligaciones legales y medir de forma agregada el interés por nuestros programas cuando la persona acepta la analítica."],
  ["Base y consentimiento", "Tratamos los datos necesarios para prestar el servicio y atender solicitudes. Para comunicaciones comerciales y analítica no esencial solicitamos consentimiento cuando corresponde. Puedes retirar el consentimiento de analítica desde las preferencias del navegador; retirar el consentimiento no afecta los tratamientos necesarios para operar una cuenta o cumplir obligaciones legales."],
  ["Cookies y analítica", "Usamos cookies y almacenamiento estrictamente necesarios para sesión, seguridad y preferencias. La analítica comercial anónima se activa únicamente al aceptar analítica y registra eventos como visita a la landing, visita a un programa y avance hacia el checkout. No vendemos perfiles ni usamos publicidad comportamental en esta versión."],
  ["Proveedores y transferencias", "Para operar el servicio podemos utilizar infraestructura de alojamiento, almacenamiento de archivos, correo, Cloudflare para red y seguridad, MinIO para archivos y Google Identity Services si eliges iniciar sesión con Google. Cada proveedor recibe solo la información necesaria para su función."],
  ["Conservación y seguridad", "Conservamos la información durante el tiempo necesario para las finalidades descritas, la relación académica y las obligaciones legales. Aplicamos control de acceso, autenticación, auditoría, copias de seguridad, cifrado en tránsito y almacenamiento privado para archivos sensibles. Ningún sistema conectado a Internet puede garantizar riesgo cero."],
  ["Tus derechos", "Puedes solicitar acceso, rectificación, cancelación, oposición, información sobre el uso de tus datos o retiro del consentimiento, según corresponda. Utiliza el correo o canal de soporte publicado por la academia e indica el correo asociado a tu solicitud. Podremos pedir información razonable para verificar tu identidad."],
  ["Menores de edad", "Cuando el servicio involucre a una persona menor de edad, la inscripción y el tratamiento de datos deben realizarse con la autorización y supervisión de su padre, madre o representante legal cuando corresponda."],
  ["Cambios y contacto", "Podemos actualizar esta política para reflejar cambios legales, técnicos o del servicio. Publicaremos la nueva versión en esta página con su fecha de actualización. Para consultas de privacidad, usa el correo o canal de soporte configurado en la plataforma."],
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-5 py-16 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-8">
      <article className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-12">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-300">Academia Virtual</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Política de privacidad</h1>
        <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">Versión vigente: 5 de septiembre de 2026</p>
        <p className="mt-6 max-w-3xl text-sm leading-7 text-slate-700 dark:text-slate-200">Queremos que sepas qué información usamos, para qué la usamos y qué opciones tienes sobre ella. Este texto debe revisarse con asesoría legal antes de operar en jurisdicciones adicionales o tratar categorías especiales de datos.</p>
        <div className="mt-8 space-y-7 text-sm leading-7 text-slate-700 dark:text-slate-200">
          {sections.map(([title, body]) => (
            <section key={title}>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
              <p className="mt-2">{body}</p>
            </section>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap gap-5 text-sm font-semibold">
          <Link href="/terms" className="text-blue-700 underline dark:text-blue-300">Leer términos de uso</Link>
          <Link href="/" className="text-blue-700 underline dark:text-blue-300">Volver a la academia</Link>
        </div>
      </article>
    </div>
  );
}
