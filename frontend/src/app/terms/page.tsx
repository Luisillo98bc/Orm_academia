import type { Metadata } from "next";
import Link from "next/link";
import { absoluteSiteUrl, getPublicSettings } from "@/lib/public-seo";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublicSettings();
  const academyName = settings?.academyName || "NTS KIDS";
  return {
    title: { absolute: `Términos y Condiciones del Servicio Educativo | ${academyName}` },
    description: `Términos y condiciones de uso de los programas, clases en vivo y campus virtual de ${academyName}.`,
    alternates: { canonical: absoluteSiteUrl("/terms") },
  };
}

const sections = [
  ["1. Aceptación", "Al crear una cuenta o utilizar la plataforma aceptas estos términos, la política de privacidad y las reglas específicas de cada programa. Si actúas en nombre de una persona menor, declaras contar con la autorización correspondiente."],
  ["2. Cuenta y seguridad", "Debes proporcionar información veraz, mantener tus credenciales bajo reserva y avisar de inmediato si detectas un acceso no autorizado. Cada cuenta es personal y no debe compartirse."],
  ["3. Servicios académicos", "La academia publica programas, cohortes, horarios, materiales y condiciones que pueden cambiar por razones académicas u operativas. El acceso depende de la matrícula, disponibilidad y cumplimiento de las reglas del programa."],
  ["4. Pagos y matrículas", "Las condiciones, importes, medios de pago y estados de matrícula se muestran antes de confirmar una operación. En pagos en efectivo, la matrícula queda sujeta a la validación administrativa indicada en la plataforma. Cualquier devolución se tramitará conforme a la oferta publicada y la normativa aplicable."],
  ["5. Materiales y propiedad intelectual", "Los contenidos, marcas, diseños, software y materiales de la academia están protegidos por la normativa aplicable. Se concede un acceso limitado para fines educativos personales; no está permitido copiar, revender, publicar, extraer o distribuir contenido sin autorización."],
  ["6. Conducta permitida", "No debes usar la plataforma para vulnerar cuentas, introducir código malicioso, acosar, suplantar identidades, extraer datos, interferir con el servicio ni cargar archivos que infrinjan derechos de terceros o la ley."],
  ["7. Certificados y evaluaciones", "Los certificados se emiten cuando se cumplen los requisitos académicos y administrativos del programa. La academia puede revisar o anular un certificado obtenido mediante fraude, suplantación o incumplimiento comprobado."],
  ["8. Disponibilidad y soporte", "Trabajamos para mantener el servicio disponible, pero puede haber interrupciones por mantenimiento, fallos de terceros o eventos fuera de control razonable. Publicaremos avisos operativos cuando sea posible y atenderemos incidencias por los canales configurados."],
  ["9. Privacidad", "El tratamiento de datos personales se explica en la Política de privacidad. Al enviar formularios de contacto declaras haberla leído y otorgas el consentimiento solicitado para esa finalidad."],
  ["10. Cambios y terminación", "Podemos actualizar estos términos o suspender una cuenta que incumpla las reglas, afecte la seguridad o use el servicio de forma abusiva. Los cambios relevantes se publicarán con su fecha de vigencia."],
  ["11. Ley aplicable", "Salvo que una norma imperativa disponga otra cosa, estos términos se interpretan conforme a la legislación peruana y a la autoridad competente que corresponda. Este texto es un modelo operativo y debe ser revisado por asesoría legal antes de su publicación definitiva."],
];

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-5 py-16 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-8">
      <article className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-12">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-300">Academia Virtual</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Términos de uso</h1>
        <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">Versión vigente: 5 de septiembre de 2026</p>
        <p className="mt-6 text-sm leading-7 text-slate-700 dark:text-slate-200">Estos términos establecen las reglas básicas para utilizar la plataforma educativa, sus cursos, comunicaciones, materiales y servicios asociados.</p>
        <div className="mt-8 space-y-7 text-sm leading-7 text-slate-700 dark:text-slate-200">
          {sections.map(([title, body]) => (
            <section key={title}>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
              <p className="mt-2">{body}</p>
            </section>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap gap-5 text-sm font-semibold">
          <Link href="/privacy" className="text-blue-700 underline dark:text-blue-300">Leer política de privacidad</Link>
          <Link href="/" className="text-blue-700 underline dark:text-blue-300">Volver a la academia</Link>
        </div>
      </article>
    </div>
  );
}
