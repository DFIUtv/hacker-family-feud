# Hacker Family Feud - Game Design Document

## Overview

Hacker Family Feud adapts the classic Family Feud TV game show format for the hacker/infosec community. Two teams compete to guess the most popular responses to survey questions posed to 100 hackers, security professionals, and tech enthusiasts.

The original Family Feud premiered in 1976 (hosted by Richard Dawson) and has run in various incarnations since, currently hosted by Steve Harvey. Our adaptation preserves the core mechanics while theming all content around hacking, security, programming, and tech culture.

---

## Game Mechanics

### Teams

- **2 teams** of **5 players** each
- Each team designates a **captain** (important for steal rounds)
- Teams decide their play order before the game starts
- In hacker context: teams could be named after hacker groups, CTF teams, programming languages, etc.

### Round Structure

A standard game consists of **4 main rounds**, with an optional **Sudden Death** tiebreaker and a **Fast Money** bonus round.

| Round | Point Multiplier | Notes |
|-------|-----------------|-------|
| Round 1 | 1x (single) | Standard play |
| Round 2 | 1x (single) | Standard play |
| Round 3 | 2x (double) | All point values doubled |
| Round 4 | 3x (triple) | All point values tripled |
| Sudden Death | 3x (triple) | Only if neither team has 300 points after Round 4 |

**Win condition:** First team to reach **300 points** wins and advances to Fast Money.

If neither team reaches 300 after 4 rounds, a Sudden Death face-off round is played (triple value) until a winner is determined.

### The Survey

- Each question was posed to **100 people** (in our case, 100 hackers/security pros/tech people)
- The board displays the **top 4-8 answers** (varies per question)
- Each answer is worth **1 point per survey respondent** who gave that answer (before round multiplier)
- Points on the board do NOT always sum to 100 — only the most popular answers are shown
- Example: "We surveyed 100 hackers. Top 6 answers are on the board..."

### Round Flow

Each round follows this sequence:

#### 1. Face-Off
- One player from each team steps up to the buzzers
- Host reads the survey question
- First player to **buzz in** gives an answer
- If it's the **#1 answer**, their team automatically wins the face-off
- If not, the opponent gets a chance to answer
- Whoever named the **higher-ranked answer** wins the face-off (ties broken by who buzzed first)
- Winner's team chooses to **play** or **pass** control to the other team

#### 2. Play Phase
- The team with control tries to guess all remaining answers on the board
- Players answer **one at a time in order** (no consulting teammates)
- Each wrong answer = **1 strike** (shown as a big red X)
- If all answers are revealed before 3 strikes: team wins the round and gets all points
- Must answer within a few seconds or it counts as a strike

#### 3. Steal Attempt
- After **3 strikes**, the opposing team gets **one chance to steal**
- The team may **huddle and confer** before answering
- The **team captain** delivers the final steal answer
- If the steal answer is on the board: stealing team gets **all accumulated points** for the round
- If the steal answer is wrong: the controlling team keeps the points anyway

### Fast Money (Bonus Round)

Played by the **winning team** after reaching 300 points.

#### Setup
- Team selects **2 players**
- Player 2 goes offstage/is isolated (cannot hear Player 1's answers)

#### Player 1
- Host asks **5 rapid-fire survey questions**
- Player has **20 seconds** to answer all 5
- Each answer scores points equal to the number of survey respondents who gave that answer
- Unanswered questions score 0

#### Player 2
- Returns to the stage; Player 1's answers are hidden
- Same **5 questions** are asked
- Player has **25 seconds** to answer all 5
- If Player 2 gives the **same answer** as Player 1, a buzzer sounds and they must give a different answer

#### Scoring
- Points from both players are **combined**
- If the combined total reaches **200 or more**, the team wins the **grand prize**
- Points are revealed one at a time for dramatic effect

---

## Hacker Adaptation

### Survey Pool

Instead of "100 people," surveys should be framed as:
- "We surveyed 100 hackers..."
- "We surveyed 100 security professionals..."
- "We surveyed 100 programmers..."
- "We surveyed 100 sysadmins..."

For a live event, surveys can be conducted beforehand via a web form sent to the hacker/infosec community. For a standalone game, survey results are pre-authored by the content team to reflect realistic community consensus.

### Question Categories & Examples

#### Tools & Technology
- "Name something you'd find in a pentester's toolkit"
  - Answers: Burp Suite (28), Nmap (24), Metasploit (18), Wireshark (12), John the Ripper (8), Hashcat (5)
- "Name a programming language hackers love"
  - Answers: Python (35), C (20), Bash (15), Go (10), Rust (8), JavaScript (7)
- "Name a Linux distro used for security testing"
  - Answers: Kali (45), Parrot (20), BlackArch (12), Tails (10), Qubes (5)

#### Culture & Community
- "Name a hacker conference"
  - Answers: DEF CON (40), Black Hat (25), RSA (12), CCC (8), BSides (7), ShmooCon (4)
- "Name something a hacker has too many of"
  - Answers: Passwords (22), Monitors (18), Stickers (16), Hoodies (14), Side projects (12), Tabs open (10)
- "Name a reason a developer loses sleep"
  - Answers: Production is down (30), Deadline (22), Bug they can't find (18), On-call page (12), Security breach (10)

#### Security Concepts
- "Name a type of cyber attack"
  - Answers: Phishing (30), Ransomware (22), DDoS (16), SQL injection (12), XSS (8), Man-in-the-middle (6)
- "Name something you should never reuse"
  - Answers: Passwords (40), Needles (20), Keys (15), Encryption nonces (10), Underwear (8)

#### History & Lore
- "Name a famous data breach"
  - Answers: Equifax (25), Yahoo (20), Target (15), SolarWinds (12), Sony (10), LinkedIn (8)
- "Name a legendary hacker or group"
  - Answers: Kevin Mitnick (25), Anonymous (22), LulzSec (15), Cult of the Dead Cow (12), Phineas Fisher (8)

### Tone
- Irreverent but knowledgeable — humor comes from shared experience, not dumbing things down
- Answers should feel like "yeah, that's what I would've said" to the audience
- Mix serious security topics with hacker culture humor
- The host can riff on answers ("Survey says... 40 people said PASSWORDS! Come on, people, use a password manager!")

---

## Buzzer Integration

### Face-Off Buzzers
- Reuse the existing DFIU buzzer system (`platform/buzzer/`)
- Face-off: two players are "armed" on buzzers, first to press wins the face-off opportunity
- Buzzer server locks all buzzers except the two face-off contestants
- After face-off resolves, buzzers are locked until the next face-off

### Buzzer States During a Round
| Phase | Buzzer State |
|-------|-------------|
| Face-off | 2 players armed, first press wins |
| Play phase | Buzzers locked (answers given verbally in order) |
| Steal huddle | Buzzers locked |
| Between rounds | Buzzers locked |
| Fast Money | Buzzers not used (timed verbal answers) |

---

## Content Format

### Survey Question File Format

Each question is a self-contained unit. Suggested format for content files:

```
QUESTION: Name something you'd find in a pentester's toolkit
SURVEY: 100 hackers
ANSWERS: 6
1. Burp Suite | 28
2. Nmap | 24
3. Metasploit | 18
4. Wireshark | 12
5. John the Ripper | 8
6. Hashcat | 5
```

Fields:
- `QUESTION` — the survey prompt read by the host
- `SURVEY` — who was surveyed and how many (always 100)
- `ANSWERS` — number of answers on the board (4-8)
- Numbered list — answer text, pipe separator, point value
- Answers are ordered by point value descending (most popular first)
- Point values represent how many out of 100 surveyed gave that answer

### Content Volume

A single game needs:
- **4-5 main round questions** (4 rounds + possible Sudden Death)
- **5 Fast Money questions** (shorter, quicker questions)
- **Total: ~10 questions per game**

For a good content library, aim for **50+ main round questions** and **30+ Fast Money questions** to allow variety across shows.

### Fast Money Question Format

Fast Money questions should be quicker/simpler — they need to be answerable in ~4 seconds each:

```
FAST_MONEY: Name a port number every hacker knows
1. 80 | 30
2. 443 | 25
3. 22 | 20
4. 21 | 10
5. 3389 | 8
6. 8080 | 4
```

---

## UI/UX Considerations

### Game Board Display
- Large board showing answer slots (numbered, hidden by default)
- Reveal animation when an answer is guessed correctly (flip/slide)
- Point values shown next to each answer
- Running score for both teams prominently displayed
- Strike indicators (big red X) with sound effect
- Round multiplier indicator (DOUBLE / TRIPLE)

### Host Console
- Read the current question
- Reveal answers (click to flip)
- Add strikes
- Control play/pass decision
- Trigger steal phase
- Manage Fast Money timer and reveals
- Override/manual point adjustments

### Audience View
- Same board as host but read-only
- Animated reveals and score updates
- Sound effects: ding (correct), buzz (strike), theme music

---

## Differences from Hacker Jeopardy

| Aspect | Hacker Jeopardy | Hacker Family Feud |
|--------|-----------------|-------------------|
| Teams | Individual players | 5-person teams |
| Answers | One correct answer | Multiple valid answers, ranked by popularity |
| Knowledge type | Factual recall | Community consensus / opinion |
| Buzzers | Used for every clue | Used only for face-offs |
| Scoring | Fixed dollar values per clue | Variable (survey popularity x round multiplier) |
| Content tone | Precise, factual | Conversational, opinion-based |
| Host role | Read clues, judge answers | Read questions, manage flow, entertain |
| Audience engagement | Passive viewing | Can relate to survey answers, react to reveals |

---

## Technical Notes

- The survey data doesn't need to come from real surveys for v1 — the content team can author realistic answer distributions
- Point values should feel realistic (popular answers: 25-45, mid-tier: 10-20, obscure: 3-8)
- Total points across all answers for a question typically sum to 70-95 (not always 100)
- Fast Money timer needs to be precise and visible
- Sound effects are critical to the experience (ding, buzz, strike X, theme music)
- The game state machine is more complex than Jeopardy: face-off -> play/pass -> play -> steal -> score -> next round

---

## References

- [Family Feud Rules Overview (LiveAbout)](https://www.liveabout.com/family-feud-brief-overview-1396911)
- [Family Feud - Wikipedia](https://en.wikipedia.org/wiki/Family_Feud)
- [Family Feud Official Rules (UltraBoardGames)](https://www.ultraboardgames.com/family-feud/game-rules.php)
- [Fast Money / Big Money (Family Feud Wiki)](https://familyfeud.fandom.com/wiki/Fast_Money/Big_Money)
- [Family Feud Scoring Systems (Game Show Forum)](https://www.gameshowforum.org/index.php?topic=1182.0)
- [How Family Feud Gets Its Answers (Museum of Play)](https://www.museumofplay.org/blog/family-feud/)
