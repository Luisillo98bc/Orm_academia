import { PrismaClient, CourseLevel } from '../../backend/node_modules/@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Poblando datos demostrativos para Academia Virtual...');

  // 1. Obtener o crear Roles
  const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
  const docenteRole = await prisma.role.findUnique({ where: { name: 'DOCENTE' } });
  const estudianteRole = await prisma.role.findUnique({ where: { name: 'ESTUDIANTE' } });

  // 2. Crear Docente de Prueba
  const teacherPasswordHash = await bcrypt.hash('Docente@1234', 10);
  const teacherUser = await prisma.user.upsert({
    where: { email: 'docente@academia.edu' },
    update: {},
    create: {
      email: 'docente@academia.edu',
      passwordHash: teacherPasswordHash,
      firstName: 'Carlos',
      lastName: 'Mendoza',
      isActive: true,
      emailVerifiedAt: new Date(),
    },
  });

  if (docenteRole) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: teacherUser.id, roleId: docenteRole.id } },
      update: {},
      create: { userId: teacherUser.id, roleId: docenteRole.id },
    });
  }

  // 3. Crear Estudiantes de Prueba
  const studentPasswordHash = await bcrypt.hash('Estudiante@1234', 10);
  const studentData = [
    { email: 'maria.silva@gmail.com', firstName: 'María', lastName: 'Silva' },
    { email: 'juan.perez@gmail.com', firstName: 'Juan', lastName: 'Pérez' },
    { email: 'lucia.gomez@gmail.com', firstName: 'Lucía', lastName: 'Gómez' },
  ];

  const students = [];
  for (const s of studentData) {
    const st = await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: {
        email: s.email,
        passwordHash: studentPasswordHash,
        firstName: s.firstName,
        lastName: s.lastName,
        isActive: true,
        emailVerifiedAt: new Date(),
      },
    });

    if (estudianteRole) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: st.id, roleId: estudianteRole.id } },
        update: {},
        create: { userId: st.id, roleId: estudianteRole.id },
      });
    }
    students.push(st);
  }

  // 4. Crear Cursos y Cohortes Demostrativos
  const coursesData = [
    {
      code: 'DEV-FULLSTACK-01',
      name: 'Desarrollo Web Fullstack con React & NestJS',
      description: 'Aprende a construir aplicaciones escalables desde cero utilizando React 19, TypeScript, NestJS y PostgreSQL.',
      level: CourseLevel.INTERMEDIATE,
      price: 499.00,
    },
    {
      code: 'UXUI-DESIGN-01',
      name: 'Diseño UX/UI Avanzado y Sistemas de Diseño',
      description: 'Domina Figma, investigación de usuarios, wireframing, prototipado interactivo y creación de Design Systems.',
      level: CourseLevel.BEGINNER,
      price: 349.00,
    },
    {
      code: 'DATA-SCIENCE-01',
      name: 'Data Science y Machine Learning con Python',
      description: 'Análisis de datos con Pandas, visualización con Seaborn y modelos predictivos con Scikit-Learn y TensorFlow.',
      level: CourseLevel.ADVANCED,
      price: 599.00,
    },
  ];

  for (const cData of coursesData) {
    const course = await prisma.course.upsert({
      where: { code: cData.code },
      update: { isPublished: true },
      create: {
        code: cData.code,
        name: cData.name,
        description: cData.description,
        level: cData.level,
        isPublished: true,
      },
    });

    // Crear Cohorte para el curso
    const startDate = new Date();
    const endDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    const cohort = await prisma.cohort.create({
      data: {
        courseId: course.id,
        name: `Grupo 2026-I — ${course.name}`,
        startDate,
        endDate,
        price: cData.price,
        maxStudents: 30,
        isActive: true,
      },
    });

    // Matricular a los estudiantes
    for (const student of students) {
      await prisma.enrollment.create({
        data: {
          userId: student.id,
          cohortId: cohort.id,
          status: 'ACTIVE',
        },
      });
    }
  }

  console.log('✅ Cursos, Cohortes y Estudiantes demostrativos creados con éxito!');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed demo:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
