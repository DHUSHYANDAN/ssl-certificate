const { Worker } = require("worker_threads");

process.on("message", async (msg) => {
  if (msg.type === "startSSLJob") {
    console.log(`🔧 Worker ${process.pid} received job`);
    const worker = new Worker("./utils/sslTaskHandler.js");

    worker.on("message", (msg) => {
      console.log(`📩 Worker thread finished job in process ${process.pid}:`, msg);
    });

    worker.on("error", (err) => {
      console.error(`❌ Worker thread error in process ${process.pid}:`, err);
    });

    worker.on("exit", (code) => {
      if (code !== 0) {
        console.error(`⚠️ Worker thread exited with code ${code}`);
      }
    });
  }
});
