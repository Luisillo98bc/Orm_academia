import "dotenv/config";

import {
  CertificateType,
  ContractStatus,
  ContractType,
  CourseLevel,
  DeliverableStatus,
  EnrollmentStatus,
  GradeStatus,
  MaterialType,
  PaymentMethod,
  PaymentStatus,
  PayrollStatus,
  PrismaClient,
  TargetAudience,
  WorkerStatus,
} from "../../backend/node_modules/@prisma/client";
import * as bcrypt from "bcrypt";

/**
 * Seed de carga funcional para entorno local/demo.
 *
 * Crea 100 usuarios demo y actividad relacionada en todos los módulos
 * principales. Todos los registros propios de este seed llevan el prefijo
 * DEMO100, por lo que el script puede ejecutarse varias veces sin duplicar.
 */

const prisma = new PrismaClient();
const DEMO_PREFIX = "DEMO100";
const DEMO_PASSWORD = "Demo@1234!";
const DAY = 24 * 60 * 60 * 1000;

const firstNames = [
  "Ana", "Bruno", "Camila", "Diego", "Elena", "Fabian", "Gabriela",
  "Hugo", "Isabel", "Javier", "Karina", "Luis", "Mariana", "Nicolas",
  "Olivia", "Pablo", "Renata", "Sergio", "Tamara", "Victor",
];
const lastNames = [
  "Alvarez", "Benavides", "Castillo", "Diaz", "Espinoza", "Fernandez",
  "Garcia", "Herrera", "Ibarra", "Jimenez", "Lopez", "Mendoza",
  "Navarro", "Ortega", "Paredes", "Quispe", "Ramirez", "Salazar",
  "Torres", "Valdivia",
];

const daysAgo = (days: number) => new Date(Date.now() - days * DAY);
const daysFromNow = (days: number) => new Date(Date.now() + days * DAY);
const dateOnly = (days: number) => {
  const date = daysAgo(days);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

async function getRole(name: string, description: string) {
  return prisma.role.upsert({
    where: { name },
    update: { isActive: true },
    create: { name, description },
  });
}

async function createUser(
  index: number,
  role: { id: string },
  area: "ADMIN" | "DOCENTE" | "RRHH" | "ESTUDIANTE",
) {
  const areaOffsets = { ADMIN: 0, DOCENTE: 2, RRHH: 10, ESTUDIANTE: 15 };
  const globalIndex = areaOffsets[area] + index;
  const firstName = firstNames[(index - 1) % firstNames.length];
  const lastName = lastNames[Math.floor((index - 1) / firstNames.length) % lastNames.length];
  const email = `${DEMO_PREFIX.toLowerCase()}.${area.toLowerCase()}${String(index).padStart(3, "0")}@academia.local`;
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      firstName,
      lastName,
      isActive: true,
      emailVerifiedAt: daysAgo(index % 45),
      lastLoginAt: daysAgo(index % 7),
      dni: String(71000000 + globalIndex),
      phone: `+519${String(90000000 + globalIndex).slice(-8)}`,
      address: `Av. Demo ${index}, Lima`,
      district: ["Miraflores", "Surco", "San Miguel", "Los Olivos"][index % 4],
      province: "Lima",
      department: "Lima",
    },
    create: {
      email,
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10),
      firstName,
      lastName,
      dni: String(71000000 + globalIndex),
      phone: `+519${String(90000000 + globalIndex).slice(-8)}`,
      address: `Av. Demo ${index}, Lima`,
      district: ["Miraflores", "Surco", "San Miguel", "Los Olivos"][index % 4],
      province: "Lima",
      department: "Lima",
      isActive: true,
      emailVerifiedAt: daysAgo(index % 45),
      lastLoginAt: daysAgo(index % 7),
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    update: {},
    create: { userId: user.id, roleId: role.id },
  });
  await prisma.notificationPreference.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });
  return user;
}

async function findOrCreateAnnouncement(authorId: string, index: number) {
  const title = `${DEMO_PREFIX} | Anuncio ${index}`;
  const existing = await prisma.announcement.findFirst({ where: { title } });
  if (existing) return existing;
  return prisma.announcement.create({
    data: {
      title,
      content: `Información institucional de prueba para simular actividad diaria (${index}).`,
      type: index % 3 === 0 ? "success" : index % 3 === 1 ? "info" : "warning",
      targetAudience: index % 3 === 0 ? TargetAudience.STUDENTS : TargetAudience.ALL,
      authorId,
      isActive: true,
      showOnLanding: index <= 2,
      ctaText: index <= 2 ? "Ver cursos" : undefined,
      ctaUrl: index <= 2 ? "/catalog" : undefined,
      landingStartsAt: index <= 2 ? daysAgo(2) : undefined,
      landingEndsAt: index <= 2 ? daysFromNow(30) : undefined,
    },
  });
}

async function main() {
  console.log("Iniciando seed DEMO100...");

  const adminRole = await getRole("ADMIN", "Administrador del sistema");
  const docenteRole = await getRole("DOCENTE", "Docente de cursos y estudiantes");
  const rrhhRole = await getRole("RRHH", "Gestión de personal y nómina");
  const estudianteRole = await getRole("ESTUDIANTE", "Estudiante de la academia");
  const admins = [];
  const teachers = [];
  const rrhhUsers = [];
  const students = [];

  for (let index = 1; index <= 2; index++) admins.push(await createUser(index, adminRole, "ADMIN"));
  for (let index = 1; index <= 8; index++) teachers.push(await createUser(index, docenteRole, "DOCENTE"));
  for (let index = 1; index <= 5; index++) rrhhUsers.push(await createUser(index, rrhhRole, "RRHH"));
  for (let index = 1; index <= 85; index++) students.push(await createUser(index, estudianteRole, "ESTUDIANTE"));

  const demoUsers = [...admins, ...teachers, ...rrhhUsers, ...students];
  const staff = [...admins, ...teachers, ...rrhhUsers];
  const auditUser = admins[0];

  // Recursos Humanos: personal, contratos, nóminas y asistencia.
  const workers = [];
  for (let index = 0; index < staff.length; index++) {
    const user = staff[index];
    const isTeacher = index >= admins.length && index < admins.length + teachers.length;
    const worker = await prisma.worker.upsert({
      where: { userId: user.id },
      update: { status: WorkerStatus.ACTIVE },
      create: {
        userId: user.id,
        dni: String(72000000 + index),
        position: isTeacher ? "Docente especialista" : index < 2 ? "Administrador" : "Analista de RRHH",
        department: isTeacher ? "Académico" : "Administración",
        baseSalary: isTeacher ? 4200 + index * 150 : 3800 + index * 200,
        hireDate: daysAgo(300 + index * 15),
        status: WorkerStatus.ACTIVE,
        personalPhone: `+519${String(91000000 + index).slice(-8)}`,
      },
    });
    workers.push(worker);

    const contractMarker = `${DEMO_PREFIX}-CONTRACT-${index + 1}`;
    let contract = await prisma.contract.findFirst({ where: { workerId: worker.id, observations: contractMarker } });
    if (!contract) {
      contract = await prisma.contract.create({
        data: {
          workerId: worker.id,
          type: index % 3 === 0 ? ContractType.INDEFINITE : ContractType.FIXED_TERM,
          status: ContractStatus.SIGNED,
          startDate: daysAgo(300 + index * 15),
          endDate: daysFromNow(180),
          agreedSalary: worker.baseSalary,
          documentUrl: `/demo/${contractMarker}.pdf`,
          isActive: true,
          observations: contractMarker,
          sentAt: daysAgo(290),
          signedAt: daysAgo(285),
          signedBy: user.id,
          signatureName: `${user.firstName} ${user.lastName}`,
          signatureHash: `${DEMO_PREFIX}-SIGNATURE-${index + 1}`,
          approvedAt: daysAgo(280),
          approvedBy: auditUser.id,
        },
      });
    }
    for (let periodIndex = 0; periodIndex < 3; periodIndex++) {
      const period = `2026-0${7 + periodIndex}`;
      const baseSalary = Number(worker.baseSalary);
      await prisma.payroll.upsert({
        where: { workerId_period: { workerId: worker.id, period } },
        update: {},
        create: {
          workerId: worker.id,
          period,
          baseSalary,
          bonuses: periodIndex === 2 ? 250 : 0,
          deductions: 120,
          totalAmount: baseSalary + (periodIndex === 2 ? 250 : 0) - 120,
          status: periodIndex < 2 ? PayrollStatus.PAID : PayrollStatus.PENDING,
          paymentDate: periodIndex < 2 ? daysAgo(20 - periodIndex * 30) : undefined,
        },
      });
    }
    for (let dayIndex = 0; dayIndex < 5; dayIndex++) {
      const date = dateOnly(dayIndex + 1);
      await prisma.workAttendance.upsert({
        where: { workerId_date: { workerId: worker.id, date } },
        update: {},
        create: {
          workerId: worker.id,
          date,
          checkInTime: new Date(`${date.toISOString().slice(0, 10)}T08:55:00.000Z`),
          checkOutTime: new Date(`${date.toISOString().slice(0, 10)}T17:35:00.000Z`),
          status: dayIndex === 3 && index % 4 === 0 ? "LATE" : "PRESENT",
          observation: `${DEMO_PREFIX} jornada registrada`,
        },
      });
    }
  }

  // Cursos, cohortes, módulos, materiales, sesiones y docentes.
  const courseData = [
    ["DEV-FULL-01", "Desarrollo Web Fullstack", CourseLevel.INTERMEDIATE, 120, "/course-images/fullstack.png"],
    ["UXUI-DES-01", "Diseño UX/UI y Design Systems", CourseLevel.BEGINNER, 90, "/course-images/uxui.png"],
    ["DATA-PY-01", "Data Science con Python", CourseLevel.ADVANCED, 140, "/course-images/data-science.png"],
    ["MARK-DIG-01", "Marketing Digital y Analítica", CourseLevel.BEGINNER, 80, "/course-images/marketing.png"],
    ["CLOUD-DEV-01", "Cloud Computing para desarrolladores", CourseLevel.ADVANCED, 100, "/course-images/cloud.png"],
    ["PM-AGILE-01", "Gestión de proyectos ágiles", CourseLevel.INTERMEDIATE, 70, "/course-images/agile.png"],
  ] as const;
  const cohorts = [];
  for (let courseIndex = 0; courseIndex < courseData.length; courseIndex++) {
    const [code, name, level, durationHours, imageUrl] = courseData[courseIndex];
    const course = await prisma.course.upsert({
      where: { code },
      update: { isPublished: true, durationHours, imageUrl },
      create: {
        code,
        name,
        description: `${name}: programa demo para validar flujos completos de la plataforma.`,
        whatYouWillLearn: "Conceptos, práctica guiada, proyecto aplicado y evaluación final.",
        requirements: "Laptop y conexión a internet.",
        targetAudience: "Personas que desean fortalecer sus habilidades profesionales.",
        level,
        durationHours,
        imageUrl,
        isPublished: true,
      },
    });
    for (let groupIndex = 0; groupIndex < 2; groupIndex++) {
      const cohortName = `${DEMO_PREFIX} | ${name} | Grupo ${groupIndex + 1}`;
      let cohort = await prisma.cohort.findFirst({ where: { courseId: course.id, name: cohortName } });
      if (!cohort) {
        cohort = await prisma.cohort.create({
          data: {
            courseId: course.id,
            name: cohortName,
            googleMeetLink: `https://meet.google.com/demo-${courseIndex}-${groupIndex}`,
            price: 299 + courseIndex * 50,
            discountPercentage: groupIndex === 0 ? 10 : 0,
            discountEndsAt: groupIndex === 0 ? daysFromNow(20) : undefined,
            maxStudents: 40,
            startDate: daysAgo(75 - courseIndex * 3 - groupIndex * 5),
            endDate: daysFromNow(45 + courseIndex * 2),
            isActive: true,
            imageUrl,
            teachers: { connect: [{ id: teachers[(courseIndex * 2 + groupIndex) % teachers.length].id }] },
          },
        });
      } else {
        await prisma.cohort.update({
          where: { id: cohort.id },
          data: {
            imageUrl,
            teachers: { set: [{ id: teachers[(courseIndex * 2 + groupIndex) % teachers.length].id }] },
          },
        });
      }
      cohorts.push(cohort);
    }
  }

  const enrollments: Array<{ id: string; userId: string; cohortId: string; status: EnrollmentStatus }> = [];
  for (let cohortIndex = 0; cohortIndex < cohorts.length; cohortIndex++) {
    const cohort = cohorts[cohortIndex];
    const assignedStudents = students.filter((_, studentIndex) => studentIndex % cohorts.length === cohortIndex || (studentIndex + cohortIndex) % 7 === 0);
    const teacher = teachers[cohortIndex % teachers.length];
    for (const student of assignedStudents) {
      const studentIndex = students.findIndex((item) => item.id === student.id);
      const status = studentIndex % 17 === 0 ? EnrollmentStatus.COMPLETED : studentIndex % 19 === 0 ? EnrollmentStatus.PENDING_PAYMENT : EnrollmentStatus.ACTIVE;
      const enrollment = await prisma.enrollment.upsert({
        where: { userId_cohortId: { userId: student.id, cohortId: cohort.id } },
        update: { status, completedAt: status === EnrollmentStatus.COMPLETED ? daysAgo(5) : null },
        create: {
          userId: student.id,
          cohortId: cohort.id,
          status,
          enrolledAt: daysAgo(60 - (studentIndex % 25)),
          completedAt: status === EnrollmentStatus.COMPLETED ? daysAgo(5) : undefined,
        },
      });
      enrollments.push({ id: enrollment.id, userId: student.id, cohortId: cohort.id, status });

      const paymentStatus = status === EnrollmentStatus.PENDING_PAYMENT ? PaymentStatus.PENDING : studentIndex % 23 === 0 ? PaymentStatus.REJECTED : PaymentStatus.COMPLETED;
      await prisma.payment.upsert({
        where: { enrollmentId: enrollment.id },
        update: { status: paymentStatus },
        create: {
          enrollmentId: enrollment.id,
          idempotencyKey: `${DEMO_PREFIX}-PAY-${enrollment.id}`,
          amount: 299 + cohortIndex * 25,
          method: [PaymentMethod.TARJETA, PaymentMethod.YAPE, PaymentMethod.PLIN, PaymentMethod.EFECTIVO][studentIndex % 4],
          status: paymentStatus,
          voucherUrl: paymentStatus === PaymentStatus.PENDING ? `/demo/vouchers/${enrollment.id}.jpg` : undefined,
          validatedAt: paymentStatus === PaymentStatus.COMPLETED ? daysAgo(30) : undefined,
          rejectedAt: paymentStatus === PaymentStatus.REJECTED ? daysAgo(12) : undefined,
          rejectionReason: paymentStatus === PaymentStatus.REJECTED ? "Voucher ilegible (dato demo)" : undefined,
        },
      });

      if (status === EnrollmentStatus.COMPLETED) {
        await prisma.certificate.upsert({
          where: { code: `${DEMO_PREFIX}-CERT-${enrollment.id.slice(0, 8)}` },
          update: {},
          create: {
            code: `${DEMO_PREFIX}-CERT-${enrollment.id.slice(0, 8)}`,
            enrollmentId: enrollment.id,
            type: CertificateType.COMPLETION,
            issueDate: daysAgo(3),
            issuedBy: teacher.id,
            finalGrade: 17.5,
            attendanceRate: 92,
            templateVersion: "demo-v1",
          },
        });
      }
    }
  }

  // Contenido, evaluaciones, entregas, calificaciones, progreso y asistencia.
  for (let cohortIndex = 0; cohortIndex < cohorts.length; cohortIndex++) {
    const cohort = cohorts[cohortIndex];
    const teacher = teachers[cohortIndex % teachers.length];
    const cohortEnrollments = enrollments.filter((item) => item.cohortId === cohort.id);
    const modules = [];
    for (let moduleIndex = 0; moduleIndex < 3; moduleIndex++) {
      const moduleTitle = `${DEMO_PREFIX} | ${cohort.name} | Semana ${moduleIndex + 1}`;
      let syllabusModule = await prisma.syllabusModule.findFirst({ where: { cohortId: cohort.id, title: moduleTitle } });
      if (!syllabusModule) {
        syllabusModule = await prisma.syllabusModule.create({
          data: {
            cohortId: cohort.id,
            title: moduleTitle,
            description: `Contenido práctico de la semana ${moduleIndex + 1}.`,
            order: moduleIndex + 1,
          },
        });
      }
      modules.push(syllabusModule);
      const materialIds = [];
      for (let materialIndex = 0; materialIndex < 2; materialIndex++) {
        const materialTitle = `${DEMO_PREFIX} | Material ${cohortIndex + 1}-${moduleIndex + 1}-${materialIndex + 1}`;
        let material = await prisma.material.findFirst({ where: { moduleId: syllabusModule.id, title: materialTitle } });
        if (!material) {
          material = await prisma.material.create({
            data: {
              moduleId: syllabusModule.id,
              title: materialTitle,
              type: materialIndex === 0 ? MaterialType.PDF : MaterialType.VIDEO,
              fileUrl: `/demo/materials/${cohortIndex + 1}-${moduleIndex + 1}-${materialIndex + 1}`,
            },
          });
        }
        materialIds.push(material.id);
        for (const enrollment of cohortEnrollments.slice(0, 12)) {
          await prisma.materialProgress.upsert({
            where: { userId_materialId: { userId: enrollment.userId, materialId: material.id } },
            update: {},
            create: { userId: enrollment.userId, materialId: material.id, completedAt: daysAgo(moduleIndex + 1) },
          });
        }
      }
      const sessionTitle = `${DEMO_PREFIX} | Sesión ${cohortIndex + 1}-${moduleIndex + 1}`;
      let session = await prisma.classSession.findFirst({ where: { moduleId: syllabusModule.id, title: sessionTitle } });
      if (!session) {
        session = await prisma.classSession.create({
          data: {
            moduleId: syllabusModule.id,
            title: sessionTitle,
            date: dateOnly(moduleIndex + 3),
            meetLink: `https://meet.google.com/demo-class-${cohortIndex}-${moduleIndex}`,
            recordingUrl: `/demo/recordings/${cohortIndex}-${moduleIndex}`,
          },
        });
      }
      for (const enrollment of cohortEnrollments) {
        const present = (students.findIndex((item) => item.id === enrollment.userId) + moduleIndex + cohortIndex) % 11 !== 0;
        await prisma.classAttendance.upsert({
          where: { sessionId_studentId: { sessionId: session.id, studentId: enrollment.userId } },
          update: { isPresent: present },
          create: {
            cohortId: cohort.id,
            studentId: enrollment.userId,
            sessionId: session.id,
            date: session.date,
            isPresent: present,
            isExcused: !present && cohortIndex % 4 === 0,
            observation: `${DEMO_PREFIX} asistencia de prueba`,
          },
        });
      }
    }

    for (let evaluationIndex = 0; evaluationIndex < 2; evaluationIndex++) {
      const evaluationTitle = `${DEMO_PREFIX} | Evaluación ${cohortIndex + 1}-${evaluationIndex + 1}`;
      let evaluation = await prisma.evaluation.findFirst({ where: { cohortId: cohort.id, title: evaluationTitle } });
      if (!evaluation) {
        evaluation = await prisma.evaluation.create({
          data: {
            cohortId: cohort.id,
            moduleId: modules[evaluationIndex].id,
            title: evaluationTitle,
            description: "Actividad evaluada generada para pruebas funcionales.",
            weight: evaluationIndex === 0 ? 40 : 60,
            maxScore: 20,
            dueDate: daysFromNow(14 - evaluationIndex * 3),
            isPublished: true,
          },
        });
      }
      for (const enrollment of cohortEnrollments) {
        const studentIndex = students.findIndex((item) => item.id === enrollment.userId);
        const deliverable = await prisma.deliverable.upsert({
          where: { evaluationId_studentId: { evaluationId: evaluation.id, studentId: enrollment.userId } },
          update: {},
          create: {
            evaluationId: evaluation.id,
            studentId: enrollment.userId,
            fileUrl: `https://github.com/demo/${DEMO_PREFIX.toLowerCase()}-${studentIndex + 1}-${evaluationIndex + 1}`,
            fileName: `${DEMO_PREFIX}-entrega-${studentIndex + 1}.zip`,
            comment: "Entrega generada para simulación de uso diario.",
            status: studentIndex % 5 === 0 ? DeliverableStatus.PENDING : DeliverableStatus.GRADED,
            submittedAt: daysAgo(10 - evaluationIndex),
          },
        });
        if (studentIndex % 5 !== 0) {
          await prisma.grade.upsert({
            where: { deliverableId: deliverable.id },
            update: {},
            create: {
              deliverableId: deliverable.id,
              graderId: teacher.id,
              score: 13 + (studentIndex % 8),
              feedback: "Buen trabajo. Continúa reforzando la parte práctica.",
              status: studentIndex % 3 === 0 ? GradeStatus.DRAFT : GradeStatus.PUBLISHED,
              gradedAt: daysAgo(4),
            },
          });
        }
      }
    }

    const forumTitle = `${DEMO_PREFIX} | Foro ${cohortIndex + 1}`;
    let forum = await prisma.forum.findFirst({ where: { cohortId: cohort.id, title: forumTitle } });
    if (!forum) {
      forum = await prisma.forum.create({
        data: {
          cohortId: cohort.id,
          authorId: teacher.id,
          title: forumTitle,
          description: "Espacio de preguntas y colaboración de la cohorte.",
        },
      });
    }
    for (let messageIndex = 0; messageIndex < 4; messageIndex++) {
      const author = messageIndex === 0 ? teacher : students[(cohortIndex * 5 + messageIndex) % students.length];
      const content = `${DEMO_PREFIX} | Mensaje ${cohortIndex + 1}-${messageIndex + 1}`;
      const exists = await prisma.forumMessage.findFirst({ where: { forumId: forum.id, content } });
      if (!exists) await prisma.forumMessage.create({ data: { forumId: forum.id, authorId: author.id, content } });
    }
    for (const enrollment of cohortEnrollments.slice(0, 8)) {
      const exists = await prisma.teacherEvaluation.findFirst({ where: { cohortId: cohort.id, studentId: enrollment.userId } });
      if (!exists) {
        await prisma.teacherEvaluation.create({
          data: {
            cohortId: cohort.id,
            teacherId: teacher.id,
            studentId: enrollment.userId,
            score: 4 + (cohortIndex % 2),
            comment: "Docente claro y atento durante las sesiones.",
          },
        });
      }
    }
  }

  // Comunicación, mensajes directos, prospectos, conversiones y auditoría.
  const announcements = [];
  for (let index = 1; index <= 6; index++) announcements.push(await findOrCreateAnnouncement(admins[index % admins.length].id, index));
  for (let index = 0; index < demoUsers.length; index++) {
    const notificationTitle = `${DEMO_PREFIX} | Actividad pendiente`;
    const notificationExists = await prisma.notification.findFirst({ where: { userId: demoUsers[index].id, title: notificationTitle } });
    if (!notificationExists) {
      await prisma.notification.create({
        data: {
          userId: demoUsers[index].id,
          title: notificationTitle,
          message: "Revisa tus cursos y notificaciones de hoy.",
          type: index % 2 === 0 ? "academic" : "info",
          isRead: index % 3 === 0,
          actionUrl: "/dashboard",
          createdAt: daysAgo(index % 5),
        },
      });
    }
  }
  for (let index = 0; index < 30; index++) {
    const sender = demoUsers[index % demoUsers.length];
    const receiver = demoUsers[(index + 1) % demoUsers.length];
    const content = `${DEMO_PREFIX} | DM ${index + 1}`;
    const exists = await prisma.directMessage.findFirst({ where: { senderId: sender.id, receiverId: receiver.id, content } });
    if (!exists) await prisma.directMessage.create({ data: { senderId: sender.id, receiverId: receiver.id, content, isRead: index % 2 === 0, createdAt: daysAgo(index % 7) } });
  }
  for (let index = 0; index < 40; index++) {
    const email = `${DEMO_PREFIX.toLowerCase()}.prospect${String(index + 1).padStart(3, "0")}@example.test`;
    let prospect = await prisma.prospect.findFirst({ where: { email } });
    if (!prospect) {
      prospect = await prisma.prospect.create({
        data: {
          name: `${firstNames[index % firstNames.length]} ${lastNames[index % lastNames.length]}`,
          email,
          phone: `+519${String(93000000 + index).slice(-8)}`,
          message: "Solicita información sobre los cursos demo.",
          source: index % 2 === 0 ? "LANDING" : "WHATSAPP",
          privacyConsentAt: daysAgo(index % 20),
          privacyConsentVersion: "2026-01",
          status: ["NEW", "CONTACTED", "INTERESTED", "ENROLLED"][index % 4] as any,
          cohortId: cohorts[index % cohorts.length].id,
          assignedToId: rrhhUsers[index % rrhhUsers.length].id,
          nextFollowUpAt: daysFromNow(index % 10),
          lastContactAt: daysAgo(index % 8),
        },
      });
    }
    const noteContent = `${DEMO_PREFIX} | Seguimiento ${index + 1}`;
    const noteExists = await prisma.prospectNote.findFirst({ where: { prospectId: prospect.id, content: noteContent } });
    if (!noteExists) await prisma.prospectNote.create({ data: { prospectId: prospect.id, authorId: rrhhUsers[index % rrhhUsers.length].id, content: noteContent } });
  }
  for (let index = 0; index < 100; index++) {
    const sessionId = `${DEMO_PREFIX.toLowerCase()}-session-${index + 1}`;
    const event = ["page_view", "catalog_view", "checkout_started", "payment_completed"][index % 4];
    const exists = await prisma.conversionEvent.findFirst({ where: { sessionId, event } });
    if (!exists) await prisma.conversionEvent.create({ data: { sessionId, event, path: "/catalog", cohortId: cohorts[index % cohorts.length].id, metadata: { demo: true, sequence: index + 1 }, occurredAt: daysAgo(index % 14) } });
  }
  for (let index = 0; index < 100; index++) {
    const entityId = demoUsers[index % demoUsers.length].id;
    const action = index % 2 === 0 ? "LOGIN" : "VIEW_DASHBOARD";
    const exists = await prisma.auditLog.findFirst({ where: { userId: entityId, action, entity: DEMO_PREFIX } });
    if (!exists) await prisma.auditLog.create({ data: { userId: entityId, action, entity: DEMO_PREFIX, entityId, newValue: { demo: true, sequence: index + 1 }, ipAddress: "127.0.0.1", userAgent: "DEMO100/seed" } });
  }

  const settings = await prisma.platformSettings.findFirst();
  if (!settings) {
    await prisma.platformSettings.create({
      data: {
        academyName: "Academia Virtual Demo",
        legalName: "Academia Virtual Demo S.A.C.",
        tagline: "Aprende hoy, transforma tu futuro",
        description: "Configuración institucional de demostración.",
        primaryColor: "#2563eb",
        supportEmail: "soporte@academia.local",
        salesEmail: "ventas@academia.local",
        address: "Lima, Perú",
      },
    });
  }

  const count = async (label: string, value: Promise<number>) => console.log(`  ${label}: ${await value}`);
  console.log(`\nSeed DEMO100 completado. Contraseña de todas las cuentas demo: ${DEMO_PASSWORD}`);
  await count("Usuarios demo", prisma.user.count({ where: { email: { startsWith: `${DEMO_PREFIX.toLowerCase()}.` } } }));
  await count("Cursos demo", prisma.course.count({ where: { code: { in: courseData.map(([code]) => code) } } }));
  await count("Cohortes demo", prisma.cohort.count({ where: { name: { startsWith: `${DEMO_PREFIX} |` } } }));
  await count("Matrículas", prisma.enrollment.count({ where: { cohort: { name: { startsWith: `${DEMO_PREFIX} |` } } } }));
  await count("Pagos", prisma.payment.count({ where: { enrollment: { cohort: { name: { startsWith: `${DEMO_PREFIX} |` } } } } }));
  await count("Entregas", prisma.deliverable.count({ where: { fileName: { startsWith: `${DEMO_PREFIX}-` } } }));
  await count("Notificaciones", prisma.notification.count({ where: { title: { startsWith: `${DEMO_PREFIX} |` } } }));
  await count("Prospectos", prisma.prospect.count({ where: { email: { startsWith: `${DEMO_PREFIX.toLowerCase()}.` } } }));
}

main()
  .catch((error) => {
    console.error("Error en seed DEMO100:", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
