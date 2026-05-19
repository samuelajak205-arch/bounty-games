import fs from "fs";
const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

async function test() {
  admin.initializeApp({
    projectId: firebaseConfig.projectId
  });
  const db = getFirestore(admin.app(), firebaseConfig.firestoreDatabaseId);
  try {
    const res = await db.collection("matches").limit(1).get();
    console.log("Success with matches! Docs:", res.docs.length);
  } catch (err) {
    console.error("Failed matches with specific database ID:", err);
  }

  const dbDefault = admin.firestore();
  try {
    const res = await dbDefault.collection("users").limit(1).get();
    console.log("Success with default! Docs:", res.docs.length);
  } catch (err) {
    console.error("Failed with default:", err);
  }
}
test();
