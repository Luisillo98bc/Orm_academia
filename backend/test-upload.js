import fs from 'fs';
import path from 'path';

async function test() {
  const tokenRes = await fetch("http://localhost:4000/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@academia.edu", password: "admin123" })
  });
  const tokenData = await tokenRes.json();
  const token = tokenData.access_token;
  console.log("Token:", token ? "Got token" : "Failed");

  // Create course
  const courseRes = await fetch("http://localhost:4000/api/v1/academic/courses", {
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

  // Upload image
  // Let's create a dummy image
  fs.writeFileSync("dummy.jpg", "fake image content");
  
  const FormData = require('form-data');
  const form = new FormData();
  form.append('file', fs.createReadStream('dummy.jpg'));

  const uploadRes = await fetch(`http://localhost:4000/api/v1/academic/courses/${course.id}/image`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      ...form.getHeaders()
    },
    body: form
  });
  const uploadData = await uploadRes.json();
  console.log("Upload result:", uploadRes.status, uploadData);
}

test().catch(console.error);
