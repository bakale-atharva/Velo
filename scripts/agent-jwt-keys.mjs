// Makes the ES256 key pair Velo uses to sign agent tokens (B9) and prints
// the two `npx convex env set` commands that store it on a deployment.
//
//   node scripts/agent-jwt-keys.mjs           # dev deployment
//   node scripts/agent-jwt-keys.mjs --prod    # adds --prod to the commands
//
// AGENT_JWT_PRIVATE_KEY: the private key as a JWK (secret; never commit it).
// AGENT_JWT_JWKS: the public key set as a data: URI, read by
// convex/auth.config.ts so Convex trusts tokens signed with the private key.
// Running it again makes a new pair; set both values together.

import { webcrypto } from "node:crypto";

const { subtle } = webcrypto;

const pair = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
  "sign",
  "verify",
]);
const kid = `velo-agent-${new Date().toISOString().slice(0, 10)}`;
const privateJwk = { ...(await subtle.exportKey("jwk", pair.privateKey)), kid, alg: "ES256" };
const publicJwk = { ...(await subtle.exportKey("jwk", pair.publicKey)), kid, alg: "ES256", use: "sig" };
delete publicJwk.key_ops;
delete privateJwk.key_ops;

const jwks = JSON.stringify({ keys: [publicJwk] });
const jwksUri = `data:text/plain;charset=utf-8;base64,${Buffer.from(jwks).toString("base64")}`;
const prod = process.argv.includes("--prod") ? " --prod" : "";

console.log("Run these two commands (they set secrets on your Convex deployment):\n");
console.log(`npx convex env set${prod} AGENT_JWT_PRIVATE_KEY '${JSON.stringify(privateJwk)}'`);
console.log(`npx convex env set${prod} AGENT_JWT_JWKS '${jwksUri}'`);
