#!/usr/bin/env node
/**
 * Hacker Family Feud - Game Server
 *
 * WebSocket server managing the full Family Feud state machine.
 * Syncs game state between host console and audience board views.
 * Optionally connects to the DFIU buzzer server for face-offs.
 *
 * Usage: node server.js [port]
 * Default port: 3003
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = parseInt(process.argv[2] || '3003', 10);

// --- MIME types ---
const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};

// --- HTTP Server ---
const server = http.createServer((req, res) => {
  // CORS for local dev
  res.setHeader('Access-Control-Allow-Origin', '*');

  let filePath = req.url === '/' ? '/host.html' : req.url;
  filePath = filePath.split('?')[0];

  // API: list available surveys
  if (filePath === '/api/surveys') {
    const surveyDir = path.join(__dirname, 'surveys');
    try {
      const files = fs.readdirSync(surveyDir).filter(f => f.endsWith('.json'));
      const surveys = files.map(f => {
        const data = JSON.parse(fs.readFileSync(path.join(surveyDir, f), 'utf8'));
        return { file: f, name: data.name || f, rounds: (data.rounds || []).length, fastMoney: (data.fastMoney || []).length };
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(surveys));
    } catch {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('[]');
    }
    return;
  }

  // API: get survey data
  if (filePath.startsWith('/api/surveys/')) {
    const name = filePath.slice('/api/surveys/'.length);
    const safeName = path.basename(name);
    const fullPath = path.join(__dirname, 'surveys', safeName);
    fs.readFile(fullPath, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end('{"error":"not found"}');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data);
    });
    return;
  }

  const fullPath = path.join(__dirname, filePath);
  const ext = path.extname(fullPath);

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

// --- Game State ---

const DEFAULT_MULTIPLIERS = [1, 1, 2, 3]; // Rounds 1-4

function createGameState() {
  return {
    phase: 'lobby',       // lobby | faceoff | play_pass | play | steal | score | fast_money_setup | fast_money_p1 | fast_money_p2 | fast_money_reveal | game_over
    teams: [
      { name: 'Team 1', score: 0, players: [] },
      { name: 'Team 2', score: 0, players: [] },
    ],
    round: 0,             // 0-indexed current round
    multipliers: [...DEFAULT_MULTIPLIERS],
    winTarget: 300,

    // Current round state
    currentQuestion: null, // { question, survey, answers: [{ text, points, revealed }] }
    controllingTeam: -1,   // 0 or 1
    strikes: 0,
    roundPoints: 0,        // Accumulated points this round
    faceoffAnswers: [null, null], // Team answers during face-off
    faceoffBuzzer: -1,     // Which team buzzed first (0 or 1)

    // Fast Money state
    fastMoney: null,       // { questions, p1Answers, p2Answers, p1Time, p2Time, currentPlayer, currentQ, timer, totalPoints }

    // Survey data
    surveyFile: null,
    surveyData: null,      // Full loaded survey
  };
}

let game = createGameState();

// --- WebSocket Server ---

const wss = new WebSocketServer({ server });
const clients = new Set(); // All connected clients
let hostWs = null;

function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(data);
  }
}

function sendTo(ws, msg) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
}

function sendState() {
  broadcast({ type: 'game-state', state: sanitizeState(game) });
}

// Strip internal data from state sent to clients
function sanitizeState(g) {
  const s = JSON.parse(JSON.stringify(g));
  // Don't send full survey data to clients
  delete s.surveyData;
  return s;
}

// Get multiplier for current round
function getMultiplier() {
  if (game.round < game.multipliers.length) return game.multipliers[game.round];
  return 3; // Sudden death rounds
}

// Calculate points for a revealed answer
function answerPoints(basePoints) {
  return basePoints * getMultiplier();
}

// Check win condition
function checkWin() {
  return game.teams.some(t => t.score >= game.winTarget);
}

// Get the winner index, or -1
function getWinner() {
  for (let i = 0; i < game.teams.length; i++) {
    if (game.teams[i].score >= game.winTarget) return i;
  }
  return -1;
}

// Load a round question from survey data
function loadRound(roundIndex) {
  if (!game.surveyData || !game.surveyData.rounds[roundIndex]) return false;
  const q = game.surveyData.rounds[roundIndex];
  game.currentQuestion = {
    question: q.question,
    survey: q.survey || 'We surveyed 100 hackers',
    answers: q.answers.map(a => ({
      text: a.text,
      points: a.points,
      revealed: false,
    })),
  };
  game.strikes = 0;
  game.roundPoints = 0;
  game.controllingTeam = -1;
  game.faceoffAnswers = [null, null];
  game.faceoffBuzzer = -1;
  return true;
}

// --- Message Handlers ---

function handleMessage(ws, msg) {
  switch (msg.type) {
    // --- Connection ---
    case 'register-host':
      hostWs = ws;
      sendTo(ws, { type: 'game-state', state: sanitizeState(game) });
      break;

    case 'register-board':
      sendTo(ws, { type: 'game-state', state: sanitizeState(game) });
      break;

    // --- Game Setup ---
    case 'load-survey': {
      if (ws !== hostWs) return;
      const surveyPath = path.join(__dirname, 'surveys', path.basename(msg.file));
      try {
        const data = JSON.parse(fs.readFileSync(surveyPath, 'utf8'));
        game = createGameState();
        game.surveyFile = msg.file;
        game.surveyData = data;
        if (data.teams) {
          if (data.teams[0]) game.teams[0].name = data.teams[0];
          if (data.teams[1]) game.teams[1].name = data.teams[1];
        }
        sendState();
      } catch (e) {
        sendTo(ws, { type: 'error', message: 'Failed to load survey: ' + e.message });
      }
      break;
    }

    case 'set-teams': {
      if (ws !== hostWs) return;
      if (msg.team1) game.teams[0].name = msg.team1.slice(0, 40);
      if (msg.team2) game.teams[1].name = msg.team2.slice(0, 40);
      sendState();
      break;
    }

    case 'reset-game': {
      if (ws !== hostWs) return;
      const surveyData = game.surveyData;
      const surveyFile = game.surveyFile;
      game = createGameState();
      game.surveyData = surveyData;
      game.surveyFile = surveyFile;
      sendState();
      break;
    }

    // --- Round Flow ---
    case 'start-round': {
      if (ws !== hostWs) return;
      const roundIdx = msg.round != null ? msg.round : game.round;
      if (loadRound(roundIdx)) {
        game.round = roundIdx;
        game.phase = 'faceoff';
        sendState();
      } else {
        sendTo(ws, { type: 'error', message: 'No survey data for round ' + (roundIdx + 1) });
      }
      break;
    }

    // Face-off: record who buzzed and their answer
    case 'faceoff-buzz': {
      if (ws !== hostWs) return;
      const team = msg.team; // 0 or 1
      if (team !== 0 && team !== 1) return;
      game.faceoffBuzzer = team;
      sendState();
      break;
    }

    case 'faceoff-answer': {
      if (ws !== hostWs) return;
      const team = msg.team;
      if (team !== 0 && team !== 1) return;
      game.faceoffAnswers[team] = {
        answerIndex: msg.answerIndex, // index into answers array, or -1 if not on board
        text: msg.text || '',
      };
      sendState();
      break;
    }

    // Resolve face-off: determines who gets control
    case 'faceoff-resolve': {
      if (ws !== hostWs) return;
      // Reveal the face-off answers on the board
      for (const fa of game.faceoffAnswers) {
        if (fa && fa.answerIndex >= 0 && game.currentQuestion) {
          const ans = game.currentQuestion.answers[fa.answerIndex];
          if (ans && !ans.revealed) {
            ans.revealed = true;
            game.roundPoints += answerPoints(ans.points);
          }
        }
      }
      // Determine who won face-off
      const a0 = game.faceoffAnswers[0];
      const a1 = game.faceoffAnswers[1];
      let winner;
      if (msg.winner != null) {
        winner = msg.winner; // Host override
      } else {
        // Higher ranked (lower index) wins. #1 answer auto-wins.
        const rank0 = a0 && a0.answerIndex >= 0 ? a0.answerIndex : 999;
        const rank1 = a1 && a1.answerIndex >= 0 ? a1.answerIndex : 999;
        if (rank0 < rank1) winner = 0;
        else if (rank1 < rank0) winner = 1;
        else winner = game.faceoffBuzzer >= 0 ? game.faceoffBuzzer : 0; // Tie: buzzer winner
      }
      game.controllingTeam = winner;
      game.phase = 'play_pass';
      sendState();
      break;
    }

    // Play or pass decision
    case 'play-pass': {
      if (ws !== hostWs) return;
      if (msg.action === 'pass') {
        game.controllingTeam = game.controllingTeam === 0 ? 1 : 0;
      }
      game.phase = 'play';
      sendState();
      break;
    }

    // Reveal an answer during play
    case 'reveal-answer': {
      if (ws !== hostWs) return;
      if (!game.currentQuestion) return;
      const idx = msg.index;
      const ans = game.currentQuestion.answers[idx];
      if (ans && !ans.revealed) {
        ans.revealed = true;
        game.roundPoints += answerPoints(ans.points);
        // Check if all answers revealed
        if (game.currentQuestion.answers.every(a => a.revealed)) {
          // Round won - all answers found
          game.teams[game.controllingTeam].score += game.roundPoints;
          game.phase = 'score';
        }
        sendState();
      }
      break;
    }

    // Add a strike
    case 'strike': {
      if (ws !== hostWs) return;
      game.strikes++;
      broadcast({ type: 'strike', count: game.strikes });
      if (game.strikes >= 3) {
        game.phase = 'steal';
      }
      sendState();
      break;
    }

    // Steal attempt result
    case 'steal-result': {
      if (ws !== hostWs) return;
      const stealTeam = game.controllingTeam === 0 ? 1 : 0;
      if (msg.success) {
        // Stealing team gets all points
        // Reveal the stolen answer if provided
        if (msg.answerIndex >= 0 && game.currentQuestion) {
          const ans = game.currentQuestion.answers[msg.answerIndex];
          if (ans && !ans.revealed) {
            ans.revealed = true;
            game.roundPoints += answerPoints(ans.points);
          }
        }
        game.teams[stealTeam].score += game.roundPoints;
      } else {
        // Controlling team keeps points
        game.teams[game.controllingTeam].score += game.roundPoints;
      }
      // Reveal all remaining answers
      if (game.currentQuestion) {
        for (const ans of game.currentQuestion.answers) {
          if (!ans.revealed) {
            ans.revealed = true;
          }
        }
      }
      game.phase = 'score';
      sendState();
      break;
    }

    // Move to next round or end game
    case 'next-round': {
      if (ws !== hostWs) return;
      if (checkWin()) {
        const winner = getWinner();
        game.phase = 'fast_money_setup';
        game.fastMoney = {
          winningTeam: winner,
          questions: [],
          p1Answers: [],
          p2Answers: [],
          p1Time: 20,
          p2Time: 25,
          currentPlayer: 1,
          currentQ: 0,
          timer: 0,
          timerRunning: false,
          totalPoints: 0,
          revealing: false,
          revealIndex: 0,
        };
        // Load fast money questions
        if (game.surveyData && game.surveyData.fastMoney) {
          game.fastMoney.questions = game.surveyData.fastMoney.map(q => ({
            question: q.question,
            answers: q.answers,
          }));
        }
        sendState();
      } else {
        game.round++;
        if (loadRound(game.round)) {
          game.phase = 'faceoff';
        } else {
          // No more rounds - highest score wins
          game.phase = 'game_over';
        }
        sendState();
      }
      break;
    }

    // --- Fast Money ---
    case 'fast-money-answer': {
      if (ws !== hostWs || !game.fastMoney) return;
      const fm = game.fastMoney;
      const player = fm.currentPlayer; // 1 or 2
      const arr = player === 1 ? fm.p1Answers : fm.p2Answers;
      arr[fm.currentQ] = {
        text: msg.text || '',
        points: msg.points || 0,
        duplicate: msg.duplicate || false,
      };
      sendState();
      break;
    }

    case 'fast-money-next-q': {
      if (ws !== hostWs || !game.fastMoney) return;
      const fm = game.fastMoney;
      if (fm.currentQ < fm.questions.length - 1) {
        fm.currentQ++;
      }
      sendState();
      break;
    }

    case 'fast-money-player2': {
      if (ws !== hostWs || !game.fastMoney) return;
      game.fastMoney.currentPlayer = 2;
      game.fastMoney.currentQ = 0;
      game.phase = 'fast_money_p2';
      sendState();
      break;
    }

    case 'fast-money-start-timer': {
      if (ws !== hostWs || !game.fastMoney) return;
      const fm = game.fastMoney;
      fm.timerRunning = true;
      const limit = fm.currentPlayer === 1 ? fm.p1Time : fm.p2Time;
      fm.timer = limit;
      game.phase = fm.currentPlayer === 1 ? 'fast_money_p1' : 'fast_money_p2';
      sendState();
      // Server-side timer
      const interval = setInterval(() => {
        if (!fm.timerRunning || fm.timer <= 0) {
          clearInterval(interval);
          fm.timerRunning = false;
          sendState();
          return;
        }
        fm.timer--;
        broadcast({ type: 'timer-tick', timer: fm.timer });
        if (fm.timer <= 0) {
          clearInterval(interval);
          fm.timerRunning = false;
          sendState();
        }
      }, 1000);
      break;
    }

    case 'fast-money-stop-timer': {
      if (ws !== hostWs || !game.fastMoney) return;
      game.fastMoney.timerRunning = false;
      sendState();
      break;
    }

    case 'fast-money-reveal': {
      if (ws !== hostWs || !game.fastMoney) return;
      game.fastMoney.revealing = true;
      game.phase = 'fast_money_reveal';
      // Calculate total
      let total = 0;
      for (const a of game.fastMoney.p1Answers) {
        if (a) total += a.points;
      }
      for (const a of game.fastMoney.p2Answers) {
        if (a) total += a.points;
      }
      game.fastMoney.totalPoints = total;
      sendState();
      break;
    }

    case 'fast-money-reveal-next': {
      if (ws !== hostWs || !game.fastMoney) return;
      game.fastMoney.revealIndex++;
      sendState();
      break;
    }

    case 'end-game': {
      if (ws !== hostWs) return;
      game.phase = 'game_over';
      sendState();
      break;
    }

    // --- Score adjustments ---
    case 'adjust-score': {
      if (ws !== hostWs) return;
      const team = msg.team;
      if (team !== 0 && team !== 1) return;
      game.teams[team].score += (msg.amount || 0);
      if (game.teams[team].score < 0) game.teams[team].score = 0;
      sendState();
      break;
    }
  }
}

// --- WebSocket Connection Handling ---

wss.on('connection', (ws) => {
  clients.add(ws);

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    handleMessage(ws, msg);
  });

  ws.on('close', () => {
    clients.delete(ws);
    if (ws === hostWs) hostWs = null;
  });
});

server.listen(PORT, () => {
  console.log(`Hacker Family Feud server on http://localhost:${PORT}`);
  console.log(`  Host console: http://localhost:${PORT}/host.html`);
  console.log(`  Audience board: http://localhost:${PORT}/board.html`);
});
