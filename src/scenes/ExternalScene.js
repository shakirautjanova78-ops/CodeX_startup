// ... Импорттар ...
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class ExternalScene {
    constructor(scene) {
        this.scene = scene;
        this.loader = new GLTFLoader();
        this.loadUniversityModel();
    }

    loadUniversityModel() {
        // Сіздің қарапайымдалған жолыңыз:
        const modelPath = 'assets/models/1/scene.gltf';

        this.loader.load(
            modelPath,
            (gltf) => {
                const universityModel = gltf.scene;
                this.scene.add(universityModel);
                console.log('Университеттің сыртқы моделі сәтті жүктелді:', modelPath);
            },
            // ... Прогресс және қателік функциялары ...
            undefined, // Прогресс функциясы (қажет болмаса 'undefined' қалдыруға болады)
            (error) => {
                console.error('3D модельді жүктеуде қате пайда болды:', error);
            }
        );
    }
    // ...
}