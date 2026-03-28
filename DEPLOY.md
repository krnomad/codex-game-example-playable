# Deployment Guide

이 저장소는 정적 파일만으로 동작하므로 GitHub Pages에 바로 배포할 수 있다.

## 권장 방식: GitHub Pages

1. 새 GitHub 저장소를 만든다.
2. 현재 로컬 저장소에 원격을 추가한다.

```bash
git remote add origin <YOUR_GITHUB_REPO_URL>
git push -u origin master
```

3. GitHub 저장소의 `Settings > Pages`에서 `Source`를 `GitHub Actions`로 설정한다.
4. 이후 `master` 또는 `main`에 푸시할 때마다 `.github/workflows/deploy-pages.yml`이 자동으로 배포한다.

## 공개 URL 형태

- 사용자/조직 사이트가 아닌 일반 저장소 기준:
  - `https://<github-user>.github.io/<repo-name>/`

루트 `index.html`은 자동으로 `./prototypes/tower-placement/`로 리다이렉트된다.

## 현재 배포 구조

- 루트 진입점: `/`
- 실제 플레이 페이지: `/prototypes/tower-placement/`

## 확인 포인트

- 프로토타입 루트가 정상적으로 열리는지
- `assets/` 내 SVG가 200으로 서빙되는지
- 모바일 가로모드에서 진입 가능한지
