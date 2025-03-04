const protocol = window.location.protocol;
const hostname = window.location.hostname;
const protocolAndHostname = protocol + "//" + hostname;
const baseUrl = `${protocolAndHostname}:5000`
export default   baseUrl;