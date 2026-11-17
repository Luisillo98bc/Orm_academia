const apiBaseUrl = (process.env.API_BASE_URL || 'http://localhost:3003/api/v1').replace(/\/$/, '');
const email = process.env.TEST_ADMIN_EMAIL;
const password = process.env.TEST_ADMIN_PASSWORD;

if (!email || !password) {
  throw new Error(
    'Define TEST_ADMIN_EMAIL y TEST_ADMIN_PASSWORD para ejecutar esta prueba. No se usan credenciales por defecto.',
  );
}

async function test() {
  const tokenRes = await fetch(`${apiBaseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const tokenData = await tokenRes.json();
  const token = tokenData.access_token;
  console.log("Token:", token ? "Got token" : "Failed");

  // Create course
  const courseRes = await fetch(`${apiBaseUrl}/academic/courses`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      code: "TEST1",
      name: "Test Course",
      level: "BEGINNER",
      durationHours: 10
    })
  });
  const course = await courseRes.json();
  console.log("Created course:", course);

  // Upload a tiny valid GIF held in memory; no local test file is created.
  const form = new FormData();
  form.append('file', new Blob([Buffer.from('GIF89a')], { type: 'image/gif' }), 'test-upload.gif');

  const uploadRes = await fetch(`${apiBaseUrl}/academic/courses/${course.id}/image`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
    },
    body: form
  });
  const uploadData = await uploadRes.json();
  console.log("Upload result:", uploadRes.status, uploadData);
}

test().catch(console.error);
