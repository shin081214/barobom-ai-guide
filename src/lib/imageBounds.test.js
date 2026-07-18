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

test('크기가 아직 측정되지 않았으면 좌표를 만들지 않는다', () => {
  expect(getContainedImageBounds({
    containerWidth: 0,
    containerHeight: 300,
    naturalWidth: 300,
    naturalHeight: 600,
  })).toBeNull();
});

test('displayWidth/Height가 주어지면 그것을 그대로 신뢰한다 (회전된 카메라 보정)', () => {
  // 카메라 intrinsic이 1920x1080이라도 실제 화면에 표시된 사각형이
  // portrait 프레임 안의 360x540 사각형이라면 그 크기로 좌표를 잡아야 한다.
  expect(getContainedImageBounds({
    containerWidth: 360,
    containerHeight: 640,
    naturalWidth: 1920,
    naturalHeight: 1080,
    displayWidth: 360,
    displayHeight: 540,
  })).toEqual({ left: 0, top: 0, width: 360, height: 540 });
});

test('displayWidth가 0이면 자연 intrinsic fallback으로 contain 영역을 계산한다', () => {
  // 영상 element가 mount 직후 clientWidth=0인 동안에도, videoWidth/Height가
  // 잡혀 있으면 intrinsic 비율로 contain 영역을 만들어서 박스를 그려야 한다.
  expect(getContainedImageBounds({
    containerWidth: 360,
    containerHeight: 640,
    naturalWidth: 1920,
    naturalHeight: 1080,
    displayWidth: 0,
    displayHeight: 540,
  })).toEqual({ left: 0, top: 218.75, width: 360, height: 202.5 });
});