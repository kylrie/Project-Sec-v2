const { execSync } = require('child_process');

const ports = [3000, 24678];
ports.forEach(port => {
  try {
    const output = execSync(`netstat -ano | findstr :${port}`).toString();
    const lines = output.split('\n');
    lines.forEach(line => {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && !isNaN(Number(pid)) && Number(pid) > 0) {
        try {
          execSync(`taskkill /F /PID ${pid}`);
          console.log(`Successfully killed PID ${pid} holding port ${port}`);
        } catch (err) {
          // Process might already be terminated
        }
      }
    });
  } catch (err) {
    console.log(`Port ${port} is clear.`);
  }
});
