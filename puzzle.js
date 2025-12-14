// --- Puzzle Game Logic ---

const canvas = document.getElementById('puzzle');
const context = canvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const nextContext = nextCanvas.getContext('2d');
const holdCanvas = document.getElementById('hold');
const holdContext = holdCanvas.getContext('2d');

const scoreElement = document.getElementById('score');
const linesElement = document.getElementById('lines');

context.scale(22, 22);
nextContext.scale(25, 25);
holdContext.scale(25, 25);

// SRSカラー定義
const SRS_COLORS = {
    'T': '#800080', // 紫
    'I': '#00FFFF', // シアン
    'S': '#00FF00', // 緑
    'Z': '#FF0000', // 赤
    'L': '#FFA500', // オレンジ
    'J': '#0000FF', // 青
    'O': '#FFFF00'  // 黄
};

// ミノ形状定義
const PIECES = {
    'T': [
        [0, 1, 0],
        [1, 1, 1],
        [0, 0, 0],
    ],
    'I': [
        [0, 0, 0, 0],
        [1, 1, 1, 1],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
    ],
    'S': [
        [0, 1, 1],
        [1, 1, 0],
        [0, 0, 0],
    ],
    'Z': [
        [1, 1, 0],
        [0, 1, 1],
        [0, 0, 0],
    ],
    'L': [
        [0, 0, 1],
        [1, 1, 1],
        [0, 0, 0],
    ],
    'J': [
        [1, 0, 0],
        [1, 1, 1],
        [0, 0, 0],
    ],
    'O': [
        [1, 1],
        [1, 1],
    ]
};

// SRS スーパーローテーションシステム (Wall Kick) データ
const WALL_KICKS = {
    'JLSTZ': {
        '0-1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
        '1-0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
        '1-2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
        '2-1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
        '2-3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
        '3-2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
        '3-0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
        '0-3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]]
    },
    'I': {
        '0-1': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
        '1-0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
        '1-2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
        '2-1': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
        '2-3': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
        '3-2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
        '3-0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
        '0-3': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]]
    }
};

// ゲーム状態変数
let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;

// フィールドサイズ: 10x20
const ROWS = 20;
const COLS = 10;
const arena = createMatrix(COLS, ROWS);

let score = 0;
let lines = 0;

// プレイヤー状態
const player = {
    pos: { x: 0, y: 0 },
    matrix: null,
    type: null,
    rotationState: 0,
    score: 0,
    held: null,
    canHold: true,
};

let bag = [];
let nextQueue = [];

// --- 基本関数 ---

function createMatrix(w, h) {
    const matrix = [];
    while (h--) {
        matrix.push(new Array(w).fill(0));
    }
    return matrix;
}

function createPiece(type) {
    return PIECES[type].map(row => [...row]);
}

function generateBag() {
    const pieces = 'ILJOTSZ'.split('');
    for (let i = pieces.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
    }
    return pieces;
}

function nextPiece() {
    while (nextQueue.length <= 7) {
        const newBag = generateBag();
        nextQueue.push(...newBag);
    }
    return nextQueue.shift();
}

nextQueue = [];

function triggerGameOver() {
    arena.forEach(row => row.fill(0));
    score = 0;
    lines = 0;
    updateScore();
    nextQueue = [];
    player.held = null;
    playerReset();
}

function drawMatrix(matrix, offset, ctx = context, type = null, ghost = false) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                const color = SRS_COLORS[typeof value === 'string' ? value : type];
                const rectX = x + offset.x;
                const rectY = y + offset.y;

                ctx.fillStyle = color;
                if (ghost) {
                    ctx.fillStyle = color + '40';
                }
                ctx.fillRect(rectX, rectY, 1, 1);

                if (!ghost) {
                    const grd = ctx.createLinearGradient(rectX, rectY, rectX + 1, rectY + 1);
                    grd.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
                    grd.addColorStop(1, 'rgba(0, 0, 0, 0.1)');
                    ctx.fillStyle = grd;
                    ctx.fillRect(rectX, rectY, 1, 1);
                }

                if (!ghost) {
                    ctx.lineWidth = 0.05;
                    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
                    ctx.strokeRect(rectX, rectY, 1, 1);
                }
            }
        });
    });
}

function draw() {
    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.strokeStyle = '#222';
    context.lineWidth = 0.05;
    for (let x = 0; x <= 10; x++) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, 20);
        context.stroke();
    }
    for (let y = 0; y <= 20; y++) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(10, y);
        context.stroke();
    }

    drawMatrix(arena, { x: 0, y: 0 }, context);

    const ghostPos = { ...player.pos };
    while (!collide(arena, { ...player, pos: ghostPos })) {
        ghostPos.y++;
    }
    ghostPos.y--;
    drawMatrix(player.matrix, ghostPos, context, player.type, true);

    drawMatrix(player.matrix, player.pos, context, player.type);

    drawNext();
    drawHold();
}

function drawNext() {
    nextContext.fillStyle = '#333';
    nextContext.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

    let yOffset = 1;
    for (let i = 0; i < 5; i++) {
        const type = nextQueue[i];
        const matrix = createPiece(type);

        let localY = yOffset;
        if (type === 'I') localY -= 0.5;

        let localX = 0.7;
        if (type === 'O') localX = 1.4;

        drawMatrix(matrix, { x: localX, y: localY }, nextContext, type);
        yOffset += 3;
    }
}

function drawHold() {
    holdContext.fillStyle = '#333';
    holdContext.fillRect(0, 0, holdCanvas.width, holdCanvas.height);
    if (player.held) {
        const type = player.held;
        const matrix = createPiece(type);

        let localY = 1;
        if (type === 'I') localY -= 0.5;

        let localX = 0.7;
        if (type === 'O') localX = 1.4;

        drawMatrix(matrix, { x: localX, y: localY }, holdContext, type);
    }
}

function merge(arena, player) {
    player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                const targetY = y + player.pos.y;
                if (arena[targetY]) {
                    arena[targetY][x + player.pos.x] = player.type;
                }
            }
        });
    });
}

function rotate(dir) {
    const previousRotation = player.rotationState;
    const rotatedMatrix = (dir > 0)
        ? player.matrix.map((val, index) => player.matrix.map(row => row[index]).reverse())
        : player.matrix.map((val, index) => player.matrix.map(row => row[row.length - 1 - index]));

    let nextRotation = (player.rotationState + dir) % 4;
    if (nextRotation < 0) nextRotation += 4;

    const kickTableKey = (player.type === 'I') ? 'I' : 'JLSTZ';
    if (player.type === 'O') return;

    const kickKey = `${previousRotation}-${nextRotation}`;
    const kicks = WALL_KICKS[kickTableKey][kickKey];

    const backupMatrix = player.matrix;
    player.matrix = rotatedMatrix;
    player.rotationState = nextRotation;

    for (let i = 0; i < kicks.length; i++) {
        const [kx, ky] = kicks[i];
        const offset = { x: kx, y: -ky };
        player.pos.x += offset.x;
        player.pos.y += offset.y;

        if (!collide(arena, player)) {
            lockDelay = 0;
            return;
        }
        player.pos.x -= offset.x;
        player.pos.y -= offset.y;
    }
    player.matrix = backupMatrix;
    player.rotationState = previousRotation;
}

function collide(arena, player) {
    const [m, o] = [player.matrix, player.pos];
    for (let y = 0; y < m.length; ++y) {
        for (let x = 0; x < m[y].length; ++x) {
            if (m[y][x] !== 0) {
                const ay = y + o.y;
                const ax = x + o.x;
                if (ax < 0 || ax >= arena[0].length) return true;
                if (ay >= arena.length) return true;
                if (ay >= 0 && arena[ay][ax] !== 0) return true;
            }
        }
    }
    return false;
}

function playerReset() {
    const type = nextPiece();
    player.matrix = createPiece(type);
    player.type = type;
    player.pos.y = -1;
    player.pos.x = 3;
    player.rotationState = 0;
    player.canHold = true;

    if (collide(arena, player)) {
        triggerGameOver();
    } else {
        player.pos.y++;
        if (collide(arena, player)) {
            player.pos.y--;
            triggerGameOver();
        } else {
            player.pos.y--;
        }
    }
}

function lockPiece() {
    let lockout = false;
    player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0 && (y + player.pos.y) < 0) {
                lockout = true;
            }
        });
    });

    if (lockout) {
        triggerGameOver();
        return;
    }

    merge(arena, player);
    playerReset();
    arenaSweep();
    dropCounter = 0;
    lockDelay = 0;
}

function playerDrop() {
    player.pos.y++;
    if (collide(arena, player)) {
        player.pos.y--;
        return;
    }
    dropCounter = 0;
}

function playerHardDrop() {
    while (!collide(arena, player)) {
        player.pos.y++;
    }
    player.pos.y--;
    lockPiece();
}

function playerMove(dir) {
    player.pos.x += dir;
    if (collide(arena, player)) {
        player.pos.x -= dir;
    }
}

function playerHold() {
    if (!player.canHold) return;
    const currentType = player.type;
    if (!player.held) {
        player.held = currentType;
        playerReset();
    } else {
        const heldType = player.held;
        player.held = currentType;
        player.type = heldType;
        player.matrix = createPiece(heldType);
        player.pos.y = 0;
        player.pos.x = (arena[0].length / 2 | 0) - (player.matrix[0].length / 2 | 0);
        player.rotationState = 0;
    }
    player.canHold = false;
}

function arenaSweep() {
    let rowCount = 0;
    outer: for (let y = arena.length - 1; y > 0; --y) {
        for (let x = 0; x < arena[y].length; ++x) {
            if (arena[y][x] === 0) {
                continue outer;
            }
        }
        const row = arena.splice(y, 1)[0].fill(0);
        arena.unshift(row);
        ++y;
        rowCount++;
    }

    if (rowCount > 0) {
        const lineScores = [0, 100, 300, 500, 800];
        score += lineScores[rowCount];
        lines += rowCount;
        updateScore();
    }
}

function updateScore() {
    scoreElement.innerText = score;
    linesElement.innerText = lines;
}

const keys = { 37: false, 39: false, 40: false };
let currentDir = 0;
let dasTimer = 0;
let arrTimer = 0;
const DAS = 200;
const ARR = 33;
let isPaused = true; // Default paused until modal opens
let lockDelay = 0;
const LOCK_DELAY_LIMIT = 1000;

function resetGame() {
    triggerGameOver();
    isPaused = false;
    document.getElementById('pause-btn').innerText = 'Pause';
}

function togglePause() {
    isPaused = !isPaused;
    const btn = document.getElementById('pause-btn');
    if (btn) btn.innerText = isPaused ? 'Resume' : 'Pause';
}

function update(time = 0) {
    // モーダルが閉じている場合もポーズ扱い
    if (typeof isModalOpen !== 'undefined' && !isModalOpen) {
        // ループは回すが処理はスキップ
    }

    if (isPaused) {
        context.fillStyle = 'rgba(0,0,0,0.5)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = '#fff';
        context.font = '20px Arial';
        context.textAlign = 'center';
        context.fillText('PAUSED', canvas.width / 2, canvas.height / 2);
        requestAnimationFrame(update);
        return;
    }

    const deltaTime = time - lastTime;
    lastTime = time;

    dropCounter += deltaTime;
    if (dropCounter > dropInterval) {
        playerDrop();
    }

    if (keys[40]) {
        playerDrop();
    }

    if (currentDir !== 0) {
        dasTimer += deltaTime;
        if (dasTimer >= DAS) {
            arrTimer += deltaTime;
            if (arrTimer >= ARR) {
                const count = Math.floor(arrTimer / ARR);
                arrTimer %= ARR;
                for (let i = 0; i < count; i++) playerMove(currentDir);
            }
        } else {
            arrTimer = 0;
        }
    }

    player.pos.y++;
    const isGrounded = collide(arena, player);
    player.pos.y--;

    if (isGrounded) {
        lockDelay += deltaTime;
        if (lockDelay >= LOCK_DELAY_LIMIT) {
            lockPiece();
        }
    } else {
        lockDelay = 0;
    }

    draw();
    requestAnimationFrame(update);
}

document.addEventListener('keydown', event => {
    // モーダル変数がある場合のみチェック、なければ常時有効（index.html用だが今回はmodal_puzzle用として作成）
    if (typeof isModalOpen !== 'undefined' && !isModalOpen) return;

    if (event.repeat) return;

    if ([32, 37, 38, 39, 40].indexOf(event.keyCode) > -1) {
        event.preventDefault();
    }

    if (event.keyCode === 80 || event.keyCode === 27) {
        togglePause();
        return;
    }
    if (event.keyCode === 82) {
        resetGame();
        return;
    }

    if (isPaused) return;

    if (event.keyCode === 37) {
        if (!keys[37]) {
            keys[37] = true;
            currentDir = -1;
            dasTimer = 0;
            playerMove(-1);
        }
    } else if (event.keyCode === 39) {
        if (!keys[39]) {
            keys[39] = true;
            currentDir = 1;
            dasTimer = 0;
            playerMove(1);
        }
    } else if (event.keyCode === 40) {
        keys[40] = true;
        playerDrop();
    } else if (event.keyCode === 88) {
        rotate(-1);
    } else if (event.keyCode === 67) {
        rotate(1);
    } else if (event.keyCode === 90) {
        playerHold();
    } else if (event.keyCode === 32) {
        playerHardDrop();
    }
});

document.addEventListener('keyup', event => {
    if (typeof isModalOpen !== 'undefined' && !isModalOpen) return;

    if (event.keyCode === 37) {
        keys[37] = false;
        if (keys[39]) {
            currentDir = 1;
            dasTimer = 0;
            playerMove(1);
        } else {
            currentDir = 0;
        }
    } else if (event.keyCode === 39) {
        keys[39] = false;
        if (keys[37]) {
            currentDir = -1;
            dasTimer = 0;
            playerMove(-1);
        } else {
            currentDir = 0;
        }
    } else if (event.keyCode === 40) {
        keys[40] = false;
    }
});

// Initialize (Paused)
playerReset();
updateScore();
update();
// isPaused is initialized to true above for modal usage
