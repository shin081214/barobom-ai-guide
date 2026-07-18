import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  ...nextVitals,
  {
    // 업로드한 로컬 blob URL은 next/image 최적화 파이프라인을 사용할 수 없습니다.
    rules: { '@next/next/no-img-element': 'off' },
  },
  globalIgnores(['.next/**', 'coverage/**']),
]);
