import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { Chess } from "chess.js";
import fs from "fs";
import { google } from "googleapis";

import { getPesapalToken, registerIPN, submitOrder, getTransactionStatus } from "./src/services/pesapal.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

console.log("Starting server process...");

// Load Firebase Config
let firebaseConfig: any;
try {
  firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
  console.log("Firebase config loaded.");
} catch (err) {
  console.error("Failed to load firebase-applet-config.json", err);
  process.exit(1);
}

// Initialize Gemini AI
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.warn("GEMINI_API_KEY not found in environment.");
}
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || "dummy_key");
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  generationConfig: {
    responseMimeType: "application/json",
  },
});

async function getAiMove(fen: string, history: string[]) {
  if (!GEMINI_API_KEY) return null;
  const prompt = `You are Stockfish 16.1, the world's strongest chess engine. 
Board FEN: ${fen}. 
History: ${history.join(" ")}. 
Analyze the position deeply and return the absolute best next move in SAN as a JSON object with keys "move" and "reasoning". 
Focus on tactical advantage, material, and positional strength.`;
  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse AI response or API error:", e);
    return null;
  }
}

// Firebase Admin lazy loader
let _db: any = null;
let _adminInstance: any = null;
let _initPromise: Promise<any> | null = null;

async function initFirebaseAdmin() {
  if (_initPromise) return _initPromise;
  
  _initPromise = (async () => {
    const adminOptions = await import("firebase-admin");
    const admin = adminOptions.default || adminOptions;
    
    if (!admin.apps || admin.apps.length === 0) {
      admin.initializeApp({
        projectId: firebaseConfig.projectId,
      });
      console.log("Firebase Admin initialized successfully.");
    }
    
    _adminInstance = admin;
    
    if (!_db) {
      try {
         const { getFirestore } = await import("firebase-admin/firestore");
         _db = getFirestore(admin.app(), firebaseConfig.firestoreDatabaseId);
      } catch(e) {
         _db = admin.firestore();
      }
    }
    
    return admin;
  })();
  
  return _initPromise;
}

async function getDb() {
  await initFirebaseAdmin();
  return _db;
}

async function getAdmin() {
  await initFirebaseAdmin();
  return _adminInstance;
}

// Simple in-memory rate limiting map
const lastMoveTime: Record<string, number> = {};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  
  // Middleware to verify if request is from any logged-in user
  const verifyUser = async (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: "Unauthorized: Missing token" });
    }
    
    const idToken = authHeader.split(' ')[1];
    try {
      const admin = await getAdmin();
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      req.user = decodedToken;
      next();
    } catch (e) {
      console.error("User auth verification failed", e);
      res.status(401).json({ error: "Unauthorized: Invalid token" });
    }
  };

  // Middleware to verify if request is from an admin
  const verifyAdmin = async (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: "Unauthorized: Missing token" });
    }
    
    const idToken = authHeader.split(' ')[1];
    try {
      const admin = await getAdmin();
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const db = await getDb();
      
      // Check hardcoded email or admins collection
      if (decodedToken.email?.toLowerCase().trim() === 'samuelajak205@gmail.com') {
        req.user = decodedToken;
        return next();
      }
      
      const adminDoc = await db.collection("admins").doc(decodedToken.uid).get();
      if (!adminDoc.exists) {
        return res.status(403).json({ error: "Forbidden: Not an admin" });
      }
      
      req.user = decodedToken;
      next();
    } catch (e) {
      console.error("Auth verification failed", e);
      res.status(401).json({ error: "Unauthorized: Invalid token" });
    }
  };

  // VERY BEGINNING health check to prove server is alive
  app.get("/api/testing", async (req, res) => {
    try {
      const db = await getDb();
      const usersSnap = await db.collection("users").limit(1).get();
      res.json({ success: true, count: usersSnap.docs.length });
    } catch (err: any) {
      console.error("testing failed", err);
      res.status(500).json({ error: err.message, stack: err.stack });
    }
  });

  app.get("/api/ping", (req, res) => {
    res.json({ status: "alive", time: new Date().toISOString() });
  });

  app.post("/api/transfer", async (req: any, res: any) => {
    try {
      const db = await getDb();
      const admin = await getAdmin();
      if (!db || !admin) return res.status(500).json({ error: "Database not available" });

      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const idToken = authHeader.split(' ')[1];
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const senderId = decodedToken.uid;

      const { targetEmail, amount, note } = req.body;

      if (!targetEmail || !amount || amount <= 0) {
        return res.status(400).json({ error: "Invalid transfer details" });
      }

      // 1. Find target user
      const targetSnap = await db.collection("users").where("email", "==", targetEmail.toLowerCase().trim()).limit(1).get();
      if (targetSnap.empty) {
        return res.status(404).json({ error: "Recipient not found" });
      }

      const targetDoc = targetSnap.docs[0];
      const targetId = targetDoc.id;

      if (senderId === targetId) {
        return res.status(400).json({ error: "Cannot transfer to yourself" });
      }

      // 2. Atomic transaction
      const result = await db.runTransaction(async (t: any) => {
        const senderRef = db.collection("users").doc(senderId);
        const targetRef = db.collection("users").doc(targetId);

        const senderDoc = await t.get(senderRef);
        const currentBalance = senderDoc.data().bountyCoins || 0;

        if (currentBalance < amount) {
          throw new Error("Insufficient balance");
        }

        t.update(senderRef, {
          bountyCoins: admin.firestore.FieldValue.increment(-amount)
        });

        t.update(targetRef, {
          bountyCoins: admin.firestore.FieldValue.increment(amount)
        });

        const senderTxnRef = db.collection("transactions").doc();
        t.set(senderTxnRef, {
          userId: senderId,
          amount: -amount,
          type: "transfer_out",
          description: `Transfer to ${targetEmail}: ${note || 'No note'}`,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          relatedUserId: targetId
        });

        const targetTxnRef = db.collection("transactions").doc();
        t.set(targetTxnRef, {
          userId: targetId,
          amount: amount,
          type: "transfer_in",
          description: `Transfer from ${decodedToken.email}: ${note || 'No note'}`,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          relatedUserId: senderId
        });

        return { success: true };
      });

      res.json(result);
    } catch (err: any) {
      console.error("Transfer failed", err);
      res.status(500).json({ error: err.message || "Transfer failed" });
    }
  });

  // Admin Routes
  app.get("/api/admin/stats", verifyAdmin, async (req, res) => {
    try {
      const db = await getDb();
      const usersSnap = await db.collection("users").count().get();
      const matchesSnap = await db.collection("matches").count().get();
      const activeMatchesSnap = await db.collection("matches").where("status", "==", "active").count().get();
      
      // Active users in last 5 mins
      const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
      const activeUsersSnap = await db.collection("users")
        .where("lastActive", ">=", fiveMinsAgo)
        .count().get();
      
      // Calculate total coins in circulation
      const usersRef = db.collection("users");
      const users = await usersRef.select("bountyCoins").get();
      let totalCoins = 0;
      users.forEach((doc: any) => {
        totalCoins += doc.data().bountyCoins || 0;
      });

      res.json({
        totalUsers: usersSnap.data().count,
        totalMatches: matchesSnap.data().count,
        activeMatches: activeMatchesSnap.data().count,
        activeUsers: activeUsersSnap.data().count,
        totalCoinsInCirculation: totalCoins,
        status: "healthy",
        uptime: process.uptime()
      });
    } catch (err) {
      console.error("Stats failed", err);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  app.get("/api/admin/users", verifyAdmin, async (req, res) => {
    try {
      const db = await getDb();
      const { search, limit = 20 } = req.query;
      
      let usersRef = db.collection("users").orderBy("createdAt", "desc");
      
      if (search) {
        // Simple prefix search (Firebase restriction: only works for startAt/endAt)
        // For better search, we'd use Algolia or similar, but for admin, small sets area fine.
        usersRef = usersRef.where("email", ">=", search).where("email", "<=", search + "\uf8ff");
      }
      
      const snap = await usersRef.limit(Number(limit)).get();
      const users = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      res.json(users);
    } catch (err) {
      console.error("Users list failed", err);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.get("/api/admin/transactions", verifyAdmin, async (req, res) => {
    try {
      const db = await getDb();
      const { userId, type, limit = 50, offset = 0, sort = 'timestamp', direction = 'desc' } = req.query;

      let query = db.collection("transactions");

      if (userId) {
        query = query.where("userId", "==", userId);
      }
      if (type && type !== 'all') {
        query = query.where("type", "==", type);
      }

      // Handle sorting
      query = query.orderBy(sort as string, direction as any);

      const snap = await query.limit(Number(limit)).get();
      const transactions = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      res.json(transactions);
    } catch (err) {
      console.error("Transactions fetch failed", err);
      // Fallback for missing indexes
      res.status(500).json({ error: "Failed to fetch transactions. You may need to create a Firestore index for this sort/filter combination." });
    }
  });

  app.post("/api/tournaments/join", async (req, res) => {
    try {
      const db = await getDb();
      const admin = await getAdmin();
      if (!db || !admin) return res.status(500).json({ error: "Database not available" });

      const { tournamentId, userId, displayName } = req.body;
      if (!tournamentId || !userId) return res.status(400).json({ error: "Missing fields" });

      const tournamentRef = db.collection("tournaments").doc(tournamentId);
      const userRef = db.collection("users").doc(userId);

      await db.runTransaction(async (t) => {
        const tDoc = await t.get(tournamentRef);
        const uDoc = await t.get(userRef);

        if (!tDoc.exists || !uDoc.exists) throw new Error("Not found");
        
        const tournament = tDoc.data();
        const user = uDoc.data();

        if (tournament.playerCount >= tournament.maxPlayers) throw new Error("Tournament is full");
        if (user.bountyCoins < tournament.entryFee) throw new Error("Insufficient balance");

        // 1. Join participant subcollection
        const partRef = tournamentRef.collection("participants").doc(userId);
        t.set(partRef, {
          userId,
          displayName: displayName || user.displayName || 'Grandmaster',
          score: 0,
          joinedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // 2. Deduct fee
        if (tournament.entryFee > 0) {
          t.update(userRef, {
            bountyCoins: admin.firestore.FieldValue.increment(-tournament.entryFee)
          });

          // 3. Log transaction
          const txnRef = db.collection("transactions").doc();
          t.set(txnRef, {
            userId,
            amount: -tournament.entryFee,
            type: 'wager',
            description: `Entry fee for tournament: ${tournament.title}`,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
          });
        }

        // 4. Update tournament count
        t.update(tournamentRef, {
          playerCount: admin.firestore.FieldValue.increment(1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });

      res.json({ success: true });
    } catch (err: any) {
      console.error("Tournament join failed", err);
      res.status(500).json({ error: err.message || "Join failed" });
    }
  });

  app.post("/api/admin/users/:id/update-balance", verifyAdmin, async (req, res) => {
    try {
      const db = await getDb();
      const admin = await getAdmin();
      const { id } = req.params;
      const { amount, reason } = req.body;

      if (typeof amount !== 'number') return res.status(400).json({ error: "Invalid amount" });

      const userRef = db.collection("users").doc(id);
      await db.runTransaction(async (t: any) => {
        t.update(userRef, {
          bountyCoins: admin.firestore.FieldValue.increment(amount)
        });
        
        const txnRef = db.collection("transactions").doc();
        t.set(txnRef, {
          userId: id,
          amount,
          type: "adjustment",
          description: `Admin adjustment: ${reason || 'No reason provided'}`,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          adminId: (req as any).user.uid
        });
      });

      res.json({ success: true });
    } catch (err) {
      console.error("Balance update failed", err);
      res.status(500).json({ error: "Failed to update balance" });
    }
  });

  app.post("/api/admin/users/:id/toggle-ban", verifyAdmin, async (req, res) => {
    try {
      const db = await getDb();
      const { id } = req.params;
      const { ban, reason } = req.body;

      const userRef = db.collection("users").doc(id);
      await userRef.update({
        isBanned: !!ban,
        banReason: reason || null,
        bannedAt: ban ? new Date() : null,
        bannedBy: ban ? (req as any).user.uid : null
      });

      res.json({ success: true, banned: !!ban });
    } catch (err) {
      console.error("Ban toggle failed", err);
      res.status(500).json({ error: "Failed to toggle ban" });
    }
  });

  // API Route: Promote hardcoded admin
  app.post("/api/admin/promote", async (req, res) => {
    try {
      const db = await getDb();
      const admin = await getAdmin();
      if (!db || !admin) return res.status(500).json({ error: "Database not available" });

      const { userId, email } = req.body;
      if (!userId || !email) return res.status(400).json({ error: "Missing userId or email" });

      if (email.toLowerCase().trim() === "samuelajak205@gmail.com") {
        await db.collection("admins").doc(userId).set({
          email: email.toLowerCase().trim(),
          promotedAt: admin.firestore.FieldValue.serverTimestamp(),
          role: "super_admin"
        });
        return res.json({ success: true, message: "Admin privileges granted in Firestore" });
      } else {
        return res.status(403).json({ error: "Unauthorized email for promotion" });
      }
    } catch (err) {
      console.error("Promotion failed", err);
      res.status(500).json({ error: "Promotion failed" });
    }
  });

  // API Route: Gmail Messages
  app.get("/api/gmail/messages", verifyUser, async (req: any, res: any) => {
    try {
      const accessToken = req.headers.authorization?.split(' ')[1];
      if (!accessToken) {
        return res.status(401).json({ error: "No access token" });
      }

      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: accessToken });

      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      const response = await gmail.users.messages.list({
        userId: 'me',
        maxResults: 10,
      });

      res.json(response.data);
    } catch (err: any) {
      console.error("Gmail API Error:", err);
      res.status(500).json({ error: err.message || "Failed to fetch messages" });
    }
  });

  // API Route: Secure Move Validation
  app.post("/api/move", async (req, res) => {
    try {
      const db = await getDb();
      const admin = await getAdmin();
      if (!db || !admin) return res.status(500).json({ error: "Database not available" });
      
      const { matchId, move, userId } = req.body;

      if (!matchId || !move || !userId) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Rate limiting: max 1 move per 0.5s per user
      const now = Date.now();
      if (lastMoveTime[userId] && now - lastMoveTime[userId] < 500) {
        return res.status(429).json({ error: "Wait 0.5s between moves" });
      }
      lastMoveTime[userId] = now;

      const matchRef = db.collection("matches").doc(matchId);
      const matchDoc = await matchRef.get();

      if (!matchDoc.exists) {
        return res.status(404).json({ error: "Match not found" });
      }

      const matchData = matchDoc.data();
      if (!matchData) return res.status(500).json({ error: "No data" });

      if (matchData.status !== "active") {
        return res.status(400).json({ error: "Match is not active" });
      }

      // Check Turn
      const isWhite = matchData.playerWhite === userId;
      const isBlack = matchData.playerBlack === userId;

      if (!isWhite && !isBlack) {
        return res.status(403).json({ error: "You are not a participant in this match" });
      }

      const currentTurn = matchData.turn; // 'w' or 'b'
      if ((currentTurn === 'w' && !isWhite) || (currentTurn === 'b' && !isBlack)) {
        return res.status(403).json({ error: "It is not your turn" });
      }

      // Validate Move with chess.js
      const chess = new Chess(matchData.fen);
      const result = chess.move(move);

      if (!result) {
        return res.status(400).json({ error: "Illegal move" });
      }

      // Determine new status and rewards
      let status = "active";
      let winner = null;
      let payoutProcessed = false;

      if (chess.isCheckmate()) {
        status = "completed";
        winner = userId;
      } else if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition() || chess.isInsufficientMaterial()) {
        status = "draw";
      }

      // Update Match in a Transaction
      await db.runTransaction(async (transaction) => {
        const updateData: any = {
          fen: chess.fen(),
          turn: chess.turn(),
          status: status,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (winner) updateData.winner = winner;

        transaction.update(matchRef, updateData);

        // Add to moves subcollection
        const moveRef = matchRef.collection("moves").doc();
        transaction.set(moveRef, {
          from: result.from,
          to: result.to,
          san: result.san,
          fen: chess.fen(),
          player: userId,
          moveNumber: Math.ceil(chess.history().length / 2),
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        // HANDLE PAYOUTS
        if (status === "completed" && winner && matchData.wagerAmount > 0) {
          const winnerRef = db.collection("users").doc(winner);
          const pot = matchData.wagerAmount * 2;
          const fee = Math.floor(pot * 0.05);
          const reward = pot - fee;

          transaction.update(winnerRef, {
            bountyCoins: admin.firestore.FieldValue.increment(reward),
            totalBountyWon: admin.firestore.FieldValue.increment(reward - matchData.wagerAmount)
          });

          // Log transaction
          const txnRef = db.collection("transactions").doc();
          transaction.set(txnRef, {
            userId: winner,
            amount: reward,
            type: "win",
            description: `Bounty payout for match ${matchId}`,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
          });

          payoutProcessed = true;
        } else if (status === "draw" && matchData.wagerAmount > 0) {
          // Refund both players
          const whiteRef = db.collection("users").doc(matchData.playerWhite);
          const blackRef = db.collection("users").doc(matchData.playerBlack);

          transaction.update(whiteRef, { bountyCoins: admin.firestore.FieldValue.increment(matchData.wagerAmount) });
          transaction.update(blackRef, { bountyCoins: admin.firestore.FieldValue.increment(matchData.wagerAmount) });

          // Log transactions
          const txnWhite = db.collection("transactions").doc();
          const txnBlack = db.collection("transactions").doc();
          transaction.set(txnWhite, { userId: matchData.playerWhite, amount: matchData.wagerAmount, type: "purchase", description: `Wager refund for draw match ${matchId}`, timestamp: admin.firestore.FieldValue.serverTimestamp() });
          transaction.set(txnBlack, { userId: matchData.playerBlack, amount: matchData.wagerAmount, type: "purchase", description: `Wager refund for draw match ${matchId}`, timestamp: admin.firestore.FieldValue.serverTimestamp() });

          payoutProcessed = true;
        }
      });

      res.json({ success: true, fen: chess.fen(), status, winner, payoutProcessed });

      // TRIGGER AI MOVE IF NECESSARY
      if (status === "active" && (
        (matchData.playerBlack === 'AI' && chess.turn() === 'b') || 
        (matchData.playerWhite === 'AI' && chess.turn() === 'w')
      )) {
        setTimeout(async () => {
          try {
            const history = chess.history();
            const aiMoveResult = await getAiMove(chess.fen(), history);
            if (aiMoveResult && aiMoveResult.move) {
              const aiMove = chess.move(aiMoveResult.move);
              if (aiMove) {
                // Determine new status for AI move
                let aiStatus = "active";
                let aiWinner = null;
                if (chess.isCheckmate()) {
                  aiStatus = "completed";
                  aiWinner = 'AI';
                } else if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition() || chess.isInsufficientMaterial()) {
                  aiStatus = "draw";
                }

                await db.runTransaction(async (transaction) => {
                  transaction.update(matchRef, {
                    fen: chess.fen(),
                    turn: chess.turn(),
                    status: aiStatus,
                    winner: aiWinner,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                  });

                  const moveRef = matchRef.collection("moves").doc();
                  transaction.set(moveRef, {
                    from: aiMove.from,
                    to: aiMove.to,
                    san: aiMove.san,
                    fen: chess.fen(),
                    player: 'AI',
                    moveNumber: Math.ceil(chess.history().length / 2),
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                  });
                });
              }
            }
          } catch (e) {
            console.error("AI Auto-move failed:", e);
          }
        }, 1000);
      }
    } catch (error) {
      console.error("API Error (/api/move):", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // API Route: Secure Bounty Wager Initialization
  app.post("/api/matches/create", async (req, res) => {
    try {
      const db = await getDb();
      const admin = await getAdmin();
      if (!db || !admin) return res.status(500).json({ error: "Database not available" });

      const { userId, wagerAmount, timeControl, isRated } = req.body;

      if (!userId || wagerAmount === undefined) {
        return res.status(400).json({ error: "Missing fields" });
      }

      const userRef = db.collection("users").doc(userId);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        return res.status(404).json({ error: "User profile not found" });
      }

      const userData = userDoc.data();
      if ((userData?.bountyCoins || 0) < wagerAmount) {
        return res.status(400).json({ error: "Insufficient Bounty Coins" });
      }

      // Atomic Wager & Match Creation
      const matchId = db.collection("matches").doc().id;
      const matchRef = db.collection("matches").doc(matchId);

      await db.runTransaction(async (t) => {
        // Deduct coins (Escrow)
        if (wagerAmount > 0) {
          t.update(userRef, {
            bountyCoins: admin.firestore.FieldValue.increment(-wagerAmount)
          });
          
          // Log transaction
          const txnRef = db.collection("transactions").doc();
          t.set(txnRef, {
            userId,
            amount: -wagerAmount,
            type: 'wager',
            description: `Wager for match ${matchId}`,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
          });
        }

        // Create Match
        const chess = new Chess();
        t.set(matchRef, {
          playerWhite: userId,
          playerBlack: 'Searching...',
          players: [userId],
          status: 'pending',
          fen: chess.fen(),
          turn: 'w',
          wagerAmount,
          timeControl: timeControl || 'rapid',
          isRated: isRated || false,
          variant: 'standard',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });

      res.json({ success: true, matchId });
    } catch (error) {
      console.error("API Error (/api/matches/create):", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/tournaments/create", async (req, res) => {
    try {
      const db = await getDb();
      const admin = await getAdmin();
      if (!db || !admin) return res.status(500).json({ error: "Database not available" });

      const { title, type, format, entryFee, prizePool, startTime, timeControl, maxPlayers } = req.body;

      if (!title || !type || !format || entryFee === undefined || prizePool === undefined || !startTime) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const tournamentRef = db.collection("tournaments").doc();
      await tournamentRef.set({
        title,
        type,
        format,
        status: 'upcoming',
        entryFee: Number(entryFee),
        prizePool: Number(prizePool),
        startTime,
        timeControl: timeControl || '10+0',
        playerCount: 0,
        maxPlayers: Number(maxPlayers) || 100,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      res.json({ success: true, id: tournamentRef.id });
    } catch (err: any) {
      console.error("Tournament creation failed", err);
      res.status(500).json({ error: err.message || "Failed to create tournament" });
    }
  });

  // API Route: Secure Match Join
  app.post("/api/matches/join", async (req, res) => {
    try {
      const db = await getDb();
      const admin = await getAdmin();
      if (!db || !admin) return res.status(500).json({ error: "Database not available" });

      const { matchId, userId } = req.body;

      if (!matchId || !userId) {
        return res.status(400).json({ error: "Missing fields" });
      }

      const matchRef = db.collection("matches").doc(matchId);
      const userRef = db.collection("users").doc(userId);

      await db.runTransaction(async (t) => {
        const matchDoc = await t.get(matchRef);
        const userDoc = await t.get(userRef);

        if (!matchDoc.exists || !userDoc.exists) {
          throw new Error("Match or User not found");
        }

        const matchData = matchDoc.data();
        const userData = userDoc.data();

        if (matchData?.status !== 'pending' || matchData?.playerBlack !== 'Searching...') {
          throw new Error("Match is no longer available to join");
        }

        if (matchData?.playerWhite === userId) {
          throw new Error("You cannot join your own match");
        }

        if ((userData?.bountyCoins || 0) < (matchData?.wagerAmount || 0)) {
          throw new Error("Insufficient Bounty Coins");
        }

        // Deduct Wager (Escrow)
        if (matchData?.wagerAmount > 0) {
          t.update(userRef, {
            bountyCoins: admin.firestore.FieldValue.increment(-matchData.wagerAmount)
          });

          // Log transaction
          const txnRef = db.collection("transactions").doc();
          t.set(txnRef, {
            userId,
            amount: -matchData.wagerAmount,
            type: 'wager',
            description: `Wager for joining match ${matchId}`,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
          });
        }

        // Update Match Status
        t.update(matchRef, {
          playerBlack: userId,
          playerBlackName: userData?.displayName || 'Opponent',
          players: [matchData.playerWhite, userId],
          status: 'active',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });

      res.json({ success: true });
    } catch (error) {
      console.error("API Error (/api/matches/join):", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
    }
  });

  // API Route: Practice AI Move
  app.post("/api/ai/move", async (req, res) => {
    try {
      const { fen, history } = req.body;
      if (!fen) return res.status(400).json({ error: "FEN required" });
      
      const result = await getAiMove(fen, history || []);
      if (!result) return res.status(500).json({ error: "AI failed to respond" });
      
      res.json(result);
    } catch (err) {
      console.error("AI Move API Error:", err);
      res.status(500).json({ error: "AI Move failed" });
    }
  });

  // Simple in-memory rate limiting map for payments
  const lastPaymentTime: Record<string, number> = {};

  // API Route: Initiate Pesapal Payment
  app.post("/api/payments/initiate", verifyUser, async (req: any, res: any) => {
    try {
      const db = await getDb();
      if (!db) return res.status(500).json({ error: "Database not available" });
      
      const userId = req.user.uid;
      const now = Date.now();

      // Rate limit: 1 payment request per 10 seconds per user
      if (lastPaymentTime[userId] && now - lastPaymentTime[userId] < 10000) {
        return res.status(429).json({ error: "Please wait 10 seconds before making another request." });
      }
      lastPaymentTime[userId] = now;

      const { amount, phoneNumber, network } = req.body;
      const email = req.user.email || "no-email@example.com";
      
      if (!amount || amount < 5000) {
        return res.status(400).json({ error: "Minimum amount is 5,000 UGX" });
      }
      
      if (!phoneNumber) {
        return res.status(400).json({ error: "Phone number is required" });
      }

      const token = await getPesapalToken();
      const hostUrl = req.get('origin') || process.env.APP_URL || `http://localhost:${PORT}`;
      const ipnUrl = `${hostUrl}/api/pesapal-webhook`;
      const ipnId = await registerIPN(token, ipnUrl);
      
      // Merchants reference (unique matching string logic)
      const orderId = `BC_${userId}_${Date.now()}`;
      
      const callback_url = `${hostUrl}`;

      const orderResponse = await submitOrder(token, ipnId, {
        id: orderId,
        currency: "UGX",
        amount: Number(amount),
        description: `Bounty Coins Purchase - ${amount} UGX`,
        callback_url,
        billing_address: {
          email_address: email,
          phone_number: phoneNumber,
          first_name: "Player",
          last_name: "Grandmaster"
        }
      });
      
      res.json({
        success: true,
        redirect_url: orderResponse.redirect_url,
        order_tracking_id: orderResponse.order_tracking_id,
        orderId
      });
    } catch (err: any) {
      console.error("Pesapal Initiate Error:", err);
      res.status(500).json({ error: err.message || "Failed to initiate payment" });
    }
  });

  // API Route: Pesapal Webhook (IPN)
  app.post("/api/pesapal-webhook", async (req: any, res: any) => {
    try {
      const db = await getDb();
      const admin = await getAdmin();
      if (!db || !admin) return res.status(500).json({ error: "Database not available" });
      
      console.log("Pesapal IPN payload:", req.body);
      const { OrderTrackingId, OrderNotificationType, OrderMerchantReference } = req.query;
      
      const trackingId = OrderTrackingId || req.body.OrderTrackingId;
      const merchantRef = OrderMerchantReference || req.body.OrderMerchantReference;
      
      if (!trackingId || !merchantRef) {
        return res.status(400).json({ error: "Missing tracking parameters" });
      }

      const token = await getPesapalToken();
      const statusData = await getTransactionStatus(token, trackingId);
      
      console.log("Pesapal transaction status:", statusData);
      
      if (statusData.payment_status_description === "Completed" || statusData.payment_status_description === "COMPLETED") {
        const txnRef = db.collection("transactions").doc(merchantRef);
        const txnDoc = await txnRef.get();
        
        if (txnDoc.exists) {
          const txnData: any = txnDoc.data();
          if (txnData.status === "pending") {
            const userId = txnData.userId;
            const amountPaidUgx = txnData.amount;
            const bcAmount = Math.floor(amountPaidUgx / 100); // 100 UGX = 1 BC
            
            await db.runTransaction(async (t: any) => {
              const userRef = db.collection("users").doc(userId);
              t.update(userRef, {
                bountyCoins: admin.firestore.FieldValue.increment(bcAmount)
              });
              
              t.update(txnRef, {
                status: "completed",
                type: "buy_bc_completed",
                bcAmountGranted: bcAmount,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });
            });
            console.log(`Credited ${bcAmount} BC to user ${userId} for ${amountPaidUgx} UGX via PesaPal`);
          }
        }
      } else if (statusData.payment_status_description === "Failed" || statusData.payment_status_description === "FAILED") {
        const txnRef = db.collection("transactions").doc(merchantRef);
        await txnRef.update({
          status: "failed",
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      
      res.json({
        status: 200,
        message: "IPN received successfully"
      });
    } catch (err: any) {
      console.error("Pesapal Webhook Error:", err);
      // Return 200 anyway so Pesapal stops retrying if it's our internal bug, 
      // but ideally we should only return 200 on success. For now returning 500.
      res.status(500).json({ error: "Internal server error processing IPN" });
    }
  });

  // API Route: Withdraw Request
  app.post("/api/wallet/withdraw/request", verifyUser, async (req: any, res: any) => {
    try {
      const db = await getDb();
      const admin = await getAdmin();
      if (!db || !admin) return res.status(500).json({ error: "Database not available" });
      
      const { amountUGX, phoneNumber } = req.body;
      const userId = req.user.uid;
      
      if (!amountUGX || amountUGX < 1000) {
        return res.status(400).json({ error: "Minimum withdrawal amount is 1,000 UGX" });
      }
      
      if (!phoneNumber) {
        return res.status(400).json({ error: "Phone number is required for withdrawal" });
      }
      
      const bcDeducted = Math.ceil(amountUGX / 100);
      
      // We will deduct immediately to prevent double spending
      const result = await db.runTransaction(async (t: any) => {
        const userRef = db.collection("users").doc(userId);
        const userDoc = await t.get(userRef);
        
        if (!userDoc.exists) {
          throw new Error("User not found");
        }
        
        const userData: any = userDoc.data();
        const currentBalance = userData.bountyCoins || 0;
        
        if (currentBalance < bcDeducted) {
          throw new Error("Insufficient Bounty Coins");
        }
        
        const withdrawRef = db.collection("withdrawals").doc();
        const txnRef = db.collection("transactions").doc();
        
        t.update(userRef, {
          bountyCoins: admin.firestore.FieldValue.increment(-bcDeducted)
        });
        
        t.set(withdrawRef, {
          userId,
          amountUGX,
          bcDeducted,
          phoneNumber,
          status: 'pending',
          requestedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        t.set(txnRef, {
          userId,
          amount: -bcDeducted,
          type: "withdrawal_pending",
          description: `Withdrawal request for ${amountUGX} UGX`,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          withdrawalId: withdrawRef.id
        });
        
        return withdrawRef.id;
      });
      
      res.json({ success: true, requestId: result });
    } catch (err: any) {
      console.error("Withdraw Request Error:", err);
      res.status(500).json({ error: err.message || "Failed to process withdrawal request" });
    }
  });

  // API Route: Process Withdrawal (Admin)
  app.post("/api/admin/withdrawals/process", verifyAdmin, async (req: any, res: any) => {
    try {
      const db = await getDb();
      const admin = await getAdmin();
      if (!db || !admin) return res.status(500).json({ error: "Database not available" });
      
      const { requestId, status, adminNotes } = req.body;
      
      if (!requestId || !status) {
        return res.status(400).json({ error: "requestId and status are required" });
      }
      
      const withdrawRef = db.collection("withdrawals").doc(requestId);
      
      await db.runTransaction(async (t: any) => {
        const withdrawDoc = await t.get(withdrawRef);
        
        if (!withdrawDoc.exists) {
          throw new Error("Withdrawal request not found");
        }
        
        const data: any = withdrawDoc.data();
        if (data.status !== 'pending' && data.status !== 'processing') {
          throw new Error(`Cannot process request in ${data.status} state`);
        }
        
        t.update(withdrawRef, {
          status,
          adminNotes: adminNotes || null,
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
          processedBy: req.user.uid
        });
        
        // If failed, refund the BC
        if (status === 'failed') {
           const userRef = db.collection("users").doc(data.userId);
           t.update(userRef, {
             bountyCoins: admin.firestore.FieldValue.increment(data.bcDeducted)
           });
           
           const txnRef = db.collection("transactions").doc();
           t.set(txnRef, {
             userId: data.userId,
             amount: data.bcDeducted,
             type: "withdrawal_refund",
             description: `Refund for failed withdrawal of ${data.amountUGX} UGX`,
             timestamp: admin.firestore.FieldValue.serverTimestamp(),
             withdrawalId: requestId
           });
        } else if (status === 'completed') {
           // update transaction status to completed
           const txnsQuery = await t.get(db.collection("transactions").where("withdrawalId", "==", requestId).where("type", "==", "withdrawal_pending").limit(1));
           if (!txnsQuery.empty) {
             const txnDoc = txnsQuery.docs[0];
             t.update(txnDoc.ref, {
               type: "withdrawal_completed"
             });
           }
        }
      });
      
      res.json({ success: true, message: `Withdrawal request ${status}` });
    } catch (err: any) {
      console.error("Process Withdrawal Error:", err);
      res.status(500).json({ error: err.message || "Failed to process withdrawal" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("Creating Vite server...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
      optimizeDeps: {
        // Exclude large packages to speed up startup
        exclude: ['firebase-admin']
      }
    });
    app.use(vite.middlewares);
    console.log("Vite middleware mounted.");
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
