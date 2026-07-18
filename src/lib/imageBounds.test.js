import { expect, test } from 'vitest';
import { getContainedImageBounds } from './imageBounds.js';

test('세로 사진을 가로 프레임에 contain으로 표시하면 좌우 여백을 제외한다', () => {
  expect(getContainedImageBounds({
    containerWidth: 400,
    containerHeight: 300,
    naturalWidth: 300,
    naturalHeight: 600,
  })).toEqual({ left: 125, top: 0, width: 150, height: 300 });
});

test('가로 사진을 정사각형 프레임에 contain으로 표시하면 상하 여백을 제외한다', () => {
  expect(getContainedImageBounds({
    containerWidth: 400,
    containerHeight: 400,
    naturalWidth: 800,
    naturalHeight: 400,
  })).toEqual({ left: 0, top: 100, width: 400, height: 200 });
});

test('사진과 프레임 비율이 같으면 프레임 전체를 좌표계로 사용한다', () => {
  expect(getContainedImageBounds({
    containerWidth: 400,
    containerHeight: 300,
    naturalWidth: 800,
    naturalHeight: 600,
  })).toEqual({ left: 0, top: 0, width: 400, height: 300 });
});

test('크기가 아직 측정되지 않으면 좌표를 만들지 않는다', () => {
  expect(getContainedImageBounds({
    containerWidth: 0,
    containerHeight: 300,
    naturalWidth: 300,
    naturalHeight: 600,
  })).toBeNull();
});

// --- 비디오 / 카메라 시나리오 ---

test('displayWidth/Height가 주어지고 비율이 같으면 host rect가 그대로 박스 영역이다', () => {
  // video element가 frame에 꽉 차 있고 영상 비율도 같으면 박스도 frame 전체.
  expect(getContainedImageBounds({
    containerWidth: 360,
    containerHeight: 640,
    naturalWidth: 1080,
    naturalHeight: 1920,
    displayWidth: 360,
    displayHeight: 640,
  })).toEqual({ left: 0, top: 0, width: 360, height: 640 });
});

test('display는 꽉 찼지만 intrinsic이 더 와이드하면 pillarbox(좌우 검정) 영역을 박스로 잡는다', () => {
  // 후면 카메라가 landscape(1920x1080)로 들어오고 video element는 portrait
  // 360x640에 object-fit: contain → 안드로이드에서 흔히 보이는 케이스.
  // 안 보이는 좌우 검정 띠는 제외하고, 사용자가 실제로 보는 영상 사각형을
  // 박스 영역으로 잡아야 한다.
  expect(getContainedImageBounds({
    containerWidth: 360,
    containerHeight: 640,
    naturalWidth: 1920,
    naturalHeight: 1080,
    displayWidth: 360,
    displayHeight: 640,
  })).toEqual({ left: 0, top: 218.75, width: 360, height: 202.5 });
});

test('display와 intrinsic이 다른 비율이면 host 안에서 letterbox/pillarbox 위치를 계산한다', () => {
  // video element는 400x300인데 intrinsic이 300x600이면 letterbox
  // (좌우 검정) 발생 → 실제 영상은 안쪽 150x300 사각형에 그려진다.
  expect(getContainedImageBounds({
    containerWidth: 400,
    containerHeight: 300,
    naturalWidth: 300,
    naturalHeight: 600,
    displayWidth: 400,
    displayHeight: 300,
  })).toEqual({ left: 125, top: 0, width: 150, height: 300 });
});

test('display만 양수이고 intrinsic은 0이면 display rect를 그대로 반환한다', () => {
  // videoWidth/Height가 아직 0인 mount 직후 상태에서는 host element 영역을
  // 그대로 박스로 잡아서 placeholder로 어긋나지 않게 한다.
  expect(getContainedImageBounds({
    containerWidth: 360,
    containerHeight: 640,
    naturalWidth: 0,
    naturalHeight: 0,
    displayWidth: 360,
    displayHeight: 540,
  })).toEqual({ left: 0, top: 0, width: 360, height: 540 });
});

test('display도 intrinsic도 없으면 null을 반환한다', () => {
  expect(getContainedImageBounds({
    containerWidth: 360,
    containerHeight: 640,
  })).toBeNull();
});