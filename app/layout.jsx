import '../src/styles.css';

export const metadata = {
  title: '바로봄 — AI 디지털 사용 도우미',
  description: '어려운 디지털 화면을 사진으로 찍으면 AI가 눌러야 할 곳을 한 단계씩 알려드립니다.',
  appleWebApp: {
    capable: true,
    title: '바로봄',
    statusBarStyle: 'default',
  },
  formatDetection: { telephone: false },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#f8faf8',
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
