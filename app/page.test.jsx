import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import Page from './page.jsx';

test('Next.js 홈 페이지가 바로봄 앱을 렌더링한다', () => {
  render(<Page />);
  expect(screen.getByRole('heading', { name: '실시간 AI로 시작하기' })).toBeInTheDocument();
});
