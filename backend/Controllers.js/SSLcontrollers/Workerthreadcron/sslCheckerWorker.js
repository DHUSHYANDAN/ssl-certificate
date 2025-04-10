const { parentPort, workerData } = require("worker_threads");
const pLimit = require("p-limit");
const tls = require("tls");
const net = require("net");

function checkSSL(url) {
  return new Promise((resolve, reject) => {
    const { hostname } = new URL(url);
    const socket = net.connect(443, hostname, () => {
      const tlsSocket = tls.connect({ socket, servername: hostname, rejectUnauthorized: false }, () => {
        const cert = tlsSocket.getPeerCertificate();

        if (!cert || Object.keys(cert).length === 0) {
          reject("No certificate found");
        }

        resolve({
          url,
          issuedToCommonName: cert.subject?.CN || "Unknown",
          issuedToOrganization: cert.subject?.O || "Unknown",
          issuedByCommonName: cert.issuer?.CN || "Unknown",
          issuedByOrganization: cert.issuer?.O || "Unknown",
          validFrom: new Date(cert.valid_from),
          validTo: new Date(cert.valid_to),
        });

        tlsSocket.end();
        socket.end();
      });

      tlsSocket.on("error", (err) => reject(err));
    });

    socket.on("error", (err) => reject(err));
  });
}

checkSSL(workerData.url)
  .then((result) => parentPort.postMessage({ success: true, data: result }))
  .catch((error) => parentPort.postMessage({ success: false, error: error.message }));
