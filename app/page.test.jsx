import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import Page from './page.jsx';

test('Next.js 홈 페이지가 바로봄 앱을 렌더링한다', () => {
  render(<Page />);
  expect(screen.getByRole('heading', { name: '무엇을 하고 싶으세요?' })).toBeInTheDocument();
});
