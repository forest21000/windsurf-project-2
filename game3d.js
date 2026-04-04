// ==================== 三维坦克大战 - Three.js ====================
// 全局变量
let scene, camera, renderer, clock;
let player = null;
let enemies = [];
let bullets = [];
let explosionParticles = [];
let wallMeshes = [];   // 3D墙壁对象
let grid = [];         // 逻辑地图网格 grid[z][x]
let game = null;
let isPaused = false;
const keys = {};
let sunLight;
let camSmooth = new THREE.Vector3();
let camLookSmooth = new THREE.Vector3();

// 游戏常量
const CELL = 4;               // 每个格子的3D单位
const GW = 20, GH = 20;       // 网格尺寸
const MAP_W = GW * CELL;      // 地图总宽
const MAP_H = GH * CELL;      // 地图总深
const WALL_H = 7;              // 墙壁高度（模拟房屋）
const PLAYER_SPD = 10;
const ENEMY_SPD = 5;
const BULLET_SPD = 35;
const BOMB_SPD = 20;
const BOMB_RANGE = 5;          // 炸弹爆炸半径（格子数）
const TANK_R = 1.6;            // 坦克碰撞半径

const DIR = { UP: 0, RIGHT: 1, DOWN: 2, LEFT: 3 };
const TILE = { EMPTY: 0, BRICK: 1, STEEL: 2, WATER: 3, GRASS: 4, BASE: 5 };
const DIR_VEC = [
    { x: 0, z: -1 },  // UP
    { x: 1, z: 0 },   // RIGHT
    { x: 0, z: 1 },   // DOWN
    { x: -1, z: 0 }   // LEFT
];
const DIR_ANGLE = [Math.PI, Math.PI * 0.5, 0, Math.PI * 1.5]; // Y轴旋转

// ==================== Three.js 初始化 ====================
function initThreeJS() {
    clock = new THREE.Clock();
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);

    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 500);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('game-container').appendChild(renderer.domElement);

    // 灯光
    scene.add(new THREE.AmbientLight(0xffffff, 0.45));
    scene.add(new THREE.HemisphereLight(0x87ceeb, 0x4a7c28, 0.35));

    sunLight = new THREE.DirectionalLight(0xffffff, 0.9);
    sunLight.position.set(40, 80, 40);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(2048, 2048);
    const d = 80;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 250;
    scene.add(sunLight);
    scene.add(sunLight.target);

    scene.fog = new THREE.Fog(0x87ceeb, 100, 250);

    createGround();
    window.addEventListener('resize', onResize);
    document.getElementById('loading').style.display = 'none';
}

// ==================== 地面 ====================
function createGround() {
    // 大地面
    const geo = new THREE.PlaneGeometry(250, 250);
    const mat = new THREE.MeshLambertMaterial({ color: 0x4a7c28 });
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(MAP_W / 2, -0.01, MAP_H / 2);
    ground.receiveShadow = true;
    scene.add(ground);

    // 草地细节纹理 - 小草丛
    const grassGeo = new THREE.BoxGeometry(0.3, 0.4, 0.3);
    const grassMat = new THREE.MeshLambertMaterial({ color: 0x3a6c18 });
    for (let i = 0; i < 400; i++) {
        const g = new THREE.Mesh(grassGeo, grassMat);
        g.position.set(
            Math.random() * MAP_W,
            0.2,
            Math.random() * MAP_H
        );
        g.scale.y = 0.5 + Math.random();
        scene.add(g);
    }
}

// ==================== 坦克模型（金属质感） ====================
function buildTankModel(color) {
    const group = new THREE.Group();

    // 金属车身材质
    const bodyMat = new THREE.MeshStandardMaterial({
        color: color,
        metalness: 0.7,
        roughness: 0.3,
        envMapIntensity: 1.0
    });
    // 深色金属（炮管等）
    const darkMat = new THREE.MeshStandardMaterial({
        color: 0x1a1a1a,
        metalness: 0.9,
        roughness: 0.2
    });
    // 履带橡胶质感
    const trackMat = new THREE.MeshStandardMaterial({
        color: 0x2a2a2a,
        metalness: 0.1,
        roughness: 0.9
    });
    // 履带金属扣
    const trackMetalMat = new THREE.MeshStandardMaterial({
        color: 0x555555,
        metalness: 0.8,
        roughness: 0.4
    });

    // 履带左
    const ltGeo = new THREE.BoxGeometry(0.8, 0.6, 3.0);
    const lt = new THREE.Mesh(ltGeo, trackMat);
    lt.position.set(-1.2, 0.3, 0);
    lt.castShadow = true;
    group.add(lt);
    // 履带右
    const rt = new THREE.Mesh(ltGeo, trackMat);
    rt.position.set(1.2, 0.3, 0);
    rt.castShadow = true;
    group.add(rt);

    // 履带纹路（金属扣）
    const buckleGeo = new THREE.BoxGeometry(0.85, 0.08, 0.2);
    for (let i = -1.2; i <= 1.2; i += 0.4) {
        const bl = new THREE.Mesh(buckleGeo, trackMetalMat);
        bl.position.set(-1.2, 0.62, i);
        group.add(bl);
        const br = new THREE.Mesh(buckleGeo, trackMetalMat);
        br.position.set(1.2, 0.62, i);
        group.add(br);
    }

    // 车身底盘
    const chassisGeo = new THREE.BoxGeometry(2.0, 0.4, 2.8);
    const chassisMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.5, roughness: 0.6 });
    const chassis = new THREE.Mesh(chassisGeo, chassisMat);
    chassis.position.set(0, 0.5, 0);
    chassis.castShadow = true;
    group.add(chassis);

    // 车身主体（带斜面感）
    const bodyGeo = new THREE.BoxGeometry(1.8, 0.6, 2.4);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(0, 0.85, 0);
    body.castShadow = true;
    group.add(body);

    // 车身前装甲（倾斜）
    const armorGeo = new THREE.BoxGeometry(1.6, 0.3, 0.5);
    const armor = new THREE.Mesh(armorGeo, bodyMat);
    armor.position.set(0, 0.95, 1.3);
    armor.rotation.x = -0.3;
    armor.castShadow = true;
    group.add(armor);

    // 炮塔
    const turretGeo = new THREE.CylinderGeometry(0.65, 0.75, 0.55, 16);
    const turret = new THREE.Mesh(turretGeo, bodyMat);
    turret.position.set(0, 1.35, -0.1);
    turret.castShadow = true;
    group.add(turret);

    // 炮塔顶部舱盖
    const hatchGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.12, 12);
    const hatchMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.8, roughness: 0.3 });
    const hatch = new THREE.Mesh(hatchGeo, hatchMat);
    hatch.position.set(0.2, 1.65, -0.15);
    group.add(hatch);

    // 炮管
    const barrelGeo = new THREE.CylinderGeometry(0.1, 0.14, 2.4, 10);
    const barrel = new THREE.Mesh(barrelGeo, darkMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 1.35, 1.35);
    barrel.castShadow = true;
    group.add(barrel);

    // 炮口制退器
    const muzzleBrakeGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.2, 8);
    const muzzleBrake = new THREE.Mesh(muzzleBrakeGeo, darkMat);
    muzzleBrake.rotation.x = Math.PI / 2;
    muzzleBrake.position.set(0, 1.35, 2.55);
    group.add(muzzleBrake);

    // 车身侧裙板
    const skirtGeo = new THREE.BoxGeometry(0.08, 0.4, 2.6);
    const skirtMat = new THREE.MeshStandardMaterial({ color: color, metalness: 0.6, roughness: 0.4 });
    const skirtL = new THREE.Mesh(skirtGeo, skirtMat);
    skirtL.position.set(-0.95, 0.6, 0);
    group.add(skirtL);
    const skirtR = new THREE.Mesh(skirtGeo, skirtMat);
    skirtR.position.set(0.95, 0.6, 0);
    group.add(skirtR);

    // 车尾排气管
    const exhaustGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.6, 6);
    const exhaustMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.9, roughness: 0.2 });
    const exhaust1 = new THREE.Mesh(exhaustGeo, exhaustMat);
    exhaust1.position.set(0.4, 0.9, -1.4);
    exhaust1.rotation.x = Math.PI / 2;
    group.add(exhaust1);
    const exhaust2 = new THREE.Mesh(exhaustGeo, exhaustMat);
    exhaust2.position.set(-0.4, 0.9, -1.4);
    exhaust2.rotation.x = Math.PI / 2;
    group.add(exhaust2);

    return group;
}

// ==================== 墙壁（模拟房屋） ====================
function buildBrickWall(gx, gz) {
    const cx = gx * CELL + CELL / 2;
    const cz = gz * CELL + CELL / 2;
    const group = new THREE.Group();
    const brickColor = new THREE.MeshPhongMaterial({ color: 0xcc6633, shininess: 20 });
    const mortarColor = new THREE.MeshPhongMaterial({ color: 0xaa5522, shininess: 10 });
    const roofMat = new THREE.MeshPhongMaterial({ color: 0x884422, shininess: 15 });

    // 房屋主体
    const mainGeo = new THREE.BoxGeometry(CELL * 0.95, WALL_H, CELL * 0.95);
    const main = new THREE.Mesh(mainGeo, brickColor);
    main.position.set(cx, WALL_H / 2, cz);
    main.castShadow = true;
    main.receiveShadow = true;
    group.add(main);

    // 砖缝线（多层）
    for (let i = 1; i < WALL_H; i++) {
        const lineGeo = new THREE.BoxGeometry(CELL * 0.96, 0.05, CELL * 0.96);
        const line = new THREE.Mesh(lineGeo, mortarColor);
        line.position.set(cx, i, cz);
        group.add(line);
    }

    // 屋顶
    const roofGeo = new THREE.BoxGeometry(CELL * 1.05, 0.4, CELL * 1.05);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(cx, WALL_H + 0.2, cz);
    roof.castShadow = true;
    group.add(roof);

    // 窗户（每面一个）
    const windowMat = new THREE.MeshPhongMaterial({ color: 0x88ccff, emissive: 0x224466, shininess: 80 });
    const winGeo = new THREE.BoxGeometry(0.8, 1.0, 0.1);
    const winH = WALL_H * 0.6;
    // 前后窗户
    const wf = new THREE.Mesh(winGeo, windowMat);
    wf.position.set(cx, winH, cz + CELL * 0.48);
    group.add(wf);
    const wb = new THREE.Mesh(winGeo, windowMat);
    wb.position.set(cx, winH, cz - CELL * 0.48);
    group.add(wb);
    // 左右窗户
    const winGeoSide = new THREE.BoxGeometry(0.1, 1.0, 0.8);
    const wl = new THREE.Mesh(winGeoSide, windowMat);
    wl.position.set(cx - CELL * 0.48, winH, cz);
    group.add(wl);
    const wr = new THREE.Mesh(winGeoSide, windowMat);
    wr.position.set(cx + CELL * 0.48, winH, cz);
    group.add(wr);

    group.userData = { gx, gz, type: TILE.BRICK, destroyed: false };
    return group;
}

function buildSteelWall(gx, gz) {
    const cx = gx * CELL + CELL / 2;
    const cz = gz * CELL + CELL / 2;
    const mat = new THREE.MeshPhongMaterial({ color: 0x888888, shininess: 100, specular: 0x444444 });
    const geo = new THREE.BoxGeometry(CELL * 0.95, WALL_H, CELL * 0.95);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(cx, WALL_H / 2, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // 钢筋横条装饰
    const stripeMat = new THREE.MeshPhongMaterial({ color: 0x666666 });
    for (let i = 2; i < WALL_H; i += 2) {
        const stripe = new THREE.Mesh(
            new THREE.BoxGeometry(CELL * 0.96, 0.15, CELL * 0.96), stripeMat
        );
        stripe.position.set(cx, i, cz);
        mesh.add(stripe);
    }

    // 屋顶钢板
    const topMat = new THREE.MeshPhongMaterial({ color: 0x777777, shininess: 120 });
    const top = new THREE.Mesh(
        new THREE.BoxGeometry(CELL * 1.0, 0.3, CELL * 1.0), topMat
    );
    top.position.set(cx, WALL_H + 0.15, cz);
    top.castShadow = true;

    const group = new THREE.Group();
    group.add(mesh);
    group.add(top);
    group.userData = { gx, gz, type: TILE.STEEL, destroyed: false };
    return group;
}

function buildBase(gx, gz) {
    const cx = gx * CELL + CELL / 2;
    const cz = gz * CELL + CELL / 2;
    const group = new THREE.Group();

    // 底座
    const baseMat = new THREE.MeshPhongMaterial({ color: 0x555555, shininess: 30 });
    const baseGeo = new THREE.BoxGeometry(CELL * 0.9, 2, CELL * 0.9);
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.set(cx, 1, cz);
    base.castShadow = true;
    group.add(base);

    // 旗杆
    const poleGeo = new THREE.CylinderGeometry(0.1, 0.1, 8, 8);
    const poleMat = new THREE.MeshPhongMaterial({ color: 0x888888 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(cx, 6, cz);
    group.add(pole);

    // 旗帜
    const flagGeo = new THREE.BoxGeometry(2, 1.2, 0.05);
    const flagMat = new THREE.MeshPhongMaterial({ color: 0xffcc00, emissive: 0x554400, side: THREE.DoubleSide });
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(cx + 1, 9.5, cz);
    group.add(flag);

    // 光柱
    const glowGeo = new THREE.CylinderGeometry(0.4, 0.4, 10, 8);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.12 });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.set(cx, 5, cz);
    group.add(glow);

    group.userData = { gx, gz, type: TILE.BASE, destroyed: false };
    return group;
}

function buildWater(gx, gz) {
    const cx = gx * CELL + CELL / 2;
    const cz = gz * CELL + CELL / 2;
    const mat = new THREE.MeshPhongMaterial({ color: 0x2288cc, transparent: true, opacity: 0.7, shininess: 120 });
    const geo = new THREE.BoxGeometry(CELL * 0.95, 0.3, CELL * 0.95);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(cx, 0.15, cz);
    mesh.receiveShadow = true;
    mesh.userData = { gx, gz, type: TILE.WATER, destroyed: false };
    return mesh;
}

// ==================== 地图 ====================
function loadLevel(level) {
    // 清除旧地图
    wallMeshes.forEach(obj => scene.remove(obj));
    wallMeshes = [];
    grid = [];

    const pattern = [
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

    for (let z = 0; z < GH; z++) {
        grid[z] = [];
        for (let x = 0; x < GW; x++) {
            const t = pattern[z][x];
            grid[z][x] = { type: t, destroyed: false, mesh: null };
            let obj = null;
            if (t === TILE.BRICK) obj = buildBrickWall(x, z);
            else if (t === TILE.STEEL) obj = buildSteelWall(x, z);
            else if (t === TILE.BASE) obj = buildBase(x, z);
            else if (t === TILE.WATER) obj = buildWater(x, z);
            if (obj) {
                grid[z][x].mesh = obj;
                wallMeshes.push(obj);
                scene.add(obj);
            }
        }
    }

    // 边界围墙
    const borderMat = new THREE.MeshPhongMaterial({ color: 0x666666 });
    const wallThick = 0.5;
    const bGeos = [
        { geo: new THREE.BoxGeometry(MAP_W + 2, 2, wallThick), pos: [MAP_W/2, 1, -wallThick/2] },
        { geo: new THREE.BoxGeometry(MAP_W + 2, 2, wallThick), pos: [MAP_W/2, 1, MAP_H + wallThick/2] },
        { geo: new THREE.BoxGeometry(wallThick, 2, MAP_H + 2), pos: [-wallThick/2, 1, MAP_H/2] },
        { geo: new THREE.BoxGeometry(wallThick, 2, MAP_H + 2), pos: [MAP_W + wallThick/2, 1, MAP_H/2] }
    ];
    bGeos.forEach(b => {
        const m = new THREE.Mesh(b.geo, borderMat);
        m.position.set(...b.pos);
        m.castShadow = true;
        scene.add(m);
        wallMeshes.push(m);
    });
}

// ==================== 碰撞检测 ====================
function gridAt(gx, gz) {
    if (gx < 0 || gx >= GW || gz < 0 || gz >= GH) return { type: -1, destroyed: false };
    return grid[gz][gx];
}

function isSolid(gx, gz) {
    const cell = gridAt(gx, gz);
    if (cell.type === -1) return true;
    if (cell.destroyed) return false;
    return cell.type === TILE.BRICK || cell.type === TILE.STEEL || cell.type === TILE.WATER || cell.type === TILE.BASE;
}

function canTankMove(px, pz, radius) {
    // 边界
    if (px - radius < 0 || px + radius > MAP_W || pz - radius < 0 || pz + radius > MAP_H) return false;
    // 检查四角所在格子
    const corners = [
        [px - radius, pz - radius],
        [px + radius, pz - radius],
        [px - radius, pz + radius],
        [px + radius, pz + radius]
    ];
    for (const [cx, cz] of corners) {
        const gx = Math.floor(cx / CELL);
        const gz = Math.floor(cz / CELL);
        if (isSolid(gx, gz)) return false;
    }
    return true;
}

// ==================== 共享几何体（性能优化） ====================
const SHARED_GEO = {};
function getSharedGeo(key, factory) {
    if (!SHARED_GEO[key]) SHARED_GEO[key] = factory();
    return SHARED_GEO[key];
}
const MAX_PARTICLES = 200; // 同屏粒子上限

// ==================== 子弹 ====================
function fireBullet(tank, isBomb) {
    const d = tank.dir;
    const v = DIR_VEC[d];
    const spd = isBomb ? BOMB_SPD : BULLET_SPD;
    const px = tank.mesh.position.x + v.x * 2.5;
    const pz = tank.mesh.position.z + v.z * 2.5;

    const radius = isBomb ? 0.4 : 0.2;
    const color = isBomb ? 0xff9900 : (tank.isPlayer ? 0x3399ff : 0xff3333);
    const emissive = isBomb ? 0xff6600 : (tank.isPlayer ? 0x0044aa : 0xaa0000);

    const geoKey = isBomb ? 'bombBullet' : 'bullet';
    const geo = getSharedGeo(geoKey, () => new THREE.SphereGeometry(radius, 8, 8));
    const mat = new THREE.MeshPhongMaterial({ color, emissive, emissiveIntensity: 0.6, shininess: 80 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(px, 1.3, pz);
    scene.add(mesh);

    bullets.push({
        mesh, light: null,
        vx: v.x * spd,
        vz: v.z * spd,
        isPlayer: tank.isPlayer,
        isBomb: isBomb,
        dist: 0,
        maxDist: isBomb ? BOMB_RANGE * CELL : 200,
        active: true
    });
}

// ==================== 爆炸粒子系统（性能优化版） ====================
function spawnExplosion(x, y, z, big) {
    // 粒子数量上限保护
    if (explosionParticles.length > MAX_PARTICLES) return;

    const fireGeo = getSharedGeo('fireSphere', () => new THREE.SphereGeometry(1, 4, 4));
    const sparkGeo = getSharedGeo('sparkBox', () => new THREE.BoxGeometry(1, 1, 3));
    const smokeGeo = getSharedGeo('smokeSphere', () => new THREE.SphereGeometry(1, 4, 4));

    // === 火焰核心 ===
    const fireCount = big ? 10 : 4;
    for (let i = 0; i < fireCount; i++) {
        const size = (big ? 0.4 : 0.2) * (0.5 + Math.random());
        const colors = [0xffffff, 0xffee88, 0xffaa33, 0xff6600, 0xff3300];
        const color = colors[Math.floor(Math.random() * colors.length)];
        const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
        const mesh = new THREE.Mesh(fireGeo, mat);
        mesh.scale.setScalar(size);
        mesh.position.set(x, y, z);
        scene.add(mesh);

        const speed = (big ? 6 : 3) * (0.3 + Math.random());
        const angle = Math.random() * Math.PI * 2;
        explosionParticles.push({
            mesh, type: 'fire',
            vx: Math.cos(angle) * speed,
            vy: 2 + Math.random() * 5,
            vz: Math.sin(angle) * speed,
            life: 0.35 + Math.random() * 0.3,
            age: 0, startSize: size
        });
    }

    // === 火花 ===
    const sparkCount = big ? 8 : 3;
    for (let i = 0; i < sparkCount; i++) {
        const size = (big ? 0.06 : 0.04);
        const color = [0xffcc00, 0xff8800, 0xffffff][Math.floor(Math.random() * 3)];
        const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
        const mesh = new THREE.Mesh(sparkGeo, mat);
        mesh.scale.setScalar(size);
        mesh.position.set(x, y, z);
        mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
        scene.add(mesh);

        const speed = (big ? 12 : 6) * (0.5 + Math.random());
        const angle = Math.random() * Math.PI * 2;
        const elev = Math.random() * 0.8;
        explosionParticles.push({
            mesh, type: 'spark',
            vx: Math.cos(angle) * speed,
            vy: elev * speed + 2,
            vz: Math.sin(angle) * speed,
            life: 0.4 + Math.random() * 0.3,
            age: 0, startSize: size
        });
    }

    // === 烟雾 ===
    const smokeCount = big ? 5 : 2;
    for (let i = 0; i < smokeCount; i++) {
        const size = (big ? 0.5 : 0.25) * (0.5 + Math.random());
        const gray = Math.floor(40 + Math.random() * 40);
        const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(gray/255, gray/255, gray/255), transparent: true, opacity: 0.5 });
        const mesh = new THREE.Mesh(smokeGeo, mat);
        mesh.scale.setScalar(size);
        mesh.position.set(x + (Math.random()-0.5)*0.5, y + 0.5, z + (Math.random()-0.5)*0.5);
        scene.add(mesh);

        const speed = (big ? 2 : 1) * Math.random();
        const angle = Math.random() * Math.PI * 2;
        explosionParticles.push({
            mesh, type: 'smoke',
            vx: Math.cos(angle) * speed,
            vy: 1 + Math.random() * 1.5,
            vz: Math.sin(angle) * speed,
            life: 0.7 + Math.random() * 0.5,
            age: 0, startSize: size
        });
    }

    // === 冲击波(仅大爆炸) ===
    if (big) {
        const ringGeo = getSharedGeo('ring', () => new THREE.RingGeometry(0.1, 0.5, 16));
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0xff8800, transparent: true, opacity: 0.7, side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.set(x, y + 0.3, z);
        ring.rotation.x = -Math.PI / 2;
        scene.add(ring);
        explosionParticles.push({
            mesh: ring, type: 'shockwave',
            vx: 0, vy: 0, vz: 0,
            life: 0.4, age: 0, startSize: 1
        });
    }
}

// ==================== 炸弹爆炸（性能优化） ====================
function bombExplode(x, z) {
    const cgx = Math.floor(x / CELL);
    const cgz = Math.floor(z / CELL);

    // 仅在几个散布位置显示小爆炸（而不是每个格子）
    const scatterExplosions = [];
    for (let dz = -BOMB_RANGE; dz <= BOMB_RANGE; dz++) {
        for (let dx = -BOMB_RANGE; dx <= BOMB_RANGE; dx++) {
            if (Math.sqrt(dx*dx + dz*dz) > BOMB_RANGE) continue;
            const gx = cgx + dx;
            const gz = cgz + dz;
            const cell = gridAt(gx, gz);
            if (cell.type === -1) continue;

            // 摧毁砖块
            if (!cell.destroyed && cell.type === TILE.BRICK) {
                cell.destroyed = true;
                if (cell.mesh) cell.mesh.visible = false;
                scatterExplosions.push([gx * CELL + CELL/2, 1, gz * CELL + CELL/2]);
            }

            // 摧毁敌人
            enemies.forEach(e => {
                if (!e.active) return;
                const ex = Math.floor(e.mesh.position.x / CELL);
                const ez = Math.floor(e.mesh.position.z / CELL);
                if (ex === gx && ez === gz) {
                    e.active = false;
                    e.mesh.visible = false;
                    game.score += 100;
                    game.enemiesKilled++;
                    scatterExplosions.push([e.mesh.position.x, 1.5, e.mesh.position.z]);
                }
            });
        }
    }

    // 中心大爆炸
    spawnExplosion(x, 2, z, true);

    // 散布小爆炸：最多显示8个点
    const maxScatter = Math.min(scatterExplosions.length, 8);
    for (let i = 0; i < maxScatter; i++) {
        const idx = Math.floor(i * scatterExplosions.length / maxScatter);
        const [ex, ey, ez] = scatterExplosions[idx];
        spawnExplosion(ex, ey, ez, false);
    }

    // 在爆炸边缘放几个烟雾指示范围
    for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        const ex = x + Math.cos(angle) * BOMB_RANGE * CELL * 0.8;
        const ez = z + Math.sin(angle) * BOMB_RANGE * CELL * 0.8;
        const smokeGeo = getSharedGeo('smokeSphere', () => new THREE.SphereGeometry(1, 4, 4));
        const mat = new THREE.MeshBasicMaterial({ color: 0x444444, transparent: true, opacity: 0.4 });
        const mesh = new THREE.Mesh(smokeGeo, mat);
        mesh.scale.setScalar(0.4);
        mesh.position.set(ex, 1, ez);
        scene.add(mesh);
        explosionParticles.push({
            mesh, type: 'smoke',
            vx: 0, vy: 1.5, vz: 0,
            life: 0.8, age: 0, startSize: 0.4
        });
    }
}

// ==================== 游戏对象 ====================
function createTankObj(color, isPlayer, gx, gz, dir) {
    const mesh = buildTankModel(color);
    const cx = gx * CELL + CELL / 2;
    const cz = gz * CELL + CELL / 2;
    mesh.position.set(cx, 0, cz);
    mesh.rotation.y = DIR_ANGLE[dir];
    scene.add(mesh);
    return {
        mesh, isPlayer, dir, active: true,
        cooldown: 0, maxCooldown: isPlayer ? 0.25 : 0.8,
        lives: isPlayer ? 3 : 1,
        bombs: isPlayer ? 10 : 0,
        invulnerable: isPlayer ? 2.0 : 0, // 初始无敌秒数
        level: 1,
        aiTimer: 0
    };
}

// ==================== 初始化游戏 ====================
function initGame() {
    // 清除旧对象
    if (player) scene.remove(player.mesh);
    enemies.forEach(e => scene.remove(e.mesh));
    bullets.forEach(b => { scene.remove(b.mesh); scene.remove(b.light); });
    explosionParticles.forEach(p => scene.remove(p.mesh));

    enemies = [];
    bullets = [];
    explosionParticles = [];

    loadLevel(1);

    player = createTankObj(0x4ecca3, true, 4, 17, DIR.UP);

    game = {
        score: 0, level: 1, maxLevels: 3,
        enemiesToSpawn: 20, enemiesKilled: 0,
        spawnTimer: 0, gameOver: false, gameWon: false
    };

    // 初始化相机（固定方位跟随）
    camSmooth.set(player.mesh.position.x, 10, player.mesh.position.z + 14);
    camLookSmooth.set(player.mesh.position.x, 2, player.mesh.position.z);

    // 初始化小地图
    if (!minimapCanvas) initMinimap();

    updateUI();
}

// ==================== 相机（固定方位跟随坦克位置） ====================
function updateCamera(dt) {
    if (!player) return;
    const px = player.mesh.position.x;
    const pz = player.mesh.position.z;

    // 固定方位：始终从南侧偏上看向坦克，方向不随坦克旋转
    const camOffX = 0;     // 水平偏移
    const camOffZ = 14;    // 固定在坦克南侧（+Z方向）
    const camH = 10;       // 相机高度
    const lookH = 2;       // 注视坦克腰部

    const targetCamPos = new THREE.Vector3(px + camOffX, camH, pz + camOffZ);
    const targetLook = new THREE.Vector3(px, lookH, pz);

    // 平滑跟随位置
    const smoothFactor = 1 - Math.pow(0.0001, dt);
    camSmooth.lerp(targetCamPos, smoothFactor);
    camLookSmooth.lerp(targetLook, smoothFactor);

    camera.position.copy(camSmooth);
    camera.lookAt(camLookSmooth);

    // 太阳光跟随玩家
    sunLight.position.set(px + 30, 60, pz + 30);
    sunLight.target.position.set(px, 0, pz);
}

// ==================== 玩家更新 ====================
function updatePlayer(dt) {
    if (!player || !player.active) return;

    if (player.cooldown > 0) player.cooldown -= dt;
    if (player.invulnerable > 0) {
        player.invulnerable -= dt;
        player.mesh.visible = Math.floor(Date.now() / 80) % 2 === 0;
    } else {
        player.mesh.visible = true;
    }

    const spd = PLAYER_SPD * dt;
    let moved = false;
    let nx = player.mesh.position.x;
    let nz = player.mesh.position.z;

    if (keys['ArrowUp']) {
        player.dir = DIR.UP;
        nz -= spd;
        moved = true;
    } else if (keys['ArrowDown']) {
        player.dir = DIR.DOWN;
        nz += spd;
        moved = true;
    } else if (keys['ArrowLeft']) {
        player.dir = DIR.LEFT;
        nx -= spd;
        moved = true;
    } else if (keys['ArrowRight']) {
        player.dir = DIR.RIGHT;
        nx += spd;
        moved = true;
    }

    if (moved) {
        player.mesh.rotation.y = DIR_ANGLE[player.dir];
        // 分轴碰撞检测
        if (canTankMove(nx, player.mesh.position.z, TANK_R)) {
            player.mesh.position.x = nx;
        }
        if (canTankMove(player.mesh.position.x, nz, TANK_R)) {
            player.mesh.position.z = nz;
        }
    }

    // 射击
    if (keys[' '] && player.cooldown <= 0) {
        fireBullet(player, false);
        player.cooldown = player.maxCooldown;
    }
    // 炸弹
    if (keys['Enter'] && player.cooldown <= 0 && player.bombs > 0) {
        fireBullet(player, true);
        player.cooldown = player.maxCooldown * 3;
        player.bombs--;
    }
}

// ==================== 敌人AI ====================
function spawnEnemy() {
    const spawnGx = [0, 9, 18];
    const gx = spawnGx[Math.floor(Math.random() * 3)];
    const colors = [0xe74c3c, 0xcc6633, 0x9933cc, 0x666666];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const e = createTankObj(color, false, gx, 0, DIR.DOWN);
    e.level = Math.ceil(Math.random() * 3);
    enemies.push(e);
}

function updateEnemies(dt) {
    // 生成敌人
    if (game.enemiesToSpawn > 0 && enemies.filter(e => e.active).length < 4) {
        game.spawnTimer += dt;
        if (game.spawnTimer > 2) {
            game.spawnTimer = 0;
            spawnEnemy();
            game.enemiesToSpawn--;
        }
    }

    enemies.forEach(e => {
        if (!e.active) return;
        if (e.cooldown > 0) e.cooldown -= dt;

        e.aiTimer += dt;
        // 每隔一段时间换方向
        if (e.aiTimer > 1 + Math.random() * 2) {
            e.aiTimer = 0;
            e.dir = Math.floor(Math.random() * 4);
        }

        const spd = ENEMY_SPD * dt;
        const v = DIR_VEC[e.dir];
        const nx = e.mesh.position.x + v.x * spd;
        const nz = e.mesh.position.z + v.z * spd;

        e.mesh.rotation.y = DIR_ANGLE[e.dir];

        if (canTankMove(nx, e.mesh.position.z, TANK_R)) {
            e.mesh.position.x = nx;
        } else {
            e.aiTimer = 10; // 碰墙换方向
        }
        if (canTankMove(e.mesh.position.x, nz, TANK_R)) {
            e.mesh.position.z = nz;
        } else {
            e.aiTimer = 10;
        }

        // 射击
        if (Math.random() < 0.015 && e.cooldown <= 0) {
            fireBullet(e, false);
            e.cooldown = e.maxCooldown;
        }
    });
}

// ==================== 子弹更新 ====================
function updateBullets(dt) {
    bullets.forEach(b => {
        if (!b.active) return;

        b.mesh.position.x += b.vx * dt;
        b.mesh.position.z += b.vz * dt;
        if (b.light) b.light.position.copy(b.mesh.position);
        b.dist += Math.sqrt(b.vx * b.vx + b.vz * b.vz) * dt;

        // 炸弹射程
        if (b.isBomb && b.dist >= b.maxDist) {
            b.active = false;
            bombExplode(b.mesh.position.x, b.mesh.position.z);
            return;
        }

        // 边界
        const bx = b.mesh.position.x;
        const bz = b.mesh.position.z;
        if (bx < 0 || bx > MAP_W || bz < 0 || bz > MAP_H) {
            b.active = false;
            return;
        }

        // 墙壁碰撞
        const gx = Math.floor(bx / CELL);
        const gz = Math.floor(bz / CELL);
        const cell = gridAt(gx, gz);
        if (cell.type !== -1 && !cell.destroyed) {
            if (cell.type === TILE.BRICK) {
                if (!b.isBomb) {
                    b.active = false;
                    cell.destroyed = true;
                    if (cell.mesh) cell.mesh.visible = false;
                    spawnExplosion(bx, 1.5, bz, false);
                }
            } else if (cell.type === TILE.STEEL) {
                if (!b.isBomb) {
                    b.active = false;
                    spawnExplosion(bx, 1.5, bz, false);
                }
            } else if (cell.type === TILE.BASE) {
                b.active = false;
                cell.destroyed = true;
                if (cell.mesh) cell.mesh.visible = false;
                spawnExplosion(bx, 2, bz, true);
                game.gameOver = true;
                setTimeout(showGameOver, 500);
                return;
            }
        }

        // 击中坦克
        if (b.isPlayer) {
            enemies.forEach(e => {
                if (!e.active) return;
                const dx = bx - e.mesh.position.x;
                const dz = bz - e.mesh.position.z;
                if (Math.abs(dx) < 2 && Math.abs(dz) < 2) {
                    b.active = false;
                    e.lives--;
                    if (e.lives <= 0) {
                        e.active = false;
                        e.mesh.visible = false;
                        game.score += 100 * e.level;
                        game.enemiesKilled++;
                    }
                    spawnExplosion(e.mesh.position.x, 1.5, e.mesh.position.z, true);
                }
            });
        } else {
            if (player && player.active && player.invulnerable <= 0) {
                const dx = bx - player.mesh.position.x;
                const dz = bz - player.mesh.position.z;
                if (Math.abs(dx) < 2 && Math.abs(dz) < 2) {
                    b.active = false;
                    player.lives--;
                    player.invulnerable = 2.0;
                    spawnExplosion(player.mesh.position.x, 1.5, player.mesh.position.z, true);
                    if (player.lives <= 0) {
                        player.active = false;
                        player.mesh.visible = false;
                        game.gameOver = true;
                        setTimeout(showGameOver, 500);
                    }
                }
            }
        }
    });

    // 清理失效子弹
    bullets = bullets.filter(b => {
        if (!b.active) {
            scene.remove(b.mesh);
            if (b.light) scene.remove(b.light);
            b.mesh.material.dispose();
            return false;
        }
        return true;
    });
}

// ==================== 粒子更新 ====================
function updateParticles(dt) {
    explosionParticles.forEach(p => {
        p.age += dt;
        const t = p.age / p.life; // 0→1 生命进度

        if (p.type === 'fire') {
            p.mesh.position.x += p.vx * dt;
            p.mesh.position.y += p.vy * dt;
            p.mesh.position.z += p.vz * dt;
            p.vy -= 8 * dt;
            // 火焰先膨胀后缩小
            const scale = t < 0.3 ? (1 + t * 3) : (1.9 * (1 - t));
            p.mesh.scale.setScalar(Math.max(0.01, scale));
            p.mesh.material.opacity = Math.max(0, 1 - t * t);
            // 颜色从亮黄→深红
            const r = 1;
            const g = Math.max(0, 1 - t * 1.5);
            const b = Math.max(0, 0.3 - t);
            p.mesh.material.color.setRGB(r, g, b);
        } else if (p.type === 'spark') {
            p.mesh.position.x += p.vx * dt;
            p.mesh.position.y += p.vy * dt;
            p.mesh.position.z += p.vz * dt;
            p.vy -= 20 * dt; // 重力更强
            p.mesh.material.opacity = Math.max(0, 1 - t);
            p.mesh.rotation.x += dt * 10;
            p.mesh.rotation.z += dt * 8;
        } else if (p.type === 'smoke') {
            p.mesh.position.x += p.vx * dt;
            p.mesh.position.y += p.vy * dt;
            p.mesh.position.z += p.vz * dt;
            p.vy *= 0.98; // 烟雾减速上升
            // 烟雾膨胀
            const scale = 1 + t * 3;
            p.mesh.scale.setScalar(scale);
            p.mesh.material.opacity = Math.max(0, 0.5 * (1 - t));
        } else if (p.type === 'shockwave') {
            // 冲击波扩大
            const scale = 1 + t * 20;
            p.mesh.scale.setScalar(scale);
            p.mesh.material.opacity = Math.max(0, 0.7 * (1 - t));
        } else if (p.type === 'flash') {
            // 闪光衰减
            if (p.mesh.isLight) {
                p.mesh.intensity = Math.max(0, (1 - t) * 5);
            }
        }
    });

    explosionParticles = explosionParticles.filter(p => {
        if (p.age >= p.life) {
            scene.remove(p.mesh);
            if (p.mesh.geometry) p.mesh.geometry.dispose();
            if (p.mesh.material) p.mesh.material.dispose();
            return false;
        }
        return true;
    });
}

// ==================== 胜利检测 ====================
function checkWinCondition() {
    if (game.enemiesToSpawn <= 0 && enemies.filter(e => e.active).length === 0) {
        if (game.level < game.maxLevels) {
            game.level++;
            loadLevel(game.level);
            game.enemiesToSpawn = 20;
            game.spawnTimer = 0;
        } else {
            game.gameWon = true;
            showVictory();
        }
    }
}

// ==================== UI ====================
function updateUI() {
    document.getElementById('scoreValue').textContent = game.score;
    document.getElementById('levelValue').textContent = game.level;
    document.getElementById('livesValue').textContent = player ? player.lives : 0;
    document.getElementById('bombsValue').textContent = player ? player.bombs : 0;
    document.getElementById('enemyValue').textContent = game.enemiesToSpawn + enemies.filter(e => e.active).length;
}

function showGameOver() {
    document.getElementById('finalScore').textContent = game.score;
    document.getElementById('gameOverScreen').classList.remove('hidden');
}

function showVictory() {
    document.getElementById('victoryScore').textContent = game.score;
    document.getElementById('victoryScreen').classList.remove('hidden');
}

function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// ==================== 小地图 ====================
let minimapCanvas = null;
let minimapCtx = null;
const MINIMAP_SIZE = 180;
const MINIMAP_SCALE = MINIMAP_SIZE / MAP_W;

function initMinimap() {
    minimapCanvas = document.createElement('canvas');
    minimapCanvas.width = MINIMAP_SIZE;
    minimapCanvas.height = MINIMAP_SIZE;
    minimapCanvas.style.position = 'absolute';
    minimapCanvas.style.right = '15px';
    minimapCanvas.style.bottom = '50px';
    minimapCanvas.style.border = '2px solid #4ecca3';
    minimapCanvas.style.borderRadius = '8px';
    minimapCanvas.style.zIndex = '150';
    minimapCanvas.style.opacity = '0.85';
    document.getElementById('game-container').appendChild(minimapCanvas);
    minimapCtx = minimapCanvas.getContext('2d');
}

function drawMinimap() {
    if (!minimapCtx || !game) return;
    const ctx = minimapCtx;
    const s = MINIMAP_SCALE;

    // 背景
    ctx.fillStyle = '#2a4a15';
    ctx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

    // 绘制墙壁
    for (let z = 0; z < GH; z++) {
        for (let x = 0; x < GW; x++) {
            const cell = grid[z] && grid[z][x];
            if (!cell || cell.destroyed) continue;
            const px = x * CELL * s;
            const pz = z * CELL * s;
            const sz = CELL * s;
            if (cell.type === TILE.BRICK) {
                ctx.fillStyle = '#cc6633';
                ctx.fillRect(px, pz, sz, sz);
            } else if (cell.type === TILE.STEEL) {
                ctx.fillStyle = '#aaaaaa';
                ctx.fillRect(px, pz, sz, sz);
            } else if (cell.type === TILE.BASE) {
                ctx.fillStyle = '#ffcc00';
                ctx.fillRect(px, pz, sz, sz);
            } else if (cell.type === TILE.WATER) {
                ctx.fillStyle = '#2288cc';
                ctx.fillRect(px, pz, sz, sz);
            }
        }
    }

    // 绘制敌人（红点）
    enemies.forEach(e => {
        if (!e.active) return;
        ctx.fillStyle = '#ff3333';
        ctx.beginPath();
        ctx.arc(e.mesh.position.x * s, e.mesh.position.z * s, 3, 0, Math.PI * 2);
        ctx.fill();
    });

    // 绘制子弹（小点）
    bullets.forEach(b => {
        if (!b.active) return;
        ctx.fillStyle = b.isPlayer ? '#3399ff' : '#ff6666';
        ctx.beginPath();
        ctx.arc(b.mesh.position.x * s, b.mesh.position.z * s, 1.5, 0, Math.PI * 2);
        ctx.fill();
    });

    // 绘制玩家（绿点+方向指示）
    if (player && player.active) {
        const px = player.mesh.position.x * s;
        const pz = player.mesh.position.z * s;
        ctx.fillStyle = '#4ecca3';
        ctx.beginPath();
        ctx.arc(px, pz, 4, 0, Math.PI * 2);
        ctx.fill();

        // 方向线
        const v = DIR_VEC[player.dir];
        ctx.strokeStyle = '#4ecca3';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px, pz);
        ctx.lineTo(px + v.x * 8, pz + v.z * 8);
        ctx.stroke();
    }

    // 边框
    ctx.strokeStyle = '#4ecca3';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);
}

// ==================== 主循环 ====================
function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);

    if (game && !game.gameOver && !game.gameWon && !isPaused) {
        updatePlayer(dt);
        updateEnemies(dt);
        updateBullets(dt);
        updateParticles(dt);
        checkWinCondition();
        updateCamera(dt);
        updateUI();
        drawMinimap();
    } else if (game) {
        updateCamera(dt);
        updateParticles(dt);
        drawMinimap();
    }

    renderer.render(scene, camera);
}

// ==================== 输入处理 ====================
document.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    if (e.key === 'p' || e.key === 'P') isPaused = !isPaused;
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','Enter'].includes(e.key)) e.preventDefault();
});
document.addEventListener('keyup', (e) => { keys[e.key] = false; });

// ==================== 游戏控制 ====================
function startGame() {
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('gameOverScreen').classList.add('hidden');
    document.getElementById('victoryScreen').classList.add('hidden');
    initGame();
}

function restartGame() { startGame(); }

// ==================== 启动 ====================
initThreeJS();
animate();
