import { proxyToWorker } from "../_proxy.js";

export function onRequest(context) {
  return proxyToWorker(context);
}
