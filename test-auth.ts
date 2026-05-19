import fs from "fs";
const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
import admin from "firebase-admin";

async function test() {
  admin.initializeApp({ projectId: firebaseConfig.projectId });
  console.log("admin auth initialized");
  // We can't actually verify a token without one, but it didn't throw on initialization.
}
test();
