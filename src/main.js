// GLTFLoader-ді арнайы модульден импорттаймыз (Бұл қатені түзетеді)
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/loaders/GLTFLoader.js';

// --- Айнымалылар ---
let videoElement, handDetector;
let threeScene, threeRenderer, threeCamera;
let currentSceneKey = 'external';

// Қозғалыс айнымалылары
let lastHandX = null;
let currentRotation = 0;
let targetRotation = 0;
let isMovingForward = false;

const ROTATION_SPEED = 0.05;
const MOVE_SPEED = 0.1;
const SWIPE_THRESHOLD = 0.05;

// Модель жолдары (ПАПКА АТТАРЫН ТЕКСЕРІҢІЗ!)
const MODEL_PATHS = {
    'external': 'assets/models/1/scene.gltf',
    'auditorium': 'assets/models/2/scene.gltf', // Егер папка 2 болса
    'library': 'assets/models/3/scene.gltf',    // Егер папка 3 болса
    'canteen': 'assets/models/4/scene.gltf',
    'sport': 'assets/models/5/scene.gltf'
};

// --- 1. Түймелер үшін функция (GLOBAL) ---
// Бұл функция HTML-дегі onclick="window.changeScene(...)" үшін қажет
window.changeScene = function(sceneKey) {
    console.log("Түйме басылды:", sceneKey);
    
    if (currentSceneKey === sceneKey) return;
    
    const path = MODEL_PATHS[sceneKey];
    if (!path) {
        console.error("Модель табылмады:", sceneKey);
        return;
    }

    currentSceneKey = sceneKey;
    load3DModel(path);

    // Камераны реттеу
    if (sceneKey === 'external') {
        threeCamera.position.set(0, 5, 15); // Жоғарыдан
    } else {
        threeCamera.position.set(0, 1.6, 0); // Адам бойымен
    }
    
    // Бұрылуды нөлдеу
    currentRotation = 0;
    targetRotation = 0;
    threeCamera.rotation.y = 0;
};

// --- 2. Three.js Бастау ---
function initThreeJS() {
    const container = document.getElementById('threejs-container');

    // Сахна
    threeScene = new THREE.Scene();
    threeScene.background = new THREE.Color(0xdddddd);

    // Камера
    threeCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    threeCamera.position.set(0, 5, 15);

    // Рендерер
    threeRenderer = new THREE.WebGLRenderer({ antialias: true });
    threeRenderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(threeRenderer.domElement);

    // Жарық
    const ambientLight = new THREE.AmbientLight(0xffffff, 2);
    threeScene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 2);
    dirLight.position.set(10, 20, 10);
    threeScene.add(dirLight);

    // Терезе өлшемі өзгергенде
    window.addEventListener('resize', () => {
        threeCamera.aspect = window.innerWidth / window.innerHeight;
        threeCamera.updateProjectionMatrix();
        threeRenderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Алғашқы модельді жүктеу
    load3DModel(MODEL_PATHS['external']);

    // Анимацияны бастау
    animate();
}

// --- 3. Модель Жүктеу ---
function load3DModel(path) {
    const statusEl = document.getElementById('status');
    statusEl.textContent = "3D модель жүктелуде...";

    // Ескі модельдерді тазалау
    // Біз жарықтарды (Light) қалдырып, тек Mesh-терді өшіреміз
    for(let i = threeScene.children.length - 1; i >= 0; i--) {
        let obj = threeScene.children[i];
        if(obj.type === 'Group' || obj.type === 'Mesh') {
            threeScene.remove(obj);
        }
    }

    const loader = new GLTFLoader();
    loader.load(path, 
        (gltf) => {
            const model = gltf.scene;
            threeScene.add(model);
            statusEl.textContent = "Дайын! Қолмен басқарыңыз ✋";
            console.log("Модель жүктелді:", path);
        },
        undefined,
        (error) => {
            console.error(error);
            statusEl.textContent = "Қате! Модель жолын тексеріңіз.";
        }
    );
}

// --- 4. Камераны қосу (Webcam) ---
async function setupWebcam() {
    videoElement = document.getElementById('webcam');
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoElement.srcObject = stream;
        return new Promise((resolve) => {
            videoElement.onloadedmetadata = () => {
                videoElement.play();
                resolve(true);
            };
        });
    } catch (error) {
        document.getElementById('status').textContent = "Камераға рұқсат жоқ! Live Server қосылды ма?";
        console.error("Webcam error:", error);
        return false;
    }
}

// --- 5. MediaPipe Hands қосу ---
async function setupHandDetector() {
    handDetector = new Hands({locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${file}`;
    }});

    handDetector.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7
    });

    handDetector.onResults(onResults);
}

// --- 6. Қол қимылын өңдеу ---
function onResults(results) {
    const feedback = document.getElementById('gesture-feedback');
    isMovingForward = false; // Әр кадрда reset жасаймыз

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        
        // --- А) "ЛАЙК" (АЛҒА ЖҮРУ) ---
        // Бас бармақтың ұшы (4) оның түбінен (2) жоғары ма?
        // Және сұқ саусақ (8) төмен қарап тұр ма (бүгулі)?
        const thumbTip = landmarks[4].y;
        const thumbBase = landmarks[2].y;
        const indexTip = landmarks[8].y;
        const indexBase = landmarks[5].y;

        // Қарапайым логика: Егер бас бармақ қатты жоғары болса
        if (thumbTip < thumbBase - 0.05 && indexTip > indexBase) {
            isMovingForward = true;
            feedback.textContent = "Қимыл: Алға жүру 🚀 (Лайк)";
        } else {
            // --- Б) БҰРЫЛУ (СВАЙП) ---
            const currentX = landmarks[0].x; // Білектің X координаты
            
            if (lastHandX !== null) {
                const delta = currentX - lastHandX;
                
                if (delta > SWIPE_THRESHOLD) {
                    feedback.textContent = "Қимыл: Оңға бұрылу ➡️";
                    targetRotation -= ROTATION_SPEED * 5; 
                } else if (delta < -SWIPE_THRESHOLD) {
                    feedback.textContent = "Қимыл: Солға бұрылу ⬅️";
                    targetRotation += ROTATION_SPEED * 5; 
                } else {
                    feedback.textContent = "Қол табылды ✋";
                }
            }
            lastHandX = currentX;
        }

    } else {
        feedback.textContent = "Қол ізделуде... 🧐";
        lastHandX = null;
    }
}

// --- 7. Анимация Циклі ---
async function animate() {
    requestAnimationFrame(animate);

    // Камераны тегіс бұру
    currentRotation += (targetRotation - currentRotation) * 0.1;
    threeCamera.rotation.y = currentRotation;

    // Алға жүру
    if (isMovingForward) {
        const angle = threeCamera.rotation.y;
        threeCamera.position.x -= Math.sin(angle) * MOVE_SPEED;
        threeCamera.position.z -= Math.cos(angle) * MOVE_SPEED;
    }

    // Қолды тану
    if (handDetector && videoElement.readyState >= 2) {
        await handDetector.send({image: videoElement});
    }

    threeRenderer.render(threeScene, threeCamera);
}

// --- БАСТАУ ---
async function start() {
    const camReady = await setupWebcam();
    if (camReady) {
        initThreeJS();
        setupHandDetector();
    }
}

start();