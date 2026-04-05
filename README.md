# 坦克大战 3D 网页版

经典坦克大战游戏的 3D 重制版，使用 Three.js 开发，可在浏览器中直接运行。

## 游戏功能

- **双模式载具选择**：坦克（地面作战）或战斗机（空中优势）
- **3D 场景**：完整的 3D 地图，包含砖块、钢板、水潭、草地等地形
- **扩展地图**：30x30 网格地图，扩大区域自动随机生成建筑
- **敌方 AI**：敌方坦克会随机攻击，可升级难度
- **多关卡系统**：随着关卡提升，敌人数量和难度逐渐增加
- **基地系统**：我方和敌方基地，摧毁敌方基地获胜
- **水花效果**：坦克穿过水潭时会触发溅水粒子效果
- **GLB 模型**：支持加载外部 GLB 模型（可选）
- **音效系统**：内置程序化生成的音效

## 代码结构

```
├── game3d.js       # 主游戏逻辑（3D 版本）
├── game.js         # 2D 版本游戏逻辑
├── index3d.html    # 3D 游戏入口页面
├── index.html      # 2D 游戏入口页面
├── server.js       # Express 本地服务器
├── package.json    # 项目依赖配置
└── assets/
    └── models/     # GLB 模型目录（可选）
```

### 核心模块（game3d.js）

- **常量定义**：地图尺寸 (`GW`, `GH`)、格子大小 (`CELL`)、游戏参数
- **AudioManager**：Web Audio API 音效系统
- **Three.js 初始化**：场景、相机、渲染器、灯光
- **模型构建**：坦克、战斗机、墙壁、金字塔、水潭等
- **游戏循环**：updatePlayer、updateEnemies、updateBullets、updateParticles
- **碰撞检测**：isSolid、canTankMove、gridAt
- **关卡加载**：loadLevel（地图生成）

## 本地运行

### 方式一：Node.js 服务器

```bash
# 安装依赖
npm install

# 启动服务器
npm start
```

然后访问 http://localhost:3000

### 方式二：直接打开 HTML

在浏览器中直接打开 `index3d.html` 文件（需要支持 ES6 模块的现代浏览器，部分功能可能受限）

## 操作说明

- **WASD / 方向键**：移动
- **空格键**：射击
- **Enter**：投放炸弹
- **鼠标**：旋转视角

## 可选：GLB 模型

将 `tank.glb` 和 `j20.glb` 放入 `assets/models/` 目录即可使用自定义模型。

## 技术栈

- Three.js（3D 渲染）
- Web Audio API（音效）
- Express（本地服务器）
