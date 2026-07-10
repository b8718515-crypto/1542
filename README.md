# 야간 돌발 근무 대기조

A~I조 순환 야간 돌발 근무 대기 일정을 관리하는 웹 앱입니다. (React + Vite)

## 실행 방법

```bash
npm install
npm run dev
```

## 빌드

```bash
npm run build
```

`dist/` 폴더에 정적 파일이 생성됩니다.

## GitHub Pages 자동 배포

`main` 브랜치에 push하면 `.github/workflows/deploy.yml`이 자동으로 빌드 후 GitHub Pages에 배포합니다.

1. 저장소 **Settings → Pages**로 이동
2. **Build and deployment → Source**를 **GitHub Actions**로 설정
3. `main` 브랜치에 push하면 자동 배포 시작 (Actions 탭에서 진행 상황 확인 가능)

배포된 주소는 `https://<사용자이름>.github.io/<저장소이름>/` 형태입니다.
