const gameBoard = document.querySelector("#gameboard");
const playerDisplay = document.querySelector("#player");
const infoDisplay = document.querySelector("#info-display");
const promotionModal = document.querySelector("#promotion-modal");
const modalOverlay = document.querySelector("#modal-overlay");
const width = 8;
let playerGo = "black";
let gameOver = false;
let gameMode = "human-vs-human";
let botDifficulty = "medium";
let botThinking = false;
let gamePaused = false;
let currentGame = {
  board: [],
  kings: { white: null, black: null },
  inCheck: { white: false, black: false },
};

// Initialize starting position without flipping logic
const startPieces = [
  rook,
  knight,
  bishop,
  queen,
  king,
  bishop,
  knight,
  rook,
  pawn,
  pawn,
  pawn,
  pawn,
  pawn,
  pawn,
  pawn,
  pawn,
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  pawn,
  pawn,
  pawn,
  pawn,
  pawn,
  pawn,
  pawn,
  pawn,
  rook,
  knight,
  bishop,
  queen,
  king,
  bishop,
  knight,
  rook,
];

// Helper functions for board coordinates
function getRow(index) {
  return Math.floor(index / 8);
}

function getCol(index) {
  return index % 8;
}

function getIndex(row, col) {
  return row * 8 + col;
}

function isValidIndex(index) {
  return index >= 0 && index < 64;
}

function isValidRowCol(row, col) {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

function createBoard() {
  gameBoard.innerHTML = "";
  currentGame.board = [];

  startPieces.forEach((piece, i) => {
    const square = document.createElement("div");
    square.classList.add("square");
    square.innerHTML = piece;
    square.setAttribute("square-id", i);

    // Add piece info to game state
    currentGame.board[i] = {
      piece: piece ? getPieceType(piece) : null,
      color: piece ? getPieceColor(piece, i) : null,
      element: square,
    };

    // Store king positions
    if (piece && getPieceType(piece) === "king") {
      const color = getPieceColor(piece, i);
      currentGame.kings[color] = i;
    }

    // Set draggable and color pieces
    if (square.firstChild) {
      square.firstChild.setAttribute("draggable", true);

      // Color the pieces based on position
      if (i <= 15) {
        square.firstChild.firstChild.classList.add("black");
      } else if (i >= 48) {
        square.firstChild.firstChild.classList.add("white");
      }
    }

    // Color the squares
    const row = getRow(i);
    if (row % 2 === 0) {
      square.classList.add(i % 2 === 0 ? "beige" : "brown");
    } else {
      square.classList.add(i % 2 === 0 ? "brown" : "beige");
    }

    gameBoard.append(square);
  });

  setupEventListeners();
}

function getPieceType(pieceHTML) {
  if (pieceHTML.includes('id="king"')) return "king";
  if (pieceHTML.includes('id="queen"')) return "queen";
  if (pieceHTML.includes('id="rook"')) return "rook";
  if (pieceHTML.includes('id="bishop"')) return "bishop";
  if (pieceHTML.includes('id="knight"')) return "knight";
  if (pieceHTML.includes('id="pawn"')) return "pawn";
  return null;
}

function getPieceColor(pieceHTML, position) {
  // Black pieces start on rows 0-1 (positions 0-15)
  // White pieces start on rows 6-7 (positions 48-63)
  if (position <= 15) return "black";
  if (position >= 48) return "white";
  return null;
}

let draggedElement = null;
let startPositionId = null;

function setupEventListeners() {
  const allSquares = document.querySelectorAll(".square");
  allSquares.forEach((square) => {
    square.addEventListener("dragstart", dragStart);
    square.addEventListener("dragover", dragOver);
    square.addEventListener("drop", dragDrop);
    square.addEventListener("click", handleSquareClick);
  });
}

function dragStart(e) {
  if (gameOver || botThinking || gamePaused) return;

  const piece = e.target;
  const square = piece.parentNode;
  startPositionId = parseInt(square.getAttribute("square-id"));

  const pieceColor = currentGame.board[startPositionId]?.color;

  // Prevent human from moving bot pieces
  if (gameMode === "human-vs-bot" && pieceColor === "white") {
    e.preventDefault();
    return;
  }

  if (gameMode === "bot-vs-bot") {
    e.preventDefault();
    return;
  }

  if (pieceColor !== playerGo) {
    e.preventDefault();
    return;
  }

  draggedElement = piece;
  clearHighlights();
}

function dragOver(e) {
  e.preventDefault();
}

function dragDrop(e) {
  e.stopPropagation();
  if (!draggedElement || gameOver || botThinking || gamePaused) return;

  let targetSquare = e.target;
  if (targetSquare.classList.contains("piece")) {
    targetSquare = targetSquare.parentNode;
  }

  const targetId = parseInt(targetSquare.getAttribute("square-id"));
  attemptMove(startPositionId, targetId);

  draggedElement = null;
  startPositionId = null;
}

function handleSquareClick(e) {
  if (gameOver || botThinking || gamePaused) return;
  if (gameMode === "bot-vs-bot") return;
  if (gameMode === "human-vs-bot" && playerGo === "white") return;
  // Additional click-based move logic could be added here
}

function attemptMove(fromId, toId) {
  if (!isValidMove(fromId, toId)) {
    showMessage("Invalid move!", 2000);
    return false;
  }

  // Check if move would put own king in check
  if (wouldBeInCheck(fromId, toId, playerGo)) {
    showMessage("Move would put king in check!", 2000);
    return false;
  }

  makeMove(fromId, toId);
  return true;
}

function isValidMove(fromId, toId) {
  if (!isValidIndex(fromId) || !isValidIndex(toId)) return false;
  if (fromId === toId) return false;

  const fromPiece = currentGame.board[fromId];
  const toPiece = currentGame.board[toId];

  if (!fromPiece.piece || fromPiece.color !== playerGo) return false;
  if (toPiece.piece && toPiece.color === playerGo) return false;

  return isPieceMoveValid(fromId, toId, fromPiece.piece);
}

function isPieceMoveValid(fromId, toId, piece) {
  const fromRow = getRow(fromId);
  const fromCol = getCol(fromId);
  const toRow = getRow(toId);
  const toCol = getCol(toId);

  switch (piece) {
    case "pawn":
      return isValidPawnMove(fromId, toId, fromRow, fromCol, toRow, toCol);
    case "rook":
      return isValidRookMove(fromId, toId, fromRow, fromCol, toRow, toCol);
    case "bishop":
      return isValidBishopMove(fromId, toId, fromRow, fromCol, toRow, toCol);
    case "queen":
      return isValidQueenMove(fromId, toId, fromRow, fromCol, toRow, toCol);
    case "knight":
      return isValidKnightMove(fromId, toId, fromRow, fromCol, toRow, toCol);
    case "king":
      return isValidKingMove(fromId, toId, fromRow, fromCol, toRow, toCol);
    default:
      return false;
  }
}

function isValidPawnMove(fromId, toId, fromRow, fromCol, toRow, toCol) {
  const piece = currentGame.board[fromId];
  const target = currentGame.board[toId];
  const direction = piece.color === "black" ? 1 : -1;
  const startingRow = piece.color === "black" ? 1 : 6;

  // Forward move
  if (fromCol === toCol) {
    // Single step forward
    if (toRow === fromRow + direction && !target.piece) {
      return true;
    }
    // Double step from starting position
    if (
      fromRow === startingRow &&
      toRow === fromRow + 2 * direction &&
      !target.piece
    ) {
      return true;
    }
  }
  // Diagonal capture
  else if (Math.abs(fromCol - toCol) === 1 && toRow === fromRow + direction) {
    if (target.piece && target.color !== piece.color) {
      return true;
    }
  }

  return false;
}

function isValidRookMove(fromId, toId, fromRow, fromCol, toRow, toCol) {
  // Must move in straight line
  if (fromRow !== toRow && fromCol !== toCol) return false;

  return isPathClear(fromId, toId);
}

function isValidBishopMove(fromId, toId, fromRow, fromCol, toRow, toCol) {
  // Must move diagonally
  if (Math.abs(fromRow - toRow) !== Math.abs(fromCol - toCol)) return false;

  return isPathClear(fromId, toId);
}

function isValidQueenMove(fromId, toId, fromRow, fromCol, toRow, toCol) {
  // Combines rook and bishop moves
  const isRookMove = fromRow === toRow || fromCol === toCol;
  const isBishopMove = Math.abs(fromRow - toRow) === Math.abs(fromCol - toCol);

  if (!isRookMove && !isBishopMove) return false;

  return isPathClear(fromId, toId);
}

function isValidKnightMove(fromId, toId, fromRow, fromCol, toRow, toCol) {
  const rowDiff = Math.abs(fromRow - toRow);
  const colDiff = Math.abs(fromCol - toCol);

  return (rowDiff === 2 && colDiff === 1) || (rowDiff === 1 && colDiff === 2);
}

function isValidKingMove(fromId, toId, fromRow, fromCol, toRow, toCol) {
  const rowDiff = Math.abs(fromRow - toRow);
  const colDiff = Math.abs(fromCol - toCol);

  return rowDiff <= 1 && colDiff <= 1;
}

function isPathClear(fromId, toId) {
  const fromRow = getRow(fromId);
  const fromCol = getCol(fromId);
  const toRow = getRow(toId);
  const toCol = getCol(toId);

  const rowStep = toRow > fromRow ? 1 : toRow < fromRow ? -1 : 0;
  const colStep = toCol > fromCol ? 1 : toCol < fromCol ? -1 : 0;

  let currentRow = fromRow + rowStep;
  let currentCol = fromCol + colStep;

  while (currentRow !== toRow || currentCol !== toCol) {
    const currentId = getIndex(currentRow, currentCol);
    if (currentGame.board[currentId].piece) {
      return false;
    }
    currentRow += rowStep;
    currentCol += colStep;
  }

  return true;
}

function makeMove(fromId, toId) {
  const fromSquare = currentGame.board[fromId].element;
  const toSquare = currentGame.board[toId].element;
  const movingPiece = currentGame.board[fromId];

  // Handle capture
  if (currentGame.board[toId].piece) {
    toSquare.innerHTML = "";
  }

  // Move piece visually
  toSquare.innerHTML = fromSquare.innerHTML;
  fromSquare.innerHTML = "";

  // Update game state
  currentGame.board[toId] = {
    piece: movingPiece.piece,
    color: movingPiece.color,
    element: toSquare,
  };

  currentGame.board[fromId] = {
    piece: null,
    color: null,
    element: fromSquare,
  };

  // Update king position
  if (movingPiece.piece === "king") {
    currentGame.kings[movingPiece.color] = toId;
  }

  // Setup new piece for dragging
  if (toSquare.firstChild) {
    toSquare.firstChild.setAttribute("draggable", true);
  }

  // Check for pawn promotion
  if (movingPiece.piece === "pawn") {
    const toRow = getRow(toId);
    if (
      (movingPiece.color === "black" && toRow === 7) ||
      (movingPiece.color === "white" && toRow === 0)
    ) {
      handlePawnPromotion(toId);
      return; // Don't change player yet, wait for promotion
    }
  }

  // Update check status
  updateCheckStatus();

  // Check for checkmate/stalemate
  if (checkForGameEnd()) {
    return;
  }

  changePlayer();
}

function wouldBeInCheck(fromId, toId, color) {
  // Simulate the move
  const originalFrom = { ...currentGame.board[fromId] };
  const originalTo = { ...currentGame.board[toId] };
  const originalKingPos = currentGame.kings[color];

  // Make temporary move
  currentGame.board[toId] = { ...currentGame.board[fromId] };
  currentGame.board[fromId] = {
    piece: null,
    color: null,
    element: currentGame.board[fromId].element,
  };

  if (currentGame.board[toId].piece === "king") {
    currentGame.kings[color] = toId;
  }

  const inCheck = isKingInCheck(color);

  // Restore original state
  currentGame.board[fromId] = originalFrom;
  currentGame.board[toId] = originalTo;
  currentGame.kings[color] = originalKingPos;

  return inCheck;
}

function isKingInCheck(color) {
  const kingPos = currentGame.kings[color];
  if (kingPos === null) return false;

  const opponentColor = color === "white" ? "black" : "white";

  // Check if any opponent piece can attack the king
  for (let i = 0; i < 64; i++) {
    const piece = currentGame.board[i];
    if (piece.piece && piece.color === opponentColor) {
      if (isPieceMoveValid(i, kingPos, piece.piece)) {
        return true;
      }
    }
  }

  return false;
}

function updateCheckStatus() {
  // Clear previous check highlighting
  document.querySelectorAll(".in-check").forEach((square) => {
    square.classList.remove("in-check");
  });

  // Check both kings
  ["white", "black"].forEach((color) => {
    const inCheck = isKingInCheck(color);
    currentGame.inCheck[color] = inCheck;

    if (inCheck) {
      const kingPos = currentGame.kings[color];
      if (kingPos !== null) {
        currentGame.board[kingPos].element.classList.add("in-check");
      }
    }
  });
}

function checkForGameEnd() {
  const currentPlayerInCheck = currentGame.inCheck[playerGo];
  const hasValidMoves = hasAnyValidMoves(playerGo);

  if (!hasValidMoves) {
    if (currentPlayerInCheck) {
      // Checkmate
      const winner = playerGo === "white" ? "Black" : "White";
      showMessage(`Checkmate! ${winner} wins!`);
      endGame();
    } else {
      // Stalemate
      showMessage("Stalemate! It's a draw!");
      endGame();
    }
    return true;
  } else if (currentPlayerInCheck) {
    showMessage(
      `${playerGo.charAt(0).toUpperCase() + playerGo.slice(1)} king is in check!`,
      3000,
    );
  }

  return false;
}

function hasAnyValidMoves(color) {
  for (let from = 0; from < 64; from++) {
    const piece = currentGame.board[from];
    if (piece.piece && piece.color === color) {
      for (let to = 0; to < 64; to++) {
        if (isValidMove(from, to) && !wouldBeInCheck(from, to, color)) {
          return true;
        }
      }
    }
  }
  return false;
}

function handlePawnPromotion(pawnPosition) {
  const color = currentGame.board[pawnPosition].color;

  // Show promotion pieces in modal
  document.getElementById("promotion-queen").innerHTML = queen
    .replace('id="queen"', `id="promotion-queen-piece"`)
    .replace('class="piece"', `class="piece ${color}"`);
  document.getElementById("promotion-rook").innerHTML = rook
    .replace('id="rook"', `id="promotion-rook-piece"`)
    .replace('class="piece"', `class="piece ${color}"`);
  document.getElementById("promotion-bishop").innerHTML = bishop
    .replace('id="bishop"', `id="promotion-bishop-piece"`)
    .replace('class="piece"', `class="piece ${color}"`);
  document.getElementById("promotion-knight").innerHTML = knight
    .replace('id="knight"', `id="promotion-knight-piece"`)
    .replace('class="piece"', `class="piece ${color}"`);

  // Show modal
  promotionModal.style.display = "block";
  modalOverlay.style.display = "block";

  // Handle promotion choice
  document.querySelectorAll(".promotion-piece").forEach((piece) => {
    piece.onclick = (e) => {
      const chosenPiece = piece.getAttribute("data-piece");
      promotePawn(pawnPosition, chosenPiece);
      promotionModal.style.display = "none";
      modalOverlay.style.display = "none";

      updateCheckStatus();
      if (!checkForGameEnd()) {
        changePlayer();
      }
    };
  });
}

function promotePawn(position, newPiece) {
  const color = currentGame.board[position].color;
  let pieceHTML;

  switch (newPiece) {
    case "queen":
      pieceHTML = queen;
      break;
    case "rook":
      pieceHTML = rook;
      break;
    case "bishop":
      pieceHTML = bishop;
      break;
    case "knight":
      pieceHTML = knight;
      break;
    default:
      pieceHTML = queen;
  }

  // Update visual
  currentGame.board[position].element.innerHTML = pieceHTML;
  currentGame.board[position].element.firstChild.setAttribute(
    "draggable",
    true,
  );

  // Update game state
  currentGame.board[position].piece = newPiece;
}

function changePlayer() {
  playerGo = playerGo === "black" ? "white" : "black";
  playerDisplay.textContent = playerGo;
  clearHighlights();

  // Handle bot moves
  if (!gameOver && !gamePaused) {
    if (gameMode === "human-vs-bot" && playerGo === "white") {
      // Bot plays as white
      setTimeout(() => makeBotMove("white"), 500);
    } else if (gameMode === "bot-vs-bot") {
      // Both are bots
      setTimeout(() => makeBotMove(playerGo), 800);
    }
  }
}

function clearHighlights() {
  document.querySelectorAll(".highlight, .valid-move").forEach((square) => {
    square.classList.remove("highlight", "valid-move");
  });
}

function showMessage(message, duration = 0) {
  infoDisplay.textContent = message;
  if (duration > 0) {
    setTimeout(() => {
      if (infoDisplay.textContent === message) {
        infoDisplay.textContent = "";
      }
    }, duration);
  }
}

function endGame() {
  gameOver = true;
  document.querySelectorAll(".square").forEach((square) => {
    if (square.firstChild) {
      square.firstChild.setAttribute("draggable", false);
    }
  });
}

// Bot AI Logic
const pieceValues = {
  pawn: 100,
  knight: 320,
  bishop: 330,
  rook: 500,
  queen: 900,
  king: 20000,
};

// Position value tables (simplified)
const pawnTable = [
  0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30,
  20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10,
  0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0,
];

const knightTable = [
  -50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30,
  0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20,
  15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40,
  -50, -40, -30, -30, -30, -30, -40, -50,
];

const bishopTable = [
  -20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5,
  10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0,
  -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10,
  -10, -10, -10, -10, -10, -20,
];

function evaluateBoard() {
  let score = 0;

  for (let i = 0; i < 64; i++) {
    const piece = currentGame.board[i];
    if (!piece.piece) continue;

    let pieceValue = pieceValues[piece.piece];
    let positionValue = 0;

    // Add position bonuses
    switch (piece.piece) {
      case "pawn":
        positionValue =
          piece.color === "white" ? pawnTable[63 - i] : pawnTable[i];
        break;
      case "knight":
        positionValue =
          piece.color === "white" ? knightTable[63 - i] : knightTable[i];
        break;
      case "bishop":
        positionValue =
          piece.color === "white" ? bishopTable[63 - i] : bishopTable[i];
        break;
    }

    const totalValue = pieceValue + positionValue;
    score += piece.color === "white" ? totalValue : -totalValue;
  }

  return score;
}

function getAllValidMoves(color) {
  const moves = [];

  for (let from = 0; from < 64; from++) {
    const piece = currentGame.board[from];
    if (piece.piece && piece.color === color) {
      for (let to = 0; to < 64; to++) {
        if (isValidMove(from, to) && !wouldBeInCheck(from, to, color)) {
          moves.push({ from, to, piece: piece.piece });
        }
      }
    }
  }

  return moves;
}

function evaluateMove(move) {
  const { from, to } = move;
  const movingPiece = currentGame.board[from];
  const targetPiece = currentGame.board[to];

  let score = 0;

  // Capture bonus
  if (targetPiece.piece) {
    score += pieceValues[targetPiece.piece];

    // Bonus for capturing with lower value piece
    if (pieceValues[movingPiece.piece] < pieceValues[targetPiece.piece]) {
      score += 50;
    }
  }

  // Center control bonus
  const centerSquares = [27, 28, 35, 36];
  if (centerSquares.includes(to)) {
    score += 20;
  }

  // King safety (avoid moving king early)
  if (movingPiece.piece === "king") {
    score -= 30;
  }

  // Pawn advancement
  if (movingPiece.piece === "pawn") {
    const toRow = getRow(to);
    if (movingPiece.color === "white") {
      score += (7 - toRow) * 5;
    } else {
      score += toRow * 5;
    }
  }

  return score;
}

function getBestMove(color, depth = 2) {
  const moves = getAllValidMoves(color);
  if (moves.length === 0) return null;

  let bestMove = moves[0];
  let bestScore = -Infinity;

  // Add randomness for different difficulty levels
  const randomFactor =
    botDifficulty === "easy" ? 100 : botDifficulty === "medium" ? 50 : 10;

  for (const move of moves) {
    let score = evaluateMove(move);

    // Simulate move for deeper evaluation
    if (depth > 1) {
      // Simple one-move lookahead
      const originalFrom = { ...currentGame.board[move.from] };
      const originalTo = { ...currentGame.board[move.to] };
      const originalKingPos = currentGame.kings[color];

      // Make temporary move
      currentGame.board[move.to] = { ...currentGame.board[move.from] };
      currentGame.board[move.from] = {
        piece: null,
        color: null,
        element: currentGame.board[move.from].element,
      };

      if (currentGame.board[move.to].piece === "king") {
        currentGame.kings[color] = move.to;
      }

      // Evaluate opponent's best response
      const opponentColor = color === "white" ? "black" : "white";
      const opponentMoves = getAllValidMoves(opponentColor);
      let worstOpponentScore = Infinity;

      for (const opMove of opponentMoves.slice(0, 10)) {
        // Limit for performance
        const opponentScore = evaluateMove(opMove);
        worstOpponentScore = Math.min(worstOpponentScore, -opponentScore);
      }

      if (worstOpponentScore !== Infinity) {
        score += worstOpponentScore * 0.5;
      }

      // Restore original state
      currentGame.board[move.from] = originalFrom;
      currentGame.board[move.to] = originalTo;
      currentGame.kings[color] = originalKingPos;
    }

    // Add randomness based on difficulty
    score += (Math.random() - 0.5) * randomFactor;

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}

async function makeBotMove(color) {
  if (gameOver || botThinking || gamePaused) return;

  botThinking = true;

  // Add thinking animation class to player display
  playerDisplay.parentElement.classList.add("thinking");

  showMessage(
    `${color.charAt(0).toUpperCase() + color.slice(1)} bot is thinking...`,
  );

  // Add delay to make it feel more natural
  const thinkingTime =
    botDifficulty === "easy" ? 500 : botDifficulty === "medium" ? 1000 : 1500;

  await new Promise((resolve) => setTimeout(resolve, thinkingTime));

  const move = getBestMove(color);

  if (move && !gameOver) {
    makeMove(move.from, move.to);
  } else {
    showMessage(`No valid moves for ${color}!`);
  }

  // Remove thinking animation
  playerDisplay.parentElement.classList.remove("thinking");

  botThinking = false;
}

function pauseGame() {
  if (gameOver) return;
  gamePaused = true;
  showMessage("Game paused");
  document.getElementById("pause-btn").style.display = "none";
  document.getElementById("resume-btn").style.display = "inline-block";
}

function resumeGame() {
  if (gameOver) return;
  gamePaused = false;
  showMessage("Game resumed", 1000);
  document.getElementById("pause-btn").style.display = "inline-block";
  document.getElementById("resume-btn").style.display = "none";

  // Resume bot moves if needed
  if (gameMode === "human-vs-bot" && playerGo === "white") {
    setTimeout(() => makeBotMove("white"), 500);
  } else if (gameMode === "bot-vs-bot") {
    setTimeout(() => makeBotMove(playerGo), 500);
  }
}

// Game mode handling
function initializeGame() {
  gameOver = false;
  botThinking = false;
  gamePaused = false;
  playerGo = "black";
  currentGame = {
    board: [],
    kings: { white: null, black: null },
    inCheck: { white: false, black: false },
  };

  createBoard();
  playerDisplay.textContent = playerGo;
  infoDisplay.textContent = "";

  // Update UI buttons
  const pauseBtn = document.getElementById("pause-btn");
  const resumeBtn = document.getElementById("resume-btn");

  if (gameMode === "bot-vs-bot") {
    pauseBtn.style.display = "inline-block";
    resumeBtn.style.display = "none";
    setTimeout(() => makeBotMove("black"), 1000);
  } else if (gameMode === "human-vs-bot") {
    pauseBtn.style.display = "inline-block";
    resumeBtn.style.display = "none";
  } else {
    pauseBtn.style.display = "none";
    resumeBtn.style.display = "none";
  }
}

// Event listeners for game controls
document.addEventListener("DOMContentLoaded", function () {
  const gameModeSelect = document.getElementById("game-mode");
  const difficultySelect = document.getElementById("bot-difficulty");
  const difficultyDiv = document.querySelector(".difficulty-selection");
  const newGameBtn = document.getElementById("new-game-btn");
  const pauseBtn = document.getElementById("pause-btn");
  const resumeBtn = document.getElementById("resume-btn");

  gameModeSelect.addEventListener("change", function () {
    gameMode = this.value;
    if (gameMode === "human-vs-human") {
      difficultyDiv.style.display = "none";
    } else {
      difficultyDiv.style.display = "block";
    }
  });

  difficultySelect.addEventListener("change", function () {
    botDifficulty = this.value;
  });

  newGameBtn.addEventListener("click", function () {
    initializeGame();
  });

  pauseBtn.addEventListener("click", pauseGame);
  resumeBtn.addEventListener("click", resumeGame);

  // Dark mode toggle
  const darkModeToggle = document.getElementById("dark-mode-toggle");

  // Check for saved theme preference or default to 'light'
  const savedTheme = localStorage.getItem("chess-theme") || "light";
  if (savedTheme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
    darkModeToggle.checked = true;
  }

  darkModeToggle.addEventListener("change", function () {
    if (this.checked) {
      document.documentElement.setAttribute("data-theme", "dark");
      localStorage.setItem("chess-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem("chess-theme", "light");
    }
  });

  // Initialize the game
  initializeGame();
});
