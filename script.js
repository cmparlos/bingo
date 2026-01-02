document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const bingoGrid = document.getElementById('bingo-grid');
    const lastNumDisplay = document.getElementById('last-number');
    const nextBtn = document.getElementById('next-btn');
    const newGameBtn = document.getElementById('new-game-btn');
    const addPlayerBtn = document.getElementById('add-player-btn');
    const playerNameInput = document.getElementById('player-name');
    const playersList = document.getElementById('players-list');
    const winnerOverlay = document.getElementById('winner-overlay');
    const winnerTitle = document.getElementById('winner-title');
    const winnerText = document.getElementById('winner-text');
    const closeOverlay = document.getElementById('close-overlay');

    const statsTableBody = document.querySelector('#stats-table tbody');
    const themeCheckbox = document.getElementById('checkbox');
    const historyList = document.getElementById('draw-history-list');

    // Share Elements
    const shareBtn = document.getElementById('share-btn');
    const shareModal = document.getElementById('share-modal');
    const closeShare = document.getElementById('close-share');
    const qrCodeImg = document.getElementById('qr-code');
    const shareLinkInput = document.getElementById('share-link');
    const copyLinkBtn = document.getElementById('copy-link-btn');

    // Voice & Auto Controls
    const voiceToggle = document.getElementById('voice-toggle');
    const autoBtn = document.getElementById('auto-btn');
    const autoIntervalInput = document.getElementById('auto-interval');

    // Frequency Tracking
    const frequencyGrid = document.getElementById('frequency-grid');
    const fullResetBtn = document.getElementById('full-reset-btn');

    // Theme Toggle Logic avec Switch
    themeCheckbox.addEventListener('change', (e) => {
        if (e.target.checked) {
            document.body.classList.add('light-mode');
            localStorage.setItem('bingo-theme', 'light');
        } else {
            document.body.classList.remove('light-mode');
            localStorage.setItem('bingo-theme', 'dark');
        }
    });

    // Load saved theme
    if (localStorage.getItem('bingo-theme') === 'light') {
        document.body.classList.add('light-mode');
        themeCheckbox.checked = true;
    }

    // Viewer Mode Detection
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('view') === '1') {
        document.body.classList.add('viewer-mode');
        // If viewer, change subtitle
        document.querySelector('.subtitle').textContent = 'Modo Visualizador (Tempo Real)';
    }

    // State
    let numbers = [];
    let drawnNumbers = [];
    let drawnHistory = [];
    let players = [];
    let gameCount = 1;

    let autoDrawTimer = null;
    let isAutoDrawing = false;

    let globalFrequency = JSON.parse(localStorage.getItem('bingo-frequency')) || {};

    // Initialize Grid 1-90
    function initGrid() {
        bingoGrid.innerHTML = '';
        for (let i = 1; i <= 90; i++) {
            const div = document.createElement('div');
            div.className = 'grid-num';
            div.id = `num-${i}`;
            div.textContent = i;
            bingoGrid.appendChild(div);
        }
    }

    // Reset Game
    function resetGame(softReset = false) {
        numbers = Array.from({ length: 90 }, (_, i) => i + 1);
        // Shuffle
        for (let i = numbers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
        }
        drawnNumbers = [];
        lastNumDisplay.textContent = '-';
        lastNumDisplay.style.animation = 'none';

        // Reset Grid visual
        document.querySelectorAll('.grid-num').forEach(el => {
            el.classList.remove('active', 'last');
        });

        players.forEach(p => {
            p.linha = false;
            p.bingo = false;
        });

        drawnHistory = [];
        updateHistoryUI();

        if (!softReset) {
            gameCount++;
        }

        stopAutoDraw();
        updatePlayersList();
        nextBtn.disabled = false;
    }

    // Draw Next Number
    function drawNext() {
        if (numbers.length === 0) {
            alert('Todos os números foram sorteados!');
            nextBtn.disabled = true;
            return;
        }

        const nextNum = numbers.pop();
        drawnNumbers.push(nextNum);

        // Update UI
        lastNumDisplay.textContent = nextNum;

        // Highlight in Grid
        document.querySelectorAll('.grid-num').forEach(el => el.classList.remove('last'));
        const gridEl = document.getElementById(`num-${nextNum}`);
        gridEl.classList.add('active', 'last');

        // Animation
        lastNumDisplay.style.animation = 'none';
        void lastNumDisplay.offsetWidth; // trigger reflow
        lastNumDisplay.style.animation = 'zoomIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';

        // Add to History
        drawnHistory.push(nextNum);
        updateHistoryUI();

        // Voice
        if (voiceToggle.checked) {
            speakNumber(nextNum);
        }

        // Global Stats
        globalFrequency[nextNum] = (globalFrequency[nextNum] || 0) + 1;
        saveFrequency();
        updateFrequencyUI();
    }

    function speakNumber(num) {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(num.toString());
            utterance.lang = 'pt-PT';
            utterance.rate = 0.9;
            window.speechSynthesis.speak(utterance);
        }
    }

    function updateHistoryUI() {
        if (drawnHistory.length === 0) {
            historyList.innerHTML = '<p class="empty-msg">Nenhum número sorteado ainda.</p>';
            return;
        }

        historyList.innerHTML = '';
        drawnHistory.forEach((num, index) => {
            const span = document.createElement('span');
            span.className = 'history-num-badge';
            span.innerHTML = `<small>${index + 1}º</small> <strong>${num}</strong>`;
            historyList.appendChild(span);
        });
    }

    function updateFrequencyUI() {
        if (!frequencyGrid) return;
        frequencyGrid.innerHTML = '';
        for (let i = 1; i <= 90; i++) {
            const count = globalFrequency[i] || 0;
            const div = document.createElement('div');
            div.className = 'freq-item';
            div.innerHTML = `
                <span class="freq-num">${i}</span>
                <span class="freq-count">${count}x</span>
            `;
            frequencyGrid.appendChild(div);
        }
    }

    function saveFrequency() {
        localStorage.setItem('bingo-frequency', JSON.stringify(globalFrequency));
    }

    // Player Management
    function addPlayer() {
        const name = playerNameInput.value.trim();
        if (!name) return;

        const player = {
            id: Date.now(),
            name: name,
            linha: false,
            bingo: false,
            countLinhas: 0,
            countBingos: 0
        };

        players.push(player);
        playerNameInput.value = '';
        updatePlayersList();
        updateStatsTable();
    }

    function toggleStatus(playerId, type) {
        const player = players.find(p => p.id === playerId);
        if (!player) return;

        if (type === 'linha') {
            player.linha = !player.linha;
            if (player.linha) {
                player.countLinhas++;
                showWinner('LINHA!', player.name);
                updateStatsTable();
            }
        } else if (type === 'bingo') {
            player.bingo = !player.bingo;
            if (player.bingo) {
                player.countBingos++;
                showWinner('BINGO!', player.name);
                updateStatsTable();

                // Auto-reset game after a short delay (enough to see the winner)
                setTimeout(() => {
                    resetGame();
                }, 2000);
            }
        }

        updatePlayersList();
    }

    function updateStatsTable() {
        statsTableBody.innerHTML = '';

        // Sort players: countBingos DESC, countLinhas DESC
        const sortedPlayers = [...players].sort((a, b) => {
            if (b.countBingos !== a.countBingos) {
                return b.countBingos - a.countBingos;
            }
            return b.countLinhas - a.countLinhas;
        });

        sortedPlayers.forEach((player, index) => {
            const row = document.createElement('tr');

            // Apply medal classes
            if (index === 0 && (player.countBingos > 0 || player.countLinhas > 0)) row.classList.add('rank-gold');
            else if (index === 1 && (player.countBingos > 0 || player.countLinhas > 0)) row.classList.add('rank-silver');
            else if (index === 2 && (player.countBingos > 0 || player.countLinhas > 0)) row.classList.add('rank-bronze');

            row.innerHTML = `
                <td>${player.name}</td>
                <td><span class="badge-linha">${player.countLinhas}</span></td>
                <td><span class="badge-bingo">${player.countBingos}</span></td>
            `;
            statsTableBody.appendChild(row);
        });
    }

    function updatePlayersList() {
        playersList.innerHTML = '';
        players.forEach(player => {
            const div = document.createElement('div');
            div.className = `player-item ${player.linha ? 'has-linha' : ''} ${player.bingo ? 'has-bingo' : ''}`;

            div.innerHTML = `
                <div class="player-info">
                    <div class="player-name">${player.name}</div>
                    <div class="player-status">
                        ${player.linha ? '✓ Linha' : ''} ${player.bingo ? '✓ Bingo' : ''}
                    </div>
                </div>
                <div class="player-actions admin-only">
                    <button class="btn-status linha ${player.linha ? 'active' : ''}" onclick="window.game.toggle(${player.id}, 'linha')">
                        LINHA
                    </button>
                    <button class="btn-status bingo ${player.bingo ? 'active' : ''}" onclick="window.game.toggle(${player.id}, 'bingo')">
                        BINGO
                    </button>
                </div>
            `;
            playersList.appendChild(div);
        });
    }

    function showWinner(title, name) {
        winnerTitle.textContent = title;
        winnerText.textContent = `${name} completou ${title === 'BINGO!' ? 'o Bingo' : 'uma Linha'}!`;
        winnerOverlay.classList.remove('hidden');
        createConfetti();
    }

    function createConfetti() {
        for (let i = 0; i < 100; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + 'vw';
            confetti.style.backgroundColor = ['#00d2ff', '#bc4e9c', '#f80759', '#ffd700', '#ffffff'][Math.floor(Math.random() * 5)];
            confetti.style.animationDelay = Math.random() * 3 + 's';
            confetti.style.width = (Math.random() * 10 + 5) + 'px';
            confetti.style.height = confetti.style.width;
            document.body.appendChild(confetti);
            setTimeout(() => confetti.remove(), 4000);
        }
    }

    // Event Listeners
    nextBtn.addEventListener('click', drawNext);
    newGameBtn.addEventListener('click', () => {
        if (confirm('Deseja iniciar um novo jogo? Todos os números serão limpos.')) {
            resetGame();
        }
    });
    addPlayerBtn.addEventListener('click', addPlayer);
    playerNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addPlayer();
    });
    closeOverlay.addEventListener('click', () => {
        winnerOverlay.classList.add('hidden');
    });

    // Share Logic
    shareBtn.addEventListener('click', () => {
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set('view', '1');
        const shareLink = currentUrl.toString();

        shareLinkInput.value = shareLink;
        qrCodeImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shareLink)}`;
        shareModal.classList.remove('hidden');
    });

    closeShare.addEventListener('click', () => {
        shareModal.classList.add('hidden');
    });

    copyLinkBtn.addEventListener('click', () => {
        shareLinkInput.select();
        document.execCommand('copy');
        copyLinkBtn.textContent = 'Copiado!';
        setTimeout(() => {
            copyLinkBtn.textContent = 'Copiar';
        }, 2000);
    });

    // Auto Draw Logic
    function toggleAutoDraw() {
        if (isAutoDrawing) {
            stopAutoDraw();
        } else {
            startAutoDraw();
        }
    }

    function startAutoDraw() {
        if (numbers.length === 0) return;

        isAutoDrawing = true;
        autoBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
        autoBtn.classList.add('active');

        const interval = parseInt(autoIntervalInput.value) * 1000 || 5000;

        autoDrawTimer = setInterval(() => {
            if (numbers.length === 0) {
                stopAutoDraw();
                return;
            }
            drawNext();
        }, interval);
    }

    function stopAutoDraw() {
        isAutoDrawing = false;
        if (autoDrawTimer) {
            clearInterval(autoDrawTimer);
            autoDrawTimer = null;
        }
        autoBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        autoBtn.classList.remove('active');
    }

    autoBtn.addEventListener('click', toggleAutoDraw);

    fullResetBtn.addEventListener('click', () => {
        if (confirm('Deseja reiniciar todas as estatísticas globais? Esta ação não pode ser desfeita.')) {
            globalFrequency = {};
            saveFrequency();
            updateFrequencyUI();
        }
    });

    window.game = {
        toggle: toggleStatus
    };

    // Init
    initGrid();
    updateFrequencyUI();
    numbers = Array.from({ length: 90 }, (_, i) => i + 1);
    resetGame(true); // Initial setup without incrementing game count
});
