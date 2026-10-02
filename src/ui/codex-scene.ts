import * as THREE from 'three';

export interface ShelfPlane {
  top: number;
  count: number;
  header: boolean;
  height: number;
}

/** A shallow, front-facing cabinet. Native scrolling owns the camera position. */
export function createCabinet(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, 1, 0, 1, 1, 2000);
  camera.position.z = 1000;
  const ambient = new THREE.AmbientLight('white', 2);
  const light = new THREE.DirectionalLight('white', 2.4);
  light.position.set(-200, -400, 650);
  scene.add(ambient, light);
  const grain = new Uint8Array(128 * 256 * 4);
  for (let y = 0; y < 256; y++)
    for (let x = 0; x < 128; x++) {
      const wave =
        Math.sin(x * 0.29 + Math.sin(y * 0.017) * 1.8) * 10 + Math.sin(x * 1.73 + y * 0.003) * 3;
      const value = Math.round(221 + wave);
      const offset = (y * 128 + x) * 4;
      grain.set([value, value, value, 255], offset);
    }
  const texture = new THREE.DataTexture(grain, 128, 256);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshLambertMaterial({ map: texture });
  const recess = new THREE.MeshLambertMaterial();
  const edge = new THREE.MeshLambertMaterial({ map: texture });
  const group = new THREE.Group();
  scene.add(group);
  const batches = new Map(
    [material, recess, edge].map((mat) => {
      const mesh = new THREE.InstancedMesh(geometry, mat, 128);
      mesh.frustumCulled = false;
      group.add(mesh);
      return [mat, mesh] as const;
    }),
  );
  const transform = new THREE.Object3D();
  let frames = 0;
  let previousWidth = 0,
    previousHeight = 0;
  const box = (
    x: number,
    y: number,
    w: number,
    h: number,
    depth: number,
    mat: THREE.MeshLambertMaterial,
    z = 0,
  ) => {
    const mesh = batches.get(mat)!;
    transform.position.set(x + w / 2, y + h / 2, z);
    transform.scale.set(w, h, depth);
    transform.updateMatrix();
    mesh.setMatrixAt(mesh.count++, transform.matrix);
  };
  return {
    draw(width: number, height: number, planes: ShelfPlane[], columns: number) {
      if (document.hidden) return;
      const styles = getComputedStyle(canvas);
      material.color.set(styles.getPropertyValue('--wood').trim());
      recess.color.set(styles.getPropertyValue('--wood-recess').trim());
      edge.color.set(styles.getPropertyValue('--wood-edge').trim());
      if (width !== previousWidth || height !== previousHeight) {
        renderer.setSize(width, height, false);
        camera.right = width;
        camera.bottom = height;
        camera.updateProjectionMatrix();
        previousWidth = width;
        previousHeight = height;
      }
      for (const mesh of batches.values()) mesh.count = 0;
      box(10, 0, width - 20, height, 8, recess, -24);
      box(0, 0, 18, height, 36, material);
      box(width - 18, 0, 18, height, 36, material);
      box(4, 0, 3, height, 3, edge, 20);
      box(width - 7, 0, 3, height, 3, edge, 20);
      for (const plane of planes) {
        if (plane.header) {
          box(12, plane.top, width - 24, plane.height, 16, material, -5);
          box(8, plane.top, width - 16, 5, 30, edge, 7);
          box(14, plane.top + plane.height - 2, width - 28, 4, 24, edge, 7);
        } else {
          box(12, plane.top + 209, width - 24, 17, 40, material, 4);
          box(8, plane.top + 224, width - 16, 5, 44, edge, 9);
          const cell = (width - 48) / columns;
          for (let i = 0; i < plane.count; i++) {
            const cover = Math.min(112, cell - 22);
            box(24 + i * cell + (cell - cover) / 2 + 4, plane.top + 38, cover, 169, 14, recess, -6);
          }
        }
      }
      for (const mesh of batches.values()) mesh.instanceMatrix.needsUpdate = true;
      renderer.render(scene, camera);
      canvas.dataset.frames = String(++frames);
      canvas.dataset.meshes = String(group.children.length);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      recess.dispose();
      edge.dispose();
      texture.dispose();
      renderer.dispose();
    },
  };
}
