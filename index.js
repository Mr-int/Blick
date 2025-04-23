document.addEventListener('DOMContentLoaded', function () {
    let ysdk;
    let player;
    let isGameStarted = false;
    let currentScore = 0;
    let highScore = 0;

    if (typeof YaGames !== 'undefined') {
        YaGames.init().then(_ysdk => {
            ysdk = _ysdk;
            console.log('Yandex SDK инициализирован');
            return ysdk.getPlayer();
        }).then(_player => {
            player = _player;
            console.log('Игрок инициализирован:', player.getName());
            return ysdk.getPlayer().then(player => {
                return player.getStats();
            });
        }).then(stats => {
            if (stats && stats.highScore) {
                highScore = stats.highScore;
                updateHighScore();
            }
            initStartScreen();
            if (ysdk) {
                ysdk.dispatchEvent('gameReady');
            }
        }).catch(err => {
            console.error('Ошибка инициализации Yandex SDK или игрока:', err);
            initStartScreen();
        });
    } else {
        console.warn('Yandex SDK не доступен, запускаем игру без него');
        initStartScreen();
    }

    function initStartScreen() {
        const startScreen = document.getElementById('start-screen');
        const startButton = document.getElementById('start-button');
        const lightningContainer = document.getElementById('start-lightning-container');

        if (!startScreen || !startButton || !lightningContainer) {
            console.error('Не найдены элементы начального экрана');
            return;
        }

        startScreen.style.display = 'flex';

        function spawnStartLightning() {
            if (startScreen.style.display === 'flex') {
                if (Math.random() < 0.2) {
                    const lightning = document.createElement('div');
                    lightning.classList.add('start-lightning');
                    lightningContainer.appendChild(lightning);
                    setTimeout(() => {
                        if (lightning.parentNode) lightning.remove();
                    }, 300);
                }
                setTimeout(spawnStartLightning, 500);
            }
        }

        spawnStartLightning();

        startButton.addEventListener('click', () => {
            startScreen.style.display = 'none';
            startGame();
        });
    }

    function startGame() {
        const gameContainer = document.getElementById('game-container');
        const playerElement = document.getElementById('player');
        const obstaclesContainer = document.getElementById('obstacles');
        const decorationsContainer = document.getElementById('decorations');
        const scoreDisplay = document.getElementById('score');
        const startScreen = document.getElementById('start-screen');

        if (!gameContainer || !playerElement || !obstaclesContainer || !decorationsContainer || !scoreDisplay) {
            console.error('Не найдены необходимые элементы в DOM');
            return;
        }

        let playerPosY = 20;
        let playerPosX = 480;
        let playerVelocityX = 0;
        let playerVelocityY = 0;
        let isJumping = false;
        let score = 0;
        let gameActive = true;
        let isPaused = false;
        let obstacleInterval;
        let horizontalInterval;
        let lightningInterval;
        let animationFrameId;
        let difficulty = 1500;
        let isLeftTurn = true;
        let timeElapsed = 0;
        let obstacleCount = 1;
        let menuElement = null;

        const keys = { left: false, right: false, jump: false };
        
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' || e.code === 'ArrowUp') {
                keys.jump = true;
                if (gameActive && !isPaused && playerPosY === 20) jump();
            }
            if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
            if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
            if (e.code === 'Escape' && gameActive) toggleMenu();
        });

        document.addEventListener('keyup', (e) => {
            if (e.code === 'Space' || e.code === 'ArrowUp') keys.jump = false;
            if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
            if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
        });

        function updatePlayer() {
            if (!gameActive || isPaused) return;

            if (keys.left && playerPosX > 0) playerVelocityX -= 0.8;
            if (keys.right && playerPosX < gameContainer.offsetWidth - 40) playerVelocityX += 0.8;
            playerVelocityX *= 0.85;
            playerPosX += playerVelocityX;
            playerPosX = Math.max(0, Math.min(playerPosX, gameContainer.offsetWidth - 40));

            if (isJumping) {
                playerPosY += playerVelocityY;
                playerVelocityY -= 0.5;
                if (playerPosY <= 20) {
                    playerPosY = 20;
                    isJumping = false;
                    playerVelocityY = 0;
                    if (keys.jump) jump();
                }
            }
            playerElement.style.left = `${playerPosX}px`;
            playerElement.style.bottom = `${playerPosY}px`;

            timeElapsed += 16;
            updateDifficulty();

            animationFrameId = requestAnimationFrame(updatePlayer);
        }

        function jump() {
            isJumping = true;
            playerVelocityY = 10;
        }

        function spawnObstacle() {
            if (!gameActive || isPaused) return;

            for (let i = 0; i < obstacleCount; i++) {
                const obstacle = document.createElement('div');
                obstacle.classList.add('obstacle');
                const randomX = Math.floor(Math.random() * (gameContainer.offsetWidth - 30));
                obstacle.style.left = `${randomX}px`;
                obstacle.style.animationDuration = `${Math.random() * 1 + 0.8}s`;
                obstaclesContainer.appendChild(obstacle);

                obstacle.addEventListener('animationend', () => {
                    if (obstacle.parentNode) obstacle.remove();
                    score += 10;
                    scoreDisplay.textContent = `Счет: ${score}`;
                });

                checkCollision(obstacle);
            }
        }

        function spawnHorizontal() {
            if (!gameActive || isPaused) return;

            const horizontal = document.createElement('div');
            if (isLeftTurn) {
                horizontal.classList.add('horizontal-obstacle-left');
            } else {
                horizontal.classList.add('horizontal-obstacle-right');
            }
            obstaclesContainer.appendChild(horizontal);

            horizontal.addEventListener('animationend', () => {
                if (horizontal.parentNode) horizontal.remove();
                score += 20;
                scoreDisplay.textContent = `Счет: ${score}`;
                isLeftTurn = !isLeftTurn;
            });

            checkCollision(horizontal);
        }

        function spawnLightning() {
            if (!gameActive || isPaused) return;
            if (Math.random() < 0.1) {
                const lightning = document.createElement('div');
                lightning.classList.add('lightning');
                decorationsContainer.appendChild(lightning);
                setTimeout(() => {
                    if (lightning.parentNode) lightning.remove();
                }, 200);
            }
        }

        function updateDifficulty() {
            const timeFactor = Math.floor(timeElapsed / 10000);
            const newDifficulty = Math.max(600, 1500 - timeFactor * 100 - Math.floor(score / 50) * 100);
            obstacleCount = Math.min(3, 1 + Math.floor(timeElapsed / 20000));
            if (newDifficulty !== difficulty) {
                difficulty = newDifficulty;
                clearInterval(obstacleInterval);
                obstacleInterval = setInterval(spawnObstacle, difficulty);
                clearInterval(horizontalInterval);
                horizontalInterval = setInterval(spawnHorizontal, difficulty * 3);
            }
        }

        function checkCollision(element) {
            const interval = setInterval(() => {
                if (!element.parentNode) {
                    clearInterval(interval);
                    return;
                }
                const playerRect = playerElement.getBoundingClientRect();
                const elementRect = element.getBoundingClientRect();

                if (
                    playerRect.x < elementRect.x + elementRect.width &&
                    playerRect.x + playerRect.width > elementRect.x &&
                    playerRect.y < elementRect.y + elementRect.height &&
                    playerRect.y + playerRect.height > elementRect.y
                ) {
                    gameOver();
                    clearInterval(interval);
                }
            }, 10);
        }

        function createMenu(title, showResume) {
            if (menuElement) removeMenu();

            menuElement = document.createElement('div');
            menuElement.style.position = 'absolute';
            menuElement.style.top = '0';
            menuElement.style.left = '0';
            menuElement.style.width = '100%';
            menuElement.style.height = '100%';
            menuElement.style.background = 'rgba(0, 0, 0, 0.9)';
            menuElement.style.display = 'flex';
            menuElement.style.flexDirection = 'column';
            menuElement.style.justifyContent = 'center';
            menuElement.style.alignItems = 'center';
            menuElement.style.zIndex = '100';

            const titleElement = document.createElement('div');
            titleElement.style.fontSize = showResume ? '48px' : '36px';
            titleElement.style.color = '#fff';
            titleElement.style.textShadow = '0 0 10px rgba(255, 255, 255, 0.5)';
            titleElement.style.marginBottom = '20px';
            titleElement.style.textAlign = 'center';
            if (showResume) {
                titleElement.textContent = title;
            } else {
                titleElement.style.display = 'flex';
                titleElement.style.flexDirection = 'column';
                titleElement.innerHTML = `Игра окончена<br>Ваш счет: ${score}`;
            }
            menuElement.appendChild(titleElement);

            if (showResume) {
                const resumeButton = document.createElement('button');
                resumeButton.textContent = 'Продолжить';
                resumeButton.style.padding = '10px 20px';
                resumeButton.style.fontSize = '18px';
                resumeButton.style.color = '#fff';
                resumeButton.style.background = 'transparent';
                resumeButton.style.border = '2px solid #fff';
                resumeButton.style.borderRadius = '5px';
                resumeButton.style.cursor = 'pointer';
                resumeButton.style.margin = '10px';
                resumeButton.style.position = 'relative';
                resumeButton.style.overflow = 'hidden';
                resumeButton.style.transition = 'all 0.3s ease';
                resumeButton.innerHTML += `<span style="position: absolute; bottom: 0; left: 0; width: 100%; height: 0; background: rgba(128, 128, 128, 0.5); transition: height 0.3s ease; z-index: -1;"></span>`;
                resumeButton.addEventListener('mouseover', () => resumeButton.querySelector('span').style.height = '100%');
                resumeButton.addEventListener('mouseout', () => resumeButton.querySelector('span').style.height = '0');
                resumeButton.addEventListener('click', toggleMenu);
                menuElement.appendChild(resumeButton);
            }

            const restartButton = document.createElement('button');
            restartButton.textContent = 'Начать заново';
            restartButton.style.padding = '10px 20px';
            restartButton.style.fontSize = '18px';
            restartButton.style.color = '#fff';
            restartButton.style.background = 'transparent';
            restartButton.style.border = '2px solid #fff';
            restartButton.style.borderRadius = '5px';
            restartButton.style.cursor = 'pointer';
            restartButton.style.margin = '10px';
            restartButton.style.position = 'relative';
            restartButton.style.overflow = 'hidden';
            restartButton.style.transition = 'all 0.3s ease';
            restartButton.innerHTML += `<span style="position: absolute; bottom: 0; left: 0; width: 100%; height: 0; background: rgba(128, 128, 128, 0.5); transition: height 0.3s ease; z-index: -1;"></span>`;
            restartButton.addEventListener('mouseover', () => restartButton.querySelector('span').style.height = '100%');
            restartButton.addEventListener('mouseout', () => restartButton.querySelector('span').style.height = '0');
            restartButton.addEventListener('click', resetGame);
            menuElement.appendChild(restartButton);

            const homeButton = document.createElement('button');
            homeButton.textContent = 'Вернуться домой';
            homeButton.style.padding = '10px 20px';
            homeButton.style.fontSize = '18px';
            homeButton.style.color = '#fff';
            homeButton.style.background = 'transparent';
            homeButton.style.border = '2px solid #fff';
            homeButton.style.borderRadius = '5px';
            homeButton.style.cursor = 'pointer';
            homeButton.style.margin = '10px';
            homeButton.style.position = 'relative';
            homeButton.style.overflow = 'hidden';
            homeButton.style.transition = 'all 0.3s ease';
            homeButton.innerHTML += `<span style="position: absolute; bottom: 0; left: 0; width: 100%; height: 0; background: rgba(128, 128, 128, 0.5); transition: height 0.3s ease; z-index: -1;"></span>`;
            homeButton.addEventListener('mouseover', () => homeButton.querySelector('span').style.height = '100%');
            homeButton.addEventListener('mouseout', () => homeButton.querySelector('span').style.height = '0');
            homeButton.addEventListener('click', () => {
                gameActive = false;
                clearInterval(obstacleInterval);
                clearInterval(horizontalInterval);
                clearInterval(lightningInterval);
                cancelAnimationFrame(animationFrameId);
                obstaclesContainer.innerHTML = '';
                decorationsContainer.innerHTML = '';
                removeMenu();
                startScreen.style.display = 'flex';
            });
            menuElement.appendChild(homeButton);

            gameContainer.appendChild(menuElement);
        }

        function removeMenu() {
            if (menuElement && menuElement.parentNode) {
                menuElement.parentNode.removeChild(menuElement);
                menuElement = null;
            }
        }

        function updateScore(score) {
            currentScore = score;
            document.getElementById('score').textContent = `Счет: ${score}`;
            
            if (ysdk && player && score > highScore) {
                highScore = score;
                player.setStats({ highScore: score });
            }
        }

        function gameOver() {
            gameActive = false;
            isPaused = true;
            clearInterval(obstacleInterval);
            clearInterval(horizontalInterval);
            clearInterval(lightningInterval);
            cancelAnimationFrame(animationFrameId);
            const allAnimatedElements = document.querySelectorAll('.raindrop, .obstacle, .horizontal-obstacle-left, .horizontal-obstacle-right, .lightning');
            allAnimatedElements.forEach(element => {
                element.style.animationPlayState = 'paused';
            });
            createMenu(`Игра окончена\nВаш счет: ${score}`, false);
            if (ysdk && player) {
                player.setStats({ highScore: highScore });
            }
        }

        function toggleMenu() {
            isPaused = !isPaused;
            if (isPaused) {
                clearInterval(obstacleInterval);
                clearInterval(horizontalInterval);
                clearInterval(lightningInterval);
                cancelAnimationFrame(animationFrameId);
                const allAnimatedElements = document.querySelectorAll('.raindrop, .obstacle, .horizontal-obstacle-left, .horizontal-obstacle-right, .lightning');
                allAnimatedElements.forEach(element => {
                    element.style.animationPlayState = 'paused';
                });
                createMenu('Пауза', true);
            } else {
                removeMenu();
                const allAnimatedElements = document.querySelectorAll('.raindrop, .obstacle, .horizontal-obstacle-left, .horizontal-obstacle-right, .lightning');
                allAnimatedElements.forEach(element => {
                    element.style.animationPlayState = 'running';
                });
                obstacleInterval = setInterval(spawnObstacle, difficulty);
                horizontalInterval = setInterval(spawnHorizontal, difficulty * 3);
                lightningInterval = setInterval(spawnLightning, 2000);
                if (gameActive) animationFrameId = requestAnimationFrame(updatePlayer);
            }
        }

        function resetGame() {
            gameActive = true;
            isPaused = false;
            score = 0;
            playerPosX = 480;
            playerPosY = 20;
            playerVelocityX = 0;
            playerVelocityY = 0;
            difficulty = 1500;
            timeElapsed = 0;
            obstacleCount = 1;
            isLeftTurn = true;
            playerElement.style.left = `${playerPosX}px`;
            playerElement.style.bottom = `${playerPosY}px`;
            scoreDisplay.textContent = `Счет: ${score}`;
            obstaclesContainer.innerHTML = '';
            decorationsContainer.innerHTML = '';
            removeMenu();
            addRain();
            spawnObstacle();
            const allAnimatedElements = document.querySelectorAll('.raindrop, .obstacle, .horizontal-obstacle-left, .horizontal-obstacle-right, .lightning');
            allAnimatedElements.forEach(element => {
                element.style.animationPlayState = 'running';
            });
            obstacleInterval = setInterval(spawnObstacle, difficulty);
            horizontalInterval = setInterval(spawnHorizontal, difficulty * 3);
            lightningInterval = setInterval(spawnLightning, 2000);
            animationFrameId = requestAnimationFrame(updatePlayer);
            if (ysdk && player) {
                player.setStats({ highScore: highScore });
            }
        }

        function addRain() {
            for (let i = 0; i < 50; i++) {
                const raindrop = document.createElement('div');
                raindrop.classList.add('raindrop');
                raindrop.style.left = `${Math.random() * 1000}px`;
                raindrop.style.animationDuration = `${Math.random() * 1 + 0.5}s`;
                raindrop.style.animationDelay = `${Math.random() * 2}s`;
                decorationsContainer.appendChild(raindrop);
            }
        }

        function updateHighScore() {
            const highScoreElement = document.getElementById('high-score');
            if (highScoreElement) {
                highScoreElement.textContent = `Рекорд: ${highScore}`;
            }
        }

        addRain();
        spawnObstacle();
        obstacleInterval = setInterval(spawnObstacle, difficulty);
        horizontalInterval = setInterval(spawnHorizontal, difficulty * 3);
        lightningInterval = setInterval(spawnLightning, 2000);
        animationFrameId = requestAnimationFrame(updatePlayer);
    }
});