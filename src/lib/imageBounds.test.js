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
