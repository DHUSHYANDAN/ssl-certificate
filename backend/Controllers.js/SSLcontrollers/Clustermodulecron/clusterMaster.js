const cluster = require("cluster");
const os = require("os");
const cron = require("node-cron");
const { Schedule } = require("../../../models/schedule"); // adjust path accordingly

const numCPUs = os.cpus().length;

const startCluster = async () => {
  if (cluster.isMaster) {
    console.log(`👑 Master process ${process.pid} is running`);

    for (let i = 0; i < numCPUs; i++) {
      cluster.fork();
    }

    cluster.on("exit", (worker, code, signal) => {
      console.log(`💀 Worker ${worker.process.pid} died. Restarting...`);
      cluster.fork(); // Auto-restart
    });

    // Setup cron job only in master
    const scheduleData = await Schedule.findOne({ where: { active: true } });
    const cronSchedule = (scheduleData?.cronSchedule || "0 6 * * *").trim();

    console.log(`📅 Cron job set to run at: ${cronSchedule}`);
    cron.schedule(cronSchedule, () => {
      console.log(`⏰ Master triggering SSL jobs at ${new Date().toISOString()}`);
      
      for (const id in cluster.workers) {
        cluster.workers[id].send({ type: "startSSLJob" });
      }
    }, {
      scheduled: true,
      timezone: "Asia/Kolkata"
    });

  } else {
    require("./workerSSLChecker"); // Each worker runs this
  }
};

startCluster();
