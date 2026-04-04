// 坦克大战游戏核心代码
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 游戏常量
const TILE_SIZE = 40;
const GRID_WIDTH = 20;
const GRID_HEIGHT = 20;
const TANK_SIZE = 64;
const BULLET_SIZE = 10;
const BULLET_SPEED = 1.5;
const PLAYER_SPEED = 2.4;
const ENEMY_SPEED = 1.8;

// 方向常量
const DIRECTION = {
    UP: 0,
    RIGHT: 1,
    DOWN: 2,
    LEFT: 3
};

// 砖块类型
const TILE = {
    EMPTY: 0,
    BRICK: 1,
    STEEL: 2,
    WATER: 3,
    GRASS: 4,
    BASE: 5
};

// 颜色配置
const COLORS = {
    [TILE.BRICK]: '#cc6633',
    [TILE.STEEL]: '#999999',
    [TILE.WATER]: '#3366cc',
    [TILE.GRASS]: '#66cc33',
    [TILE.BASE]: '#ffcc00',
    PLAYER_TANK: '#4ecca3',
    ENEMY_TANK: '#e74c3c',
    BULLET: '#fff'
};

// 游戏状态
let game = null;
let isPaused = false;

// 输入状态
const keys = {};

// ==================== 砖块类 ====================
class Tile {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.width = TILE_SIZE;
        this.height = TILE_SIZE;
        this.destroyed = false;
    }
    
    draw(ctx) {
        if (this.destroyed) return;
        
        const px = this.x * TILE_SIZE;
        const py = this.y * TILE_SIZE;
        
        switch(this.type) {
            case TILE.BRICK:
                ctx.fillStyle = COLORS[TILE.BRICK];
                ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 1;
                ctx.strokeRect(px, py, TILE_SIZE/2, TILE_SIZE/2);
                ctx.strokeRect(px + TILE_SIZE/2, py, TILE_SIZE/2, TILE_SIZE/2);
                ctx.strokeRect(px, py + TILE_SIZE/2, TILE_SIZE/2, TILE_SIZE/2);
                ctx.strokeRect(px + TILE_SIZE/2, py + TILE_SIZE/2, TILE_SIZE/2, TILE_SIZE/2);
                break;
            case TILE.STEEL:
                ctx.fillStyle = COLORS[TILE.STEEL];
                ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
                ctx.strokeStyle = '#666';
                ctx.lineWidth = 2;
                ctx.strokeRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
                break;
            case TILE.WATER:
                ctx.fillStyle = COLORS[TILE.WATER];
                ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                ctx.fillStyle = '#4488dd';
                ctx.fillRect(px + 4, py + 8, TILE_SIZE - 8, 4);
                ctx.fillRect(px + 8, py + 16, TILE_SIZE - 12, 4);
                break;
            case TILE.GRASS:
                ctx.fillStyle = COLORS[TILE.GRASS];
                ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                ctx.fillStyle = '#55bb22';
                for(let i = 0; i < 4; i++) {
                    ctx.fillRect(px + 4 + i*5, py + 4, 3, 8);
                    ctx.fillRect(px + 6 + i*5, py + 12, 3, 8);
                }
                break;
            case TILE.BASE:
                ctx.fillStyle = '#444';
                ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
                ctx.fillStyle = COLORS[TILE.BASE];
                ctx.fillRect(px + 4, py + 4, TILE_SIZE - 8, TILE_SIZE - 8);
                ctx.fillStyle = '#fff';
                ctx.font = '12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('★', px + TILE_SIZE/2, py + TILE_SIZE/2 + 4);
                break;
        }
    }
    
    hit() {
        if (this.type === TILE.BRICK) {
            this.destroyed = true;
            return true;
        }
        return this.type === TILE.EMPTY || this.type === TILE.GRASS;
    }
}

// ==================== 子弹类 ====================
class Bullet {
    constructor(x, y, direction, isPlayer, owner, isBomb = false) {
        this.x = x;
        this.y = y;
        this.direction = direction;
        this.width = BULLET_SIZE;
        this.height = BULLET_SIZE;
        this.isPlayer = isPlayer;
        this.owner = owner;
        this.active = true;
        this.speed = BULLET_SPEED;
        this.isBomb = isBomb;
        this.bombRange = 5 * TILE_SIZE; // 炸弹射程5个砖块
        this.explosionRange = 5; // 爆炸范围5个砖块
        this.distanceTraveled = 0;
    }
    
    update() {
        const moveDistance = this.speed;
        this.distanceTraveled += moveDistance;
        
        switch(this.direction) {
            case DIRECTION.UP:
                this.y -= moveDistance;
                break;
            case DIRECTION.RIGHT:
                this.x += moveDistance;
                break;
            case DIRECTION.DOWN:
                this.y += moveDistance;
                break;
            case DIRECTION.LEFT:
                this.x -= moveDistance;
                break;
        }
        
        // 炸弹到达射程后爆炸
        if (this.isBomb && this.distanceTraveled >= this.bombRange) {
            this.active = false;
            // 创建范围爆炸
            this.createExplosion();
            return;
        }
        
        // 检查是否超出边界
        if (this.x < 0 || this.x > canvas.width || 
            this.y < 0 || this.y > canvas.height) {
            this.active = false;
        }
    }
    
    draw(ctx) {
        ctx.save();
        
        if (this.isBomb) {
            // 绘制炸弹阴影
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.beginPath();
            ctx.arc(this.x + 3, this.y + 3, 8, 0, Math.PI * 2);
            ctx.fill();
            
            // 绘制炸弹主体
            const gradient = ctx.createRadialGradient(this.x - 2, this.y - 2, 0, this.x, this.y, 8);
            gradient.addColorStop(0, '#ffcc00');
            gradient.addColorStop(0.7, '#ff9900');
            gradient.addColorStop(1, '#ff6600');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(this.x, this.y, 8, 0, Math.PI * 2);
            ctx.fill();
            
            // 炸弹高光
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.beginPath();
            ctx.arc(this.x - 3, this.y - 3, 3, 0, Math.PI * 2);
            ctx.fill();
            
            // 炸弹外圈
            ctx.strokeStyle = '#ff3300';
            ctx.lineWidth = 2;
            ctx.stroke();
        } else {
            // 绘制子弹阴影
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.beginPath();
            ctx.arc(this.x + 2, this.y + 2, this.width/2, 0, Math.PI * 2);
            ctx.fill();
            
            // 绘制圆形子弹
            const gradient = ctx.createRadialGradient(this.x - 1, this.y - 1, 0, this.x, this.y, this.width/2);
            if (this.isPlayer) {
                gradient.addColorStop(0, '#6699ff');
                gradient.addColorStop(0.7, '#0066ff');
                gradient.addColorStop(1, '#0044cc');
            } else {
                gradient.addColorStop(0, '#ff6666');
                gradient.addColorStop(0.7, '#ff0000');
                gradient.addColorStop(1, '#cc0000');
            }
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.width/2, 0, Math.PI * 2);
            ctx.fill();
            
            // 子弹高光
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.beginPath();
            ctx.arc(this.x - 1, this.y - 1, this.width/4, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }
    
    createExplosion() {
        // 炸弹爆炸，摧毁周围5个砖块范围内的所有东西
        const centerX = Math.floor(this.x / TILE_SIZE);
        const centerY = Math.floor(this.y / TILE_SIZE);
        const range = this.explosionRange;
        
        // 摧毁范围内的砖块和敌人
        for (let dy = -range; dy <= range; dy++) {
            for (let dx = -range; dx <= range; dx++) {
                const tx = centerX + dx;
                const ty = centerY + dy;
                
                // 检查是否在爆炸范围内（圆形范围）
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance <= range) {
                    // 在每个被辐射的砖块位置显示炸弹圆点
                    if (game) {
                        game.explosions.push(new Explosion(
                            tx * TILE_SIZE + TILE_SIZE/2,
                            ty * TILE_SIZE + TILE_SIZE/2,
                            'normal'
                        ));
                    }
                    
                    // 摧毁砖块
                    if (game && game.map[ty] && game.map[ty][tx]) {
                        const tile = game.map[ty][tx];
                        if (tile && !tile.destroyed && tile.type === TILE.BRICK) {
                            tile.destroyed = true;
                        }
                    }
                    
                    // 摧毁敌人
                    if (game) {
                        for (let enemy of game.enemies) {
                            if (enemy.active) {
                                const enemyTileX = Math.floor((enemy.x + enemy.width/2) / TILE_SIZE);
                                const enemyTileY = Math.floor((enemy.y + enemy.height/2) / TILE_SIZE);
                                if (enemyTileX === tx && enemyTileY === ty) {
                                    enemy.hit();
                                    game.score += 100 * enemy.level;
                                    game.enemiesKilled++;
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // 中心大爆炸
        if (game) {
            game.explosions.push(new Explosion(this.x, this.y, 'large'));
        }
    }
    
    getRect() {
        return {
            x: this.x - this.width/2,
            y: this.y - this.height/2,
            width: this.width,
            height: this.height
        };
    }
}

// ==================== 爆炸效果类 ====================
class Explosion {
    constructor(x, y, size = 'normal') {
        this.x = x;
        this.y = y;
        this.size = size;
        this.radius = size === 'large' ? 5 : 3;
        this.maxRadius = size === 'large' ? 40 : 25;
        this.active = true;
        this.frame = 0;
        this.maxFrames = 15;
    }
    
    update() {
        this.frame++;
        this.radius = this.maxRadius * (this.frame / this.maxFrames);
        if (this.frame >= this.maxFrames) {
            this.active = false;
        }
    }
    
    draw(ctx) {
        const alpha = 1 - (this.frame / this.maxFrames);
        
        // 绘制阴影
        ctx.save();
        ctx.globalAlpha = alpha * 0.3;
        ctx.beginPath();
        ctx.arc(this.x + 3, this.y + 3, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#000';
        ctx.fill();
        ctx.restore();
        
        // 外圈（渐变）
        const gradient1 = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
        gradient1.addColorStop(0, `rgba(255, 200, 100, ${alpha})`);
        gradient1.addColorStop(0.5, `rgba(255, 100, 0, ${alpha * 0.8})`);
        gradient1.addColorStop(1, `rgba(200, 50, 0, ${alpha * 0.6})`);
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient1;
        ctx.fill();
        
        // 内圈（渐变）
        const gradient2 = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius * 0.6);
        gradient2.addColorStop(0, `rgba(255, 255, 200, ${alpha})`);
        gradient2.addColorStop(0.5, `rgba(255, 200, 0, ${alpha * 0.9})`);
        gradient2.addColorStop(1, `rgba(255, 150, 0, ${alpha * 0.7})`);
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = gradient2;
        ctx.fill();
        
        // 核心（最亮）
        const gradient3 = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius * 0.3);
        gradient3.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
        gradient3.addColorStop(0.7, `rgba(255, 255, 200, ${alpha * 0.8})`);
        gradient3.addColorStop(1, `rgba(255, 200, 100, ${alpha * 0.6})`);
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = gradient3;
        ctx.fill();
    }
}

// ==================== 坦克基类 ====================
class Tank {
    constructor(x, y, direction, color) {
        this.x = x;
        this.y = y;
        this.direction = direction;
        this.color = color;
        this.width = TANK_SIZE;
        this.height = TANK_SIZE;
        this.speed = PLAYER_SPEED;
        this.active = true;
        this.cooldown = 0;
        this.maxCooldown = 15;
        this.moving = false;
    }
    
    getRect() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }
    
    canMove(newX, newY, map, tanks) {
        // 边界检查
        if (newX < 0 || newX + this.width > canvas.width ||
            newY < 0 || newY + this.height > canvas.height) {
            return false;
        }
        
        // 地图碰撞检查
        const leftTile = Math.floor(newX / TILE_SIZE);
        const rightTile = Math.floor((newX + this.width - 1) / TILE_SIZE);
        const topTile = Math.floor(newY / TILE_SIZE);
        const bottomTile = Math.floor((newY + this.height - 1) / TILE_SIZE);
        
        for (let ty = topTile; ty <= bottomTile; ty++) {
            for (let tx = leftTile; tx <= rightTile; tx++) {
                if (ty >= 0 && ty < GRID_HEIGHT && tx >= 0 && tx < GRID_WIDTH) {
                    const tile = map[ty][tx];
                    if (tile && !tile.destroyed && 
                        (tile.type === TILE.BRICK || tile.type === TILE.STEEL || 
                         tile.type === TILE.WATER || tile.type === TILE.BASE)) {
                        return false;
                    }
                }
            }
        }
        
        // 坦克间碰撞检查
        for (let tank of tanks) {
            if (tank !== this && tank.active) {
                if (this.checkCollision(
                    {x: newX, y: newY, width: this.width, height: this.height},
                    tank.getRect()
                )) {
                    return false;
                }
            }
        }
        
        return true;
    }
    
    checkCollision(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width &&
               rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height &&
               rect1.y + rect1.height > rect2.y;
    }
    
    shoot() {
        if (this.cooldown > 0) return null;
        
        this.cooldown = this.maxCooldown;
        
        let bx, by;
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;
        
        switch(this.direction) {
            case DIRECTION.UP:
                bx = centerX;
                by = this.y;
                break;
            case DIRECTION.RIGHT:
                bx = this.x + this.width;
                by = centerY;
                break;
            case DIRECTION.DOWN:
                bx = centerX;
                by = this.y + this.height;
                break;
            case DIRECTION.LEFT:
                bx = this.x;
                by = centerY;
                break;
        }
        
        return new Bullet(bx, by, this.direction, this instanceof PlayerTank, this);
    }
    
    shootBomb() {
        if (this.cooldown > 0 || this.bombs <= 0) return null;
        
        this.cooldown = this.maxCooldown * 2; // 炸弹冷却时间更长
        this.bombs--;  // 减少炸弹数量
        
        let bx, by;
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;
        
        switch(this.direction) {
            case DIRECTION.UP:
                bx = centerX;
                by = this.y;
                break;
            case DIRECTION.RIGHT:
                bx = this.x + this.width;
                by = centerY;
                break;
            case DIRECTION.DOWN:
                bx = centerX;
                by = this.y + this.height;
                break;
            case DIRECTION.LEFT:
                bx = this.x;
                by = centerY;
                break;
        }
        
        return new Bullet(bx, by, this.direction, this instanceof PlayerTank, this, true);
    }
    
    update() {
        if (this.cooldown > 0) this.cooldown--;
    }
    
    draw(ctx) {
        if (!this.active) return;
        
        ctx.save();
        ctx.translate(this.x + this.width/2, this.y + this.height/2);
        
        // 旋转到对应方向
        const rotation = this.direction * 90 * Math.PI / 180;
        ctx.rotate(rotation);

        const half = this.width / 2;
        const trackW = this.width * 0.22;
        const bodyW = this.width * 0.56;
        const bodyHalf = bodyW / 2;
        const turretR = this.width * 0.24;
        const barrelW = Math.max(4, this.width * 0.1);
        const barrelL = this.width * 0.42;
        const centerR = Math.max(2, this.width * 0.08);
        
        // 绘制阴影（假三维效果）
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(-half + 4, -half + 4, trackW, this.height);
        ctx.fillRect(half - trackW + 4, -half + 4, trackW, this.height);
        ctx.fillRect(-bodyHalf + 4, -bodyHalf + 4, bodyW, bodyW);
        
        // 绘制履带（深色）
        const trackColor = this.adjustBrightness('#333', -20);
        ctx.fillStyle = trackColor;
        ctx.fillRect(-half, -half, trackW, this.height);
        ctx.fillRect(half - trackW, -half, trackW, this.height);
        
        // 绘制履带高光
        ctx.fillStyle = this.adjustBrightness('#555', 30);
        const lineGap = Math.max(4, this.height / 7);
        const lineH = Math.max(2, this.height / 14);
        for (let i = -half; i < half; i += lineGap) {
            ctx.fillRect(-half, i, trackW, lineH);
            ctx.fillRect(half - trackW, i, trackW, lineH);
        }
        
        // 绘制车身主体
        const bodyColor = this.adjustBrightness(this.color, -30);
        ctx.fillStyle = bodyColor;
        ctx.fillRect(-bodyHalf, -bodyHalf, bodyW, bodyW);
        
        // 绘制车身高光
        ctx.fillStyle = this.adjustBrightness(this.color, 20);
        ctx.fillRect(-bodyHalf + 2, -bodyHalf + 2, bodyW - 4, bodyH/3);
        
        // 绘制炮塔阴影
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.arc(2, 2, turretR, 0, Math.PI * 2);
        ctx.fill();
        
        // 绘制炮塔
        const turretColor = this.adjustBrightness(this.color, -10);
        ctx.fillStyle = turretColor;
        ctx.beginPath();
        ctx.arc(0, 0, turretR, 0, Math.PI * 2);
        ctx.fill();
        
        // 绘制炮塔高光
        ctx.fillStyle = this.adjustBrightness(this.color, 40);
        ctx.beginPath();
        ctx.arc(-turretR/3, -turretR/3, turretR/3, 0, Math.PI * 2);
        ctx.fill();
        
        // 绘制炮管阴影
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(-barrelW/2 + 2, -half + 2, barrelW, barrelL);
        
        // 绘制炮管
        ctx.fillStyle = '#222';
        ctx.fillRect(-barrelW / 2, -half, barrelW, barrelL);
        
        // 绘制炮管高光
        ctx.fillStyle = '#555';
        ctx.fillRect(-barrelW / 2 + 1, -half + 1, barrelW/3, barrelL - 2);
        
        // 绘制中心点阴影
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.arc(1, 1, centerR, 0, Math.PI * 2);
        ctx.fill();
        
        // 绘制中心点
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, 0, centerR, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
    
    adjustBrightness(color, percent) {
        // 调整颜色亮度的辅助函数
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) + amt;
        const G = (num >> 8 & 0x00FF) + amt;
        const B = (num & 0x0000FF) + amt;
        return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
            (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
            (B < 255 ? B < 1 ? 0 : B : 255))
            .toString(16).slice(1);
    }
    
    hit() {
        this.active = false;
    }
}

// ==================== 玩家坦克类 ====================
class PlayerTank extends Tank {
    constructor(x, y) {
        super(x, y, DIRECTION.UP, COLORS.PLAYER_TANK);
        this.lives = 3;
        this.invulnerable = 0;
        this.bombs = 10;  // 炸弹数量
    }
    
    update(input, map, tanks) {
        super.update();
        
        if (this.invulnerable > 0) this.invulnerable--;
        
        this.moving = false;
        
        if (!this.active) return;
        
        let newX = this.x;
        let newY = this.y;
        let moved = false;
        
        // 检测上下移动（垂直方向）
        if (input['ArrowUp']) {
            this.direction = DIRECTION.UP;
            newY -= this.speed;
            moved = true;
        } else if (input['ArrowDown']) {
            this.direction = DIRECTION.DOWN;
            newY += this.speed;
            moved = true;
        }
        
        // 检测左右移动（水平方向）
        if (input['ArrowLeft']) {
            this.direction = DIRECTION.LEFT;
            newX -= this.speed;
            moved = true;
        } else if (input['ArrowRight']) {
            this.direction = DIRECTION.RIGHT;
            newX += this.speed;
            moved = true;
        }
        
        this.moving = moved;
        
        if (moved) {
            if (this.canMove(newX, this.y, map, tanks)) {
                this.x = newX;
            }
            if (this.canMove(this.x, newY, map, tanks)) {
                this.y = newY;
            }
        }
    }
    
    respawn() {
        // 修正出生位置到左下角空地 (4,17)
        this.x = 4 * TILE_SIZE;
        this.y = 17 * TILE_SIZE;
        this.direction = DIRECTION.UP;
        this.active = true;
        this.invulnerable = 120;
    }
    
    draw(ctx) {
        if (this.invulnerable > 0 && Math.floor(Date.now() / 100) % 2 === 0) {
            return; // 闪烁效果
        }
        super.draw(ctx);
    }
}

// ==================== 敌人坦克类 ====================
class EnemyTank extends Tank {
    constructor(x, y, level = 1) {
        super(x, y, DIRECTION.DOWN, COLORS.ENEMY_TANK);
        this.speed = ENEMY_SPEED + (level - 1) * 0.3;
        this.aiTimer = 0;
        this.aiChangeInterval = 60 + Math.random() * 60;
        this.shootChance = 0.02 + (level - 1) * 0.01;
        this.level = level;
        
        // 根据等级改变颜色
        if (level === 2) this.color = '#cc6633';
        if (level === 3) this.color = '#9933cc';
    }
    
    update(map, tanks, player) {
        super.update();
        
        if (!this.active) return;
        
        this.aiTimer++;
        
        // AI决策
        if (this.aiTimer >= this.aiChangeInterval) {
            this.aiTimer = 0;
            this.aiChangeInterval = 30 + Math.random() * 90;
            
            // 随机改变方向
            const directions = [DIRECTION.UP, DIRECTION.RIGHT, DIRECTION.DOWN, DIRECTION.LEFT];
            
            // 有概率朝向玩家
            if (player.active && Math.random() < 0.4) {
                const dx = player.x - this.x;
                const dy = player.y - this.y;
                
                if (Math.abs(dx) > Math.abs(dy)) {
                    this.direction = dx > 0 ? DIRECTION.RIGHT : DIRECTION.LEFT;
                } else {
                    this.direction = dy > 0 ? DIRECTION.DOWN : DIRECTION.UP;
                }
            } else {
                this.direction = directions[Math.floor(Math.random() * 4)];
            }
        }
        
        // 尝试移动
        let newX = this.x;
        let newY = this.y;
        
        switch(this.direction) {
            case DIRECTION.UP:
                newY -= this.speed;
                break;
            case DIRECTION.RIGHT:
                newX += this.speed;
                break;
            case DIRECTION.DOWN:
                newY += this.speed;
                break;
            case DIRECTION.LEFT:
                newX -= this.speed;
                break;
        }
        
        if (this.canMove(newX, newY, map, tanks)) {
            this.x = newX;
            this.y = newY;
        } else {
            // 遇到障碍时随机换方向
            const directions = [DIRECTION.UP, DIRECTION.RIGHT, DIRECTION.DOWN, DIRECTION.LEFT];
            this.direction = directions[Math.floor(Math.random() * 4)];
        }
        
        // 随机射击
        if (Math.random() < this.shootChance) {
            return this.shoot();
        }
        
        return null;
    }
}

// ==================== 游戏主类 ====================
class Game {
    constructor() {
        this.map = [];
        this.player = null;
        this.enemies = [];
        this.bullets = [];
        this.explosions = [];
        this.score = 0;
        this.level = 1;
        this.maxLevels = 3;
        this.enemiesToSpawn = 20;
        this.enemiesKilled = 0;
        this.spawnTimer = 0;
        this.spawnInterval = 120;
        this.gameOver = false;
        this.gameWon = false;
        this.enemySpawnPoints = [
            {x: 0, y: 0},
            {x: 10 * TILE_SIZE, y: 0},
            {x: 19 * TILE_SIZE, y: 0}
        ];
        this.lastSpawnIndex = 0;
    }
    
    init() {
        this.loadLevel(this.level);
        this.player = new PlayerTank(4 * TILE_SIZE, 17 * TILE_SIZE);
    }
    
    loadLevel(level) {
        this.map = [];
        const patterns = this.getLevelPattern(level);
        
        for (let y = 0; y < GRID_HEIGHT; y++) {
            this.map[y] = [];
            for (let x = 0; x < GRID_WIDTH; x++) {
                const tileType = patterns[y][x];
                this.map[y][x] = new Tile(x, y, tileType);
            }
        }
    }
    
    getLevelPattern(level) {
        // 基础地图模板
        const basePattern = [
            [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
            [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
            [0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,0,0],
            [0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,0,0],
            [0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,0,0],
            [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
            [0,0,0,0,1,1,0,0,2,2,0,0,1,1,0,0,0,0,0,0],
            [0,0,0,0,1,1,0,0,2,2,0,0,1,1,0,0,0,0,0,0],
            [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
            [0,1,1,0,0,0,1,1,1,1,1,1,0,0,0,1,1,0,0,0],
            [0,1,1,0,0,0,1,1,1,1,1,1,0,0,0,1,1,0,0,0],
            [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
            [0,0,0,0,2,2,2,2,0,0,2,2,2,2,0,0,0,0,0,0],
            [0,0,0,0,2,2,2,2,0,0,2,2,2,2,0,0,0,0,0,0],
            [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
            [0,0,1,1,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0],
            [0,0,1,1,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0],
            [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
            [0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0],
            [0,0,0,0,0,0,0,0,1,5,1,0,0,0,0,0,0,0,0,0]
        ];
        
        // 根据关卡调整地图
        const pattern = JSON.parse(JSON.stringify(basePattern));
        
        if (level === 2) {
            // 第二关：更多钢铁墙
            for(let y = 0; y < GRID_HEIGHT; y++) {
                for(let x = 0; x < GRID_WIDTH; x++) {
                    if (pattern[y][x] === 1 && Math.random() < 0.3) {
                        pattern[y][x] = 2;
                    }
                }
            }
        } else if (level === 3) {
            // 第三关：添加水域和更多钢铁墙
            for(let y = 0; y < GRID_HEIGHT; y++) {
                for(let x = 0; x < GRID_WIDTH; x++) {
                    if (pattern[y][x] === 1 && Math.random() < 0.4) {
                        pattern[y][x] = 2;
                    }
                    if (pattern[y][x] === 0 && Math.random() < 0.1) {
                        pattern[y][x] = 3;
                    }
                }
            }
        }
        
        return pattern;
    }
    
    update() {
        if (this.gameOver || this.gameWon || isPaused) return;
        
        // 更新玩家
        if (this.player.active) {
            this.player.update(keys, this.map, [this.player, ...this.enemies]);
        } else if (this.player.lives > 0) {
            this.player.lives--;
            if (this.player.lives > 0) {
                this.player.respawn();
            } else {
                this.endGame(false);
                return;
            }
        }
        
        // 生成敌人
        if (this.enemiesToSpawn > 0 && this.enemies.length < 4) {
            this.spawnTimer++;
            if (this.spawnTimer >= this.spawnInterval) {
                this.spawnTimer = 0;
                this.spawnEnemy();
            }
        }
        
        // 更新敌人
        for (let enemy of this.enemies) {
            const bullet = enemy.update(this.map, [this.player, ...this.enemies], this.player);
            if (bullet) {
                this.bullets.push(bullet);
            }
        }
        
        // 移除死亡的敌人
        this.enemies = this.enemies.filter(e => e.active);
        
        // 玩家射击
        if (keys[' '] && this.player.active) {
            const bullet = this.player.shoot();
            if (bullet) {
                this.bullets.push(bullet);
            }
        }
        
        // 玩家发射炸弹（回车键）
        if (keys['Enter'] && this.player.active) {
            const bomb = this.player.shootBomb();
            if (bomb) {
                this.bullets.push(bomb);
            }
        }
        
        // 更新子弹
        for (let bullet of this.bullets) {
            bullet.update();
        }
        
        // 移除超出边界或失效的子弹
        this.bullets = this.bullets.filter(b => b.active);
        
        // 碰撞检测
        this.checkCollisions();
        
        // 更新爆炸效果
        for (let exp of this.explosions) {
            exp.update();
        }
        this.explosions = this.explosions.filter(e => e.active);
        
        // 检查过关条件
        if (this.enemiesToSpawn === 0 && this.enemies.length === 0) {
            if (this.level < this.maxLevels) {
                this.nextLevel();
            } else {
                this.endGame(true);
            }
        }
        
        this.updateUI();
    }
    
    spawnEnemy() {
        const spawnPoint = this.enemySpawnPoints[this.lastSpawnIndex % 3];
        this.lastSpawnIndex++;
        
        // 检查出生点是否被占用
        const rect = {x: spawnPoint.x, y: spawnPoint.y, width: TANK_SIZE, height: TANK_SIZE};
        let canSpawn = true;
        
        for (let tank of [this.player, ...this.enemies]) {
            if (tank.active && this.checkRectCollision(rect, tank.getRect())) {
                canSpawn = false;
                break;
            }
        }
        
        if (canSpawn) {
            const level = Math.min(3, Math.floor(this.enemiesKilled / 7) + 1);
            const enemy = new EnemyTank(spawnPoint.x, spawnPoint.y, level);
            this.enemies.push(enemy);
            this.enemiesToSpawn--;
        }
    }
    
    checkCollisions() {
        for (let bullet of this.bullets) {
            if (!bullet.active) continue;
            
            const bulletRect = bullet.getRect();
            
            // 检查子弹与地图碰撞
            const leftTile = Math.floor(bulletRect.x / TILE_SIZE);
            const rightTile = Math.floor((bulletRect.x + bulletRect.width) / TILE_SIZE);
            const topTile = Math.floor(bulletRect.y / TILE_SIZE);
            const bottomTile = Math.floor((bulletRect.y + bulletRect.height) / TILE_SIZE);
            
            for (let ty = topTile; ty <= bottomTile; ty++) {
                for (let tx = leftTile; tx <= rightTile; tx++) {
                    if (ty >= 0 && ty < GRID_HEIGHT && tx >= 0 && tx < GRID_WIDTH) {
                        const tile = this.map[ty][tx];
                        if (tile && !tile.destroyed && tile.type !== TILE.EMPTY && tile.type !== TILE.GRASS) {
                            // 炸弹可以穿过砖块
                            if (!bullet.isBomb) {
                                bullet.active = false;
                            }
                            if (tile.hit()) {
                                this.explosions.push(new Explosion(
                                    tx * TILE_SIZE + TILE_SIZE/2,
                                    ty * TILE_SIZE + TILE_SIZE/2
                                ));
                            }
                            if (tile.type === TILE.BASE) {
                                this.endGame(false);
                                return;
                            }
                        }
                    }
                }
            }
            
            // 检查子弹与坦克碰撞
            if (bullet.isPlayer) {
                // 玩家子弹击中敌人
                for (let enemy of this.enemies) {
                    if (enemy.active && this.checkRectCollision(bulletRect, enemy.getRect())) {
                        bullet.active = false;
                        enemy.hit();
                        this.explosions.push(new Explosion(
                            enemy.x + TANK_SIZE/2,
                            enemy.y + TANK_SIZE/2,
                            'large'
                        ));
                        this.score += 100 * enemy.level;
                        this.enemiesKilled++;
                        break;
                    }
                }
            } else {
                // 敌人子弹击中玩家
                if (this.player.active && this.player.invulnerable === 0 &&
                    this.checkRectCollision(bulletRect, this.player.getRect())) {
                    bullet.active = false;
                    this.player.hit();
                    this.explosions.push(new Explosion(
                        this.player.x + TANK_SIZE/2,
                        this.player.y + TANK_SIZE/2,
                        'large'
                    ));
                }
            }
            
            // 子弹间碰撞
            for (let otherBullet of this.bullets) {
                if (bullet !== otherBullet && bullet.active && otherBullet.active &&
                    bullet.isPlayer !== otherBullet.isPlayer &&
                    this.checkRectCollision(bulletRect, otherBullet.getRect())) {
                    bullet.active = false;
                    otherBullet.active = false;
                    this.explosions.push(new Explosion(
                        (bullet.x + otherBullet.x) / 2,
                        (bullet.y + otherBullet.y) / 2
                    ));
                    break;
                }
            }
        }
    }
    
    checkRectCollision(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width &&
               rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height &&
               rect1.y + rect1.height > rect2.y;
    }
    
    draw() {
        // 绘制草地纹理背景
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, '#4a7c28');
        gradient.addColorStop(0.5, '#5a8c38');
        gradient.addColorStop(1, '#4a7c28');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // 使用固定种子生成静态草地纹理
        const seed = 12345;
        function random(x, y) {
            const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
            return n - Math.floor(n);
        }
        
        // 添加草地纹理点
        ctx.fillStyle = '#6a9c48';
        for(let y = 0; y < canvas.height; y += 8) {
            for(let x = 0; x < canvas.width; x += 8) {
                if(random(x, y) > 0.7) {
                    const offsetX = (random(x + 100, y) * 4);
                    const offsetY = (random(x, y + 100) * 4);
                    ctx.fillRect(x + offsetX, y + offsetY, 2, 2);
                }
            }
        }
        
        // 添加深绿色草丛
        ctx.fillStyle = '#3a6c18';
        for(let y = 0; y < canvas.height; y += 16) {
            for(let x = 0; x < canvas.width; x += 16) {
                if(random(x + 200, y + 200) > 0.8) {
                    ctx.fillRect(x, y, 6, 6);
                    ctx.fillRect(x + 8, y + 4, 4, 4);
                }
            }
        }
        
        // 绘制地图
        for (let y = 0; y < GRID_HEIGHT; y++) {
            for (let x = 0; x < GRID_WIDTH; x++) {
                this.map[y][x].draw(ctx);
            }
        }
        
        // 绘制玩家
        if (this.player) {
            this.player.draw(ctx);
        }
        
        // 绘制敌人
        for (let enemy of this.enemies) {
            enemy.draw(ctx);
        }
        
        // 绘制子弹
        for (let bullet of this.bullets) {
            bullet.draw(ctx);
        }
        
        // 绘制爆炸效果
        for (let exp of this.explosions) {
            exp.draw(ctx);
        }
        
        // 绘制草地（覆盖在坦克上方）
        for (let y = 0; y < GRID_HEIGHT; y++) {
            for (let x = 0; x < GRID_WIDTH; x++) {
                if (this.map[y][x].type === TILE.GRASS && !this.map[y][x].destroyed) {
                    this.map[y][x].draw(ctx);
                }
            }
        }
    }
    
    nextLevel() {
        this.level++;
        this.enemiesToSpawn = 20;
        this.enemiesKilled = 0;
        this.enemies = [];
        this.bullets = [];
        this.explosions = [];
        this.loadLevel(this.level);
        this.player.x = 4 * TILE_SIZE;
        this.player.y = 17 * TILE_SIZE;
        this.player.direction = DIRECTION.UP;
        this.player.active = true;
        this.spawnTimer = 0;
    }
    
    endGame(victory) {
        this.gameOver = !victory;
        this.gameWon = victory;
        
        if (victory) {
            document.getElementById('victoryScore').textContent = this.score;
            document.getElementById('victoryScreen').classList.remove('hidden');
        } else {
            document.getElementById('finalScore').textContent = this.score;
            document.getElementById('gameOverScreen').classList.remove('hidden');
        }
    }
    
    updateUI() {
        document.getElementById('scoreValue').textContent = this.score;
        document.getElementById('levelValue').textContent = this.level;
        document.getElementById('livesValue').textContent = this.player.lives;
        document.getElementById('enemyValue').textContent = this.enemiesToSpawn + this.enemies.length;
        // 显示炸弹数量
        const bombsDisplay = document.createElement('div');
        bombsDisplay.className = 'bombs-count';
        bombsDisplay.innerHTML = `<span class="label">炸弹:</span><span class="value">${this.player.bombs}</span>`;
        
        // 更新或添加炸弹显示
        let bombsElement = document.querySelector('.bombs-count');
        if (!bombsElement) {
            const header = document.querySelector('.game-header');
            header.appendChild(bombsDisplay);
        } else {
            bombsElement.innerHTML = `<span class="label">炸弹:</span><span class="value">${this.player.bombs}</span>`;
        }
    }
}

// ==================== 事件处理 ====================
document.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    
    if (e.key === 'p' || e.key === 'P') {
        isPaused = !isPaused;
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

// 防止方向键滚动页面
window.addEventListener('keydown', (e) => {
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].indexOf(e.key) > -1) {
        e.preventDefault();
    }
});

// ==================== 游戏控制函数 ====================
function startGame() {
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('gameOverScreen').classList.add('hidden');
    document.getElementById('victoryScreen').classList.add('hidden');
    
    game = new Game();
    game.init();
    gameLoop();
}

function restartGame() {
    startGame();
}

function gameLoop() {
    if (game) {
        game.update();
        game.draw();
    }
    requestAnimationFrame(gameLoop);
}

// 启动游戏循环
requestAnimationFrame(gameLoop);

