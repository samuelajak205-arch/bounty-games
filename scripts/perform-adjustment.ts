import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

async function performAdjustment() {
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    const app = getApps().length === 0 
      ? initializeApp({ projectId: config.projectId })
      : getApps()[0];

    const db = getFirestore(app, config.firestoreDatabaseId);
    const userId = 'oKXw7XDpfxUk8zezFlePtguxjwv1';
    const amount = 100;
    const description = 'Manual adjustment for user data correction';

    console.log(`Starting adjustment for user ${userId} on database ${config.firestoreDatabaseId}...`);

    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.error('User not found!');
      process.exit(1);
    }

    await db.runTransaction(async (t) => {
      t.update(userRef, {
        bountyCoins: FieldValue.increment(amount)
      });

      const txnRef = db.collection('transactions').doc();
      t.set(txnRef, {
        userId: userId,
        amount: amount,
        type: 'adjustment',
        description: description,
        timestamp: FieldValue.serverTimestamp(),
        adminId: 'system-agent'
      });
    });

    console.log('Successfully added transaction and updated balance.');
    process.exit(0);
  } catch (err) {
    console.error('Adjustment failed:', err);
    process.exit(1);
  }
}

performAdjustment();
