// WebSocket服务器URL
const WS_URL = 'ws://192.168.1.7:8080/api';
// 摇杆的初始位置
const JOYSTICK_CENTER = 'translate(0, 0)';
let ws; // WebSocket实例
let isConnected = false; // WebSocket连接状态标志
const reconnectInterval = 5000; // 重连间隔时间（毫秒）
const maxReconnectAttempts = 5; // 最大重连尝试次数
let reconnectAttempts = 0; // 当前重连尝试次数

// 检查并获取设备ID，如果不存在则创建新的ID
let deviceId = localStorage.getItem('device_id');
if (!deviceId) {
    deviceId = 'dev-' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('device_id', deviceId);
}

// 连接WebSocket函数
function connectWebSocket() {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        console.log('Connected to WebSocket server');
        isConnected = true;
        reconnectAttempts = 0; // 重置重连计数
        ws.send(JSON.stringify({ type: 'init', device_id: deviceId })); // 发送初始化消息
    };

    ws.onmessage = (event) => {
        console.log('Received:', event.data);
        processMessage(event.data); // 处理接收到的消息
    };

    ws.onclose = () => {
        console.log('Disconnected from WebSocket server');
        isConnected = false;
        retryConnection(); // 尝试重新连接
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        ws.close(); // 关闭WebSocket连接
    };
}

// 重新连接WebSocket
function retryConnection() {
    if (reconnectAttempts < maxReconnectAttempts) {
        setTimeout(() => {
            reconnectAttempts++;
            connectWebSocket(); // 尝试重新连接
        }, reconnectInterval);
    } else {
        alert('无法连接到服务器，请稍后再试'); // 显示连接失败信息
    }
}

// 处理WebSocket接收到的消息
function processMessage(data) {
    try {
        const message = JSON.parse(data);
        if (message['交互']) {
            document.getElementById('interactButton').textContent = message['交互']; // 更新交互按钮文本
        }
    } catch (e) {
        console.error('Error parsing message:', e);
    }
}

// 初始化WebSocket连接
connectWebSocket();

// 元素选择
const characterForm = document.getElementById('characterForm');
const genderSelect = document.getElementById('gender');
const appearanceSelect = document.getElementById('appearance');
const characterImage = document.getElementById('characterImage');

// 角色外观选项
const appearances = {
    male: ['外观一', '外观二'],
    female: ['外观一', '外观二']
};

// 图片资源
const images = {
    male: {
        '外观一': './images/male1.png',
        '外观二': './images/male2.png'
    },
    female: {
        '外观一': './images/female1.png',
        '外观二': './images/female2.png'
    }
};

// 监听性别选择变化以更新外观选项
genderSelect.addEventListener('change', function() {
    const gender = this.value;
    appearanceSelect.innerHTML = '<option value="">请选择外观</option>';
    
    if (gender && appearances[gender]) {
        appearances[gender].forEach(app => {
            const option = document.createElement('option');
            option.value = app;
            option.textContent = app;
            appearanceSelect.appendChild(option); // 添加外观选项
        });
    }
    updateCharacterImage(); // 更新角色图片
});

// 监听外观选择变化
appearanceSelect.addEventListener('change', updateCharacterImage);

// 更新角色图片
function updateCharacterImage() {
    const gender = genderSelect.value;
    const appearance = appearanceSelect.value;

    if (gender && appearance && images[gender] && images[gender][appearance]) {
        characterImage.src = images[gender][appearance]; // 设置角色图片
    } else {
        characterImage.src = 'https://gd-hbimg.huaban.com/c725ab2c6cd023da9837de6ee5a18a3a1c10af4cc705-pD5jQF_fw658webp';
    }
}

// 处理角色表单提交
characterForm.addEventListener('submit', function(e) {
    e.preventDefault();

    const formData = new FormData(this);
    const characterData = {
        type: 'create_character',
        device_id: deviceId,
        name: formData.get('name'),
        gender: formData.get('gender'),
        class: formData.get('class'),
        appearance: formData.get('appearance')
    };

    if (isConnected) {
        ws.send(JSON.stringify(characterData)); // 发送角色创建数据
        switchToGameView(characterData); // 切换到游戏视图
    }
});

// 切换到游戏视图
function switchToGameView(characterData) {
    document.getElementById('creationPanel').classList.add('hidden');
    document.querySelector('h1').classList.add('hidden');
    
    const gameView = document.getElementById('gameView');
    gameView.classList.add('active');
    gameView.style.display = 'flex';

    const gameCharacterImage = document.getElementById('gameCharacterImage');
    const gender = characterData.gender;
    const appearance = characterData.appearance;
    
    gameCharacterImage.src = images[gender][appearance]; // 设置游戏中的角色图像
    document.getElementById('interactionButtonContainer').style.display = 'block';
}

// 控制和摇杆逻辑
const controls = document.getElementById('controls');
const joystick = document.getElementById('joystick');
let isMoving = false;
let lastAngle = null;

// 计算触摸角度
function calculateAngle(x, y) {
    return Math.atan2(y, x) * (180 / Math.PI);
}

// 处理移动指令
function handleMovement(angle) {
    if (isConnected) {
        ws.send(JSON.stringify({
            type: 'move',
            device_id: deviceId,
            angle: angle.toFixed(2)
        }));
    }
}

// 监听触控开始事件
controls.addEventListener('touchstart', (e) => {
    e.preventDefault();
    isMoving = true;
    if (isConnected) {
        ws.send(JSON.stringify({ type: 'start_move', device_id: deviceId }));
    }
});

// 监听触控移动事件
controls.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!isMoving) return;

    const touch = e.touches[0];
    const rect = controls.getBoundingClientRect();
    const x = touch.clientX - rect.left - rect.width / 2;
    const y = touch.clientY - rect.top - rect.height / 2;

    const radius = rect.width / 2 - joystick.offsetWidth / 2;
    const distance = Math.sqrt(x * x + y * y);
    const angle = calculateAngle(x, y);

    if (distance > radius) {
        const scale = radius / distance;
        joystick.style.transform = `translate(${x * scale}px, ${y * scale}px)`;
    } else {
        joystick.style.transform = `translate(${x}px, ${y}px)`;
    }

    if (angle !== lastAngle) {
        lastAngle = angle;
        handleMovement(angle); // 更新移动方向
    }
});

// 监听触控结束事件
controls.addEventListener('touchend', () => {
    isMoving = false;
    lastAngle = null;
    joystick.style.transform = JOYSTICK_CENTER; // 重置摇杆位置
    if (isConnected) {
        ws.send(JSON.stringify({ type: 'stop_move', device_id: deviceId }));
    }
});

// 监听交互按钮点击事件
document.getElementById('interactButton').addEventListener('click', () => {
    if (isConnected) {
        ws.send(JSON.stringify({
            type: 'interaction', 
            device_id: deviceId,
            action: 'interact'
        }));
    }
});
